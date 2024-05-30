export const DCT_TYPE_ON_DEMAND_TEXT_INPUT = 'OnDemandTextInput';

/**
 * The VideoFile schema definition.
 *
 * @type {SchemaDefinition}
 */
export const schema = {
    name: 'On Demand Text Input',
    description: 'A DCT designed to wrap on-demand text input models.',
    type: DCT_TYPE_ON_DEMAND_TEXT_INPUT,
    fields: [
        {
            key: 'CAP_RESOLUTION',
            type: 'integer',
            label: 'Cap Resolution',
            description: 'The maximum acquisition rate for the instance of DCT',
            default: 1,
            required: true,
        },
        {
            key: 'STREAM_CONFIG_METADATA',
            type: 'object',
            label: 'Metadata',
            description: 'Config object to be attached to the DCT.',
            default: {},
            required: false,
        },
    ],
};
