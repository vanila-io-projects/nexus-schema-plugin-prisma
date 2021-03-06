"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReturnTypeName = exports.addComputedInputs = exports.transform = exports.getTransformedDmmf = void 0;
const pagination_1 = require("../pagination");
const DmmfDocument_1 = require("./DmmfDocument");
const utils_1 = require("./utils");
exports.getTransformedDmmf = (prismaClientPackagePath, options) => new DmmfDocument_1.DmmfDocument(transform(utils_1.getPrismaClientDmmf(prismaClientPackagePath), options));
const addDefaultOptions = (givenOptions) => (Object.assign({ globallyComputedInputs: {}, paginationStrategy: pagination_1.paginationStrategies.relay, atomicOperations: true }, givenOptions));
function transform(document, options) {
    return {
        datamodel: transformDatamodel(document.datamodel),
        mappings: document.mappings,
        schema: transformSchema(document.schema, addDefaultOptions(options)),
    };
}
exports.transform = transform;
function transformDatamodel(datamodel) {
    return {
        enums: datamodel.enums,
        models: datamodel.models.map((model) => (Object.assign(Object.assign({}, model), { fields: model.fields.map((field) => (Object.assign(Object.assign({}, field), { kind: field.kind === 'object' ? 'relation' : field.kind }))) }))),
    };
}
const paginationArgNames = ['cursor', 'take', 'skip'];
function transformSchema(schema, { globallyComputedInputs, paginationStrategy, atomicOperations }) {
    return {
        enums: schema.enums,
        inputTypes: schema.inputTypes.map((_) => transformInputType(_, globallyComputedInputs, atomicOperations)),
        outputTypes: schema.outputTypes.map((o) => {
            return Object.assign(Object.assign({}, o), { fields: o.fields.map((f) => {
                    let args = f.args.map((_) => transformArg(_, atomicOperations));
                    const argNames = args.map((a) => a.name);
                    // If this field has pagination
                    if (paginationArgNames.every((paginationArgName) => argNames.includes(paginationArgName))) {
                        args = paginationStrategy.transformDmmfArgs({
                            args,
                            paginationArgNames,
                            field: f,
                        });
                    }
                    return {
                        name: f.name,
                        args,
                        outputType: {
                            type: getReturnTypeName(f.outputType.type),
                            kind: f.outputType.kind,
                            isRequired: f.isRequired,
                            isNullable: f.isNullable,
                            isList: f.outputType.isList,
                        },
                    };
                }) });
        }),
    };
}
/**
 * Conversion from a Prisma Client arg type to a GraphQL arg type using
 * heuristics. A conversion is needed because GraphQL does not
 * support union types on args, but Prisma Client does.
 */
function transformArg(arg, atomicOperations) {
    const inputType = flattenUnionOfSchemaArg(arg.inputTypes, atomicOperations);
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
    };
}
/**
 * Prisma Client supports union types but GraphQL doesn't.
 * Because of that, we need to choose a member of the union type that we'll expose on our GraphQL schema.
 *
 * Apart from some exceptions, we're generally trying to pick the broadest member type of the union.
 */
function flattenUnionOfSchemaArg(inputTypes, atomicOperations) {
    var _a, _b, _c, _d;
    // Remove atomic operations if needed
    const filteredInputTypes = atomicOperations === false
        ? inputTypes.filter((a) => !getReturnTypeName(a.type).endsWith('OperationsInput'))
        : inputTypes;
    return ((_d = (_c = (_b = (_a = 
    // We're intentionally ignoring the `<Model>RelationFilter` member of some union type for now and using the `<Model>WhereInput` instead to avoid making a breaking change
    filteredInputTypes.find((a) => a.kind === 'object' && a.isList == true && getReturnTypeName(a.type).endsWith('WhereInput'))) !== null && _a !== void 0 ? _a : 
    // Same here
    filteredInputTypes.find((a) => a.kind === 'object' && getReturnTypeName(a.type).endsWith('WhereInput'))) !== null && _b !== void 0 ? _b : 
    // [AnyType]
    filteredInputTypes.find((a) => a.kind === 'object' && a.isList === true)) !== null && _c !== void 0 ? _c : 
    // AnyType
    filteredInputTypes.find((a) => a.kind === 'object')) !== null && _d !== void 0 ? _d : 
    // fallback to the first member of the union
    inputTypes[0]);
}
/**
 * Recursively looks for inputs that need a value from globallyComputedInputs
 * and populates them
 */
function addGloballyComputedInputs({ inputType, params, dmmf, data, }) {
    return __awaiter(this, void 0, void 0, function* () {
        if (Array.isArray(data)) {
            return Promise.all(data.map((value) => addGloballyComputedInputs({
                inputType,
                dmmf,
                params,
                data: value,
            })));
        }
        // Get values for computedInputs corresponding to keys that exist in inputType
        const computedInputValues = Object.keys(inputType.computedInputs).reduce((values, key) => __awaiter(this, void 0, void 0, function* () {
            return (Object.assign(Object.assign({}, (yield values)), { [key]: yield inputType.computedInputs[key](params) }));
        }), Promise.resolve({}));
        // Combine computedInputValues with values provided by the user, recursing to add
        // global computedInputs to nested types
        return Object.keys(data).reduce((deeplyComputedData, fieldName) => __awaiter(this, void 0, void 0, function* () {
            const field = inputType.fields.find((_) => _.name === fieldName);
            const fieldValue = field.inputType.kind === 'object'
                ? yield addGloballyComputedInputs({
                    inputType: dmmf.getInputType(field.inputType.type),
                    dmmf,
                    params,
                    data: data[fieldName],
                })
                : data[fieldName];
            return Object.assign(Object.assign({}, (yield deeplyComputedData)), { [fieldName]: fieldValue });
        }), computedInputValues);
    });
}
function addComputedInputs({ dmmf, inputType, locallyComputedInputs, params, }) {
    return __awaiter(this, void 0, void 0, function* () {
        return Object.assign(Object.assign({}, params.args), { data: Object.assign(Object.assign({}, (yield addGloballyComputedInputs({
                inputType,
                dmmf,
                params,
                data: params.args.data,
            }))), (yield Object.entries(locallyComputedInputs).reduce((args, [fieldName, computeFieldValue]) => __awaiter(this, void 0, void 0, function* () {
                return (Object.assign(Object.assign({}, (yield args)), { [fieldName]: yield computeFieldValue(params) }));
            }), Promise.resolve({})))) });
    });
}
exports.addComputedInputs = addComputedInputs;
function transformInputType(inputType, globallyComputedInputs, atomicOperations) {
    const fieldNames = inputType.fields.map((field) => field.name);
    /**
     * Only global computed inputs are removed during schema transform.
     * Resolver level computed inputs are filtered as part of the
     * projecting process. They are then passed to addComputedInputs
     * at runtime so their values can be inferred alongside the
     * global values.
     */
    const globallyComputedInputsInType = Object.keys(globallyComputedInputs).reduce((args, key) => fieldNames.includes(key) ? Object.assign(args, { [key]: globallyComputedInputs[key] }) : args, {});
    return Object.assign(Object.assign({}, inputType), { fields: inputType.fields
            .filter((field) => !(field.name in globallyComputedInputs))
            .map((_) => transformArg(_, atomicOperations)), computedInputs: globallyComputedInputsInType });
}
/**
 * Make the "return type" property type always be a string. In Prisma Client
 * it is allowed to be a nested structured object but we want only the
 * reference-by-name form.
 *
 */
function getReturnTypeName(type) {
    if (typeof type === 'string') {
        return type;
    }
    return type.name;
}
exports.getReturnTypeName = getReturnTypeName;
//# sourceMappingURL=transformer.js.map