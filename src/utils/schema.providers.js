import {
    DCT_TYPE_META_STREAM,
    DCT_TYPE_VIDEO_FILE,
    DCT_TYPE_VIDEO_STREAM,
    DCT_TYPE_VOID_STREAM,
    metaStreamDCTSchema,
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
