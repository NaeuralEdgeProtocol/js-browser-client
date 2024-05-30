import {
    DCT_TYPE_META_STREAM,
    DCT_TYPE_ON_DEMAND_INPUT,
    DCT_TYPE_ON_DEMAND_TEXT_INPUT,
    DCT_TYPE_VIDEO_FILE,
    DCT_TYPE_VIDEO_STREAM,
    DCT_TYPE_VOID_STREAM,
    metaStreamDCTSchema,
    onDemandInputSchema,
    onDemandTextInputSchema,
    videoFileDCTSchema,
    videoStreamDCTSchema,
    voidDCTSchema,
} from './dcts/index.js';

/** @type {SchemaCollection} */
const dctSchemas = {
    [`${DCT_TYPE_VIDEO_STREAM}`]: videoStreamDCTSchema,
    [`${DCT_TYPE_VIDEO_FILE}`]: videoFileDCTSchema,
    [`${DCT_TYPE_META_STREAM}`]: metaStreamDCTSchema,
    [`${DCT_TYPE_VOID_STREAM}`]: voidDCTSchema,
    [`${DCT_TYPE_ON_DEMAND_INPUT}`]: onDemandInputSchema,
    [`${DCT_TYPE_ON_DEMAND_TEXT_INPUT}`]: onDemandTextInputSchema,
};

/** @type {SchemasRepository} */
const schemas = {
    dct: dctSchemas,
    plugins: {},
};

/**
 * The default schemas supported by the SDK.
 *
 * @return {SchemasRepository}
 */
export const defaultSchemas = () => {
    return schemas;
};
