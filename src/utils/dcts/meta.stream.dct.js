export const DCT_TYPE_META_STREAM = 'MetaStream';

/**
 * The MetaStream schema definition.
 *
 * @type {SchemaDefinition}
 */
export const schema = {
    name: 'Meta Stream',
    description: 'A DCT designed to consume other pipelines.',
    type: DCT_TYPE_META_STREAM,
    fields: [
        {
            key: 'COLLECTED_STREAMS',
            type: 'array(string)',
            label: 'Collected Pipelines',
            description: 'The pipelines to collect.',
            default: [],
            required: true,
        },
        {
            key: 'STREAM_CONFIG_METADATA',
            type: 'string',
            label: 'Metadata',
            description: 'Key-value pairs to be encoded as JSON and attached to the DCT.',
            default: null,
            required: false,
        },
    ],
};
