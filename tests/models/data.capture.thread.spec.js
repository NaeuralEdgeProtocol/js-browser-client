import { beforeEach, describe, expect, test } from '@jest/globals';
import { DCT_TYPE_VIDEO_STREAM } from '../../src/utils/dcts/video.stream.dct.js';
import DataCaptureThread from '../../src/models/data.capture.thread.js';

describe('Data Capture Thread Model Tests', () => {
    let schema;
    let candidateConfig;
    let stats;

    beforeEach(() => {
        schema = {
            name: 'Video Stream',
            description: 'A DCT designed to consume real-time video streams.',
            type: DCT_TYPE_VIDEO_STREAM,
            fields: [
                {
                    key: 'CAP_RESOLUTION',
                    type: 'integer',
                    label: 'Cap Resolution',
                    description: 'The maximum acquisition rate for the instance of DCT',
                    default: 20,
                    required: true,
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
                    description:
                        'Describes the behavior when the feed disconnects. Allowed values are YES, NO and KEEPALIVE',
                    default: 'YES',
                    required: false,
                },
            ],
        };

        candidateConfig = {
            INITIATOR_ID: 'unit-tests',
            NAME: 'test-DCT',
            TYPE: DCT_TYPE_VIDEO_STREAM,
            CAP_RESOLUTION: 24,
            URL: 'http://google.com',
        };

        stats = {
            NOW: '2004-04-24 15:24:30',
            DPS: 24,
            CFG_DPS: 4,
            TGT_DPS: 2004,
            OTHER_INFO: 'here',
        };
    });

    describe('DCT Factory Tests', () => {
        test('Test static factory with valid configuration, no stats, no schema', () => {
            const dctInstance = DataCaptureThread.make(candidateConfig, null);

            expect(dctInstance.config).toEqual(candidateConfig);
            expect(dctInstance.stats).toEqual({});
            expect(dctInstance.isDirty).toEqual(false);
        });

        test('Test static factory adds defaults to dirty instances', () => {
            const dctInstance = DataCaptureThread.make(candidateConfig, null, schema, true);

            expect(dctInstance.config).toEqual({
                ...candidateConfig,
                DEFAULT_PLUGIN: false,
                LIVE_FEED: true,
                RECONNECTABLE: 'YES',
            });
            expect(dctInstance.stats).toEqual({});
            expect(dctInstance.isDirty).toEqual(true);
        });

        test('Test static factory add stats if provided', () => {
            const dctInstance = DataCaptureThread.make(candidateConfig, stats);

            expect(dctInstance.config).toEqual(candidateConfig);
            expect(dctInstance.stats).toEqual(stats);
            expect(dctInstance.isDirty).toEqual(false);
        });

        test('Test static factory add formatMap if provided', () => {
            const dctInstance = DataCaptureThread.make(candidateConfig, stats, schema);

            expect(dctInstance.config).toEqual(candidateConfig);
            expect(dctInstance.stats).toEqual(stats);
            expect(dctInstance.isDirty).toEqual(false);
        });

        test('Test static factory invalid config against schema, missing mandatory fields', () => {
            const invalidConfig = {
                INVALID: true,
            };

            try {
                DataCaptureThread.make(invalidConfig, stats, schema);
            } catch (e) {
                expect(e.message).toEqual(
                    "Mandatory fields are missing from the DCT configuration. Couldn't properly instantiate.",
                );
            }
        });

        test('Test static factory invalid config against schema, invalid fields', () => {
            const modifiedSchema = JSON.parse(JSON.stringify(schema));
            modifiedSchema.fields[0]['allowedValues'] = { min: 0, max: 10 };

            try {
                DataCaptureThread.make(candidateConfig, stats, modifiedSchema);
            } catch (e) {
                expect(e.message).toEqual(
                    'Errors encountered when validating: \n Validation failed for key \'CAP_RESOLUTION\'. Received value 24 of type number. Expected type: integer, Allowed values: {"min":0,"max":10}',
                );
            }
        });
    });

    describe('DCT getConfig() Tests', () => {
        test('getConfig() returns clean config when schema is present', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(candidateConfig));
            modifiedConfig['EXTRA_KEY'] = 'extra-info';

            const dctInstance = DataCaptureThread.make(modifiedConfig, stats, schema);

            expect(dctInstance.getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
        });

        test('getConfig() returns full config when schema is absent', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(candidateConfig));
            modifiedConfig['EXTRA_KEY'] = 'extra-info';

            const dctInstance = DataCaptureThread.make(modifiedConfig, stats);

            expect(dctInstance.getConfig()).toEqual(modifiedConfig);
        });

        test('getConfig() returns clean config with renamed keys when schema and formatter are present', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(candidateConfig));
            modifiedConfig['EXTRA_KEY'] = 'extra-info';

            const dctInstance = DataCaptureThread.make(modifiedConfig, stats, schema);

            expect(dctInstance.getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
        });

        test('getConfig() returns full config with renamed keys when schema is missing but formatter is present', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(candidateConfig));
            modifiedConfig['EXTRA_KEY'] = 'extra-info';

            const dctInstance = DataCaptureThread.make(modifiedConfig, stats, null);

            // TODO: wrong, this should return partially renamed object

            expect(dctInstance.getConfig()).toEqual({
                INITIATOR_ID: 'unit-tests',
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
                EXTRA_KEY: 'extra-info',
                NAME: 'test-DCT',
                TYPE: 'VideoStream',
            });
        });
    });

    describe('DCT updateConfig() Tests', () => {
        test('updateConfig() should update with valid changeset', () => {
            const dctInstance = DataCaptureThread.make(candidateConfig, stats, schema);
            const existingConfig = JSON.parse(JSON.stringify(dctInstance.getConfig()));
            const changeset = {
                CAP_RESOLUTION: 25,
            };

            dctInstance.updateConfig(changeset);

            expect(existingConfig).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
            expect(dctInstance.getConfig()).toEqual({
                CAP_RESOLUTION: 25,
                URL: 'http://google.com',
            });
            expect(dctInstance.isDirty).toEqual(true);
        });

        test('updateConfig() should not update with invalid changeset', () => {
            const modifiedSchema = JSON.parse(JSON.stringify(schema));
            modifiedSchema.fields[0]['allowedValues'] = { min: 0, max: 50 };

            const dctInstance = DataCaptureThread.make(candidateConfig, stats, modifiedSchema);
            const existingConfig = JSON.parse(JSON.stringify(dctInstance.getConfig()));
            const changeset = {
                CAP_RESOLUTION: 2004,
            };

            expect(existingConfig).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });

            try {
                dctInstance.updateConfig(changeset);
            } catch (e) {
                expect(dctInstance.isDirty).toEqual(false);
                expect(e.message).toEqual(
                    'Errors encountered when validating: \n Validation failed for key \'CAP_RESOLUTION\'. Received value 2004 of type number. Expected type: integer, Allowed values: {"min":0,"max":50}',
                );
            }
        });
    });
});
