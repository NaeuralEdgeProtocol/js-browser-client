export const DCT_TYPE_VOID_STREAM = 'VOID';

/**
 * The VoidStream schema definition.
 *
 * @type {SchemaDefinition}
 */
export const schema = {
    name: 'Void',
    description: 'A DCT to be used when no acquisition is necessary.',
    type: DCT_TYPE_VOID_STREAM,
    fields: [
        {
            key: '_CUSTOM_METADATA',
            type: 'object',
            label: 'Metadata',
            description: 'Key-value pairs to be encoded as JSON and attached to the DCT.',
            default: null,
            required: false,
        },
    ],
};
