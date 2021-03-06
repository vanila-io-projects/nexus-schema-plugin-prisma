import { DMMF } from '@prisma/client/runtime'
import { paginationStrategies, PaginationStrategy } from '../pagination'
import { GlobalComputedInputs, GlobalMutationResolverParams, LocalComputedInputs } from '../utils'
import { DmmfDocument } from './DmmfDocument'
import { DmmfTypes } from './DmmfTypes'
import { getPrismaClientDmmf } from './utils'

export type TransformOptions = {
  atomicOperations?: boolean
  globallyComputedInputs?: GlobalComputedInputs
  paginationStrategy?: PaginationStrategy
}

export const getTransformedDmmf = (
  prismaClientPackagePath: string,
  options?: TransformOptions
): DmmfDocument => new DmmfDocument(transform(getPrismaClientDmmf(prismaClientPackagePath), options))

const addDefaultOptions = (givenOptions?: TransformOptions): Required<TransformOptions> => ({
  globallyComputedInputs: {},
  paginationStrategy: paginationStrategies.relay,
  atomicOperations: true,
  ...givenOptions,
})

export function transform(document: DMMF.Document, options?: TransformOptions): DmmfTypes.Document {
  return {
    datamodel: transformDatamodel(document.datamodel),
    mappings: document.mappings as DmmfTypes.Mapping[],
    schema: transformSchema(document.schema, addDefaultOptions(options)),
  }
}

function transformDatamodel(datamodel: DMMF.Datamodel): DmmfTypes.Datamodel {
  return {
    enums: datamodel.enums,
    models: datamodel.models.map((model) => ({
      ...model,
      fields: model.fields.map((field) => ({
        ...field,
        kind: field.kind === 'object' ? 'relation' : field.kind,
      })),
    })) as any, // TODO: Remove this once @prisma/client/runtime:DMMF contains the `uniqueFields` typed
  }
}

const paginationArgNames = ['cursor', 'take', 'skip']

function transformSchema(
  schema: DMMF.Schema,
  { globallyComputedInputs, paginationStrategy, atomicOperations }: Required<TransformOptions>
): DmmfTypes.Schema {
  return {
    enums: schema.enums,
    inputTypes: schema.inputTypes.map((_) => transformInputType(_, globallyComputedInputs, atomicOperations)),
    outputTypes: schema.outputTypes.map((o) => {
      return {
        ...o,
        fields: o.fields.map((f) => {
          let args = f.args.map((_) => transformArg(_, atomicOperations))
          const argNames = args.map((a) => a.name)

          // If this field has pagination
          if (paginationArgNames.every((paginationArgName) => argNames.includes(paginationArgName))) {
            args = paginationStrategy.transformDmmfArgs({
              args,
              paginationArgNames,
              field: f,
            })
          }

          return {
            name: f.name,
            args,
            outputType: {
              type: getReturnTypeName(f.outputType.type) as any,
              kind: f.outputType.kind,
              isRequired: f.isRequired,
              isNullable: f.isNullable,
              isList: f.outputType.isList,
            },
          }
        }),
      }
    }),
  }
}

/**
 * Conversion from a Prisma Client arg type to a GraphQL arg type using
 * heuristics. A conversion is needed because GraphQL does not
 * support union types on args, but Prisma Client does.
 */
function transformArg(arg: DMMF.SchemaArg, atomicOperations: boolean): DmmfTypes.SchemaArg {
  const inputType = flattenUnionOfSchemaArg(arg.inputTypes, atomicOperations)

  return {
    name: arg.name,
    inputType: {
      type: getReturnTypeName(inputType.type),
      isList: inputType.isList,
      kind: inputType.kind,
      isNullable: arg.isNullable,
      isRequired: arg.isRequired,
    },
    // FIXME Why?
    isRelationFilter: undefined,
  }
}

/**
 * Prisma Client supports union types but GraphQL doesn't.
 * Because of that, we need to choose a member of the union type that we'll expose on our GraphQL schema.
 *
 * Apart from some exceptions, we're generally trying to pick the broadest member type of the union.
 */
function flattenUnionOfSchemaArg(
  inputTypes: DMMF.SchemaArgInputType[],
  atomicOperations: boolean
): DMMF.SchemaArgInputType {
  // Remove atomic operations if needed
  const filteredInputTypes =
    atomicOperations === false
      ? inputTypes.filter((a) => !getReturnTypeName(a.type).endsWith('OperationsInput'))
      : inputTypes

  return (
    // We're intentionally ignoring the `<Model>RelationFilter` member of some union type for now and using the `<Model>WhereInput` instead to avoid making a breaking change
    filteredInputTypes.find(
      (a) => a.kind === 'object' && a.isList == true && getReturnTypeName(a.type).endsWith('WhereInput')
    ) ??
    // Same here
    filteredInputTypes.find((a) => a.kind === 'object' && getReturnTypeName(a.type).endsWith('WhereInput')) ??
    // [AnyType]
    filteredInputTypes.find((a) => a.kind === 'object' && a.isList === true) ??
    // AnyType
    filteredInputTypes.find((a) => a.kind === 'object') ??
    // fallback to the first member of the union
    inputTypes[0]
  )
}

type AddComputedInputParams = {
  inputType: DmmfTypes.InputType
  params: GlobalMutationResolverParams
  dmmf: DmmfDocument
  locallyComputedInputs: LocalComputedInputs<any>
}

/** Resolver-level computed inputs aren't recursive so aren't
 *  needed for deep computed inputs.
 */
type AddDeepComputedInputsArgs = Omit<AddComputedInputParams, 'locallyComputedInputs'> & { data: any } // Used to recurse through the input object

/**
 * Recursively looks for inputs that need a value from globallyComputedInputs
 * and populates them
 */
async function addGloballyComputedInputs({
  inputType,
  params,
  dmmf,
  data,
}: AddDeepComputedInputsArgs): Promise<Record<string, any>> {
  if (Array.isArray(data)) {
    return Promise.all(
      data.map((value) =>
        addGloballyComputedInputs({
          inputType,
          dmmf,
          params,
          data: value,
        })
      )
    )
  }
  // Get values for computedInputs corresponding to keys that exist in inputType
  const computedInputValues = Object.keys(inputType.computedInputs).reduce(
    async (values, key) => ({
      ...(await values),
      [key]: await inputType.computedInputs[key](params),
    }),
    Promise.resolve({} as Record<string, any>)
  )
  // Combine computedInputValues with values provided by the user, recursing to add
  // global computedInputs to nested types
  return Object.keys(data).reduce(async (deeplyComputedData, fieldName) => {
    const field = inputType.fields.find((_) => _.name === fieldName)!
    const fieldValue =
      field.inputType.kind === 'object'
        ? await addGloballyComputedInputs({
            inputType: dmmf.getInputType(field.inputType.type),
            dmmf,
            params,
            data: data[fieldName],
          })
        : data[fieldName]
    return {
      ...(await deeplyComputedData),
      [fieldName]: fieldValue,
    }
  }, computedInputValues)
}

export async function addComputedInputs({
  dmmf,
  inputType,
  locallyComputedInputs,
  params,
}: AddComputedInputParams) {
  return {
    ...params.args,
    data: {
      /**
       * Globally computed inputs are attached to the inputType object
       * as 'computedInputs' by the transformInputType function.
       */
      ...(await addGloballyComputedInputs({
        inputType,
        dmmf,
        params,
        data: params.args.data,
      })),
      ...(await Object.entries(locallyComputedInputs).reduce(
        async (args, [fieldName, computeFieldValue]) => ({
          ...(await args),
          [fieldName]: await computeFieldValue(params),
        }),
        Promise.resolve({} as Record<string, any>)
      )),
    },
  }
}

function transformInputType(
  inputType: DMMF.InputType,
  globallyComputedInputs: GlobalComputedInputs,
  atomicOperations: boolean
): DmmfTypes.InputType {
  const fieldNames = inputType.fields.map((field) => field.name)
  /**
   * Only global computed inputs are removed during schema transform.
   * Resolver level computed inputs are filtered as part of the
   * projecting process. They are then passed to addComputedInputs
   * at runtime so their values can be inferred alongside the
   * global values.
   */
  const globallyComputedInputsInType = Object.keys(globallyComputedInputs).reduce(
    (args, key) =>
      fieldNames.includes(key) ? Object.assign(args, { [key]: globallyComputedInputs[key] }) : args,
    {} as GlobalComputedInputs
  )
  return {
    ...inputType,
    fields: inputType.fields
      .filter((field) => !(field.name in globallyComputedInputs))
      .map((_) => transformArg(_, atomicOperations)),
    computedInputs: globallyComputedInputsInType,
  }
}

/**
 * Make the "return type" property type always be a string. In Prisma Client
 * it is allowed to be a nested structured object but we want only the
 * reference-by-name form.
 *
 */
export function getReturnTypeName(type: DMMF.ArgType | DMMF.InputType | DMMF.OutputType): string {
  if (typeof type === 'string') {
    return type
  }

  return type.name
}
