export const DCT_TYPE_VIDEO_FILE = 'VideoFile';

/**
 * The VideoFile schema definition.
 *
 * @type {SchemaDefinition}
 */
export const schema = {
    name: 'Video File',
    description: 'A DCT designed to consume video files.',
    type: DCT_TYPE_VIDEO_FILE,
    fields: [
        {
            key: 'CAP_RESOLUTION',
            type: 'integer',
            label: 'Cap Resolution',
            description: 'The maximum acquisition rate for the instance of DCT',
            default: 20,
            required: true,
            allowedValues: {
                min: 1,
            },
        },
        {
            key: 'DEFAULT_PLUGIN',
            type: 'boolean',
            label: 'Default Plugin',
            description: '',
            default: false,
            required: false,
        },
        {
            key: 'URL',
            type: 'string',
            label: 'URL',
            description: 'The URL of the video stream source.',
            default: null,
            required: true,
        },
        {
            key: 'LIVE_FEED',
            type: 'boolean',
            label: 'Is Live Feed',
            description: 'Flag to signal that the URL provided is of a live feed.',
            default: true,
            required: false,
        },
        {
            key: 'RECONNECTABLE',
            type: 'string',
            label: 'Reconnectable',
            description: 'Describes the behavior when the feed disconnects. Allowed values are YES, NO and KEEPALIVE',
            default: 'YES',
            required: false,
        },
    ],
};
