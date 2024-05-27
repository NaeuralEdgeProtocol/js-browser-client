import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { NODE_COMMAND_UPDATE_PIPELINE_INSTANCE } from '../../src/constants.js';
import { PluginInstance } from '../../src/models/plugin.instance.js';

const VIEW_SCENE_SIGNATURE = 'VIEW_SCENE_01';

describe('Plugin Model Tests', () => {
    let schema, candidateConfig, stats, setup;
    const pipelineName = 'unit-tests-sdk';
    const instanceName = 'view-scene-unit-test';
    const signature = 'VIEW_SCENE_01';
    const pipeline = {
        id: pipelineName,

        node: 'test',

        client: {
            state: {
                getRunningInstanceConfig: async () => {
                    return {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    };
                },
            },

            publish: jest.fn((node, command) => {
                return {
                    node: node,
                    command: command,
                };
            }),
        },

        getClient() {
            return this.client;
        },

        getNode() {
            return this.node;
        },

        getId() {
            return this.id;
        },

        addInstanceWatch: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        schema = {
            name: 'View Scene',
            description: 'This plugin is able to extract an witness image from a video stream or a video file.',
            type: VIEW_SCENE_SIGNATURE,
            fields: [
                {
                    key: 'NR_WITNESSES',
                    type: 'integer',
                    label: 'Witness Count',
                    description: 'Number of iterations before stopping execution.',
                    default: 5,
                    required: true,
                    allowedValues: {
                        min: 1,
                        max: 20,
                    },
                },
                {
                    key: 'PROCESS_DELAY',
                    type: 'float',
                    label: 'Sample Delay',
                    description: 'Timespan between each iteration of the process.',
                    default: 1.5,
                    required: true,
                    allowedValues: null,
                },
            ],
            options: {
                linkable: false,
            },
            dct: {
                fps: 5,
                areaType: 'normal',
                cropRequired: 'false',
            },
        };

        candidateConfig = {
            NR_WITNESSES: 10,
            PROCESS_DELAY: 1.5,
            INSTANCE_ID: instanceName,
        };

        stats = {
            STREAM_ID: pipelineName,
            SIGNATURE: signature,
            INSTANCE_ID: instanceName,
            FREQUENCY: null,
            INIT_TIMESTAMP: '2024-01-29 14:56:27.777640',
            EXEC_TIMESTAMP: '2024-02-05 12:55:03.961437',
            LAST_CONFIG_TIMESTAMP: '2024-01-29 14:56:27.775030',
            FIRST_ERROR_TIME: null,
            LAST_ERROR_TIME: null,
            OUTSIDE_WORKING_HOURS: false,
            CURRENT_PROCESS_ITERATION: 0,
            CURRENT_EXEC_ITERATION: 29185888,
            LAST_PAYLOAD_TIME: '1970-01-01 02:00:00',
            TOTAL_PAYLOAD_COUNT: 0,
            INFO: null,
        };

        setup = {
            dirty: false,
            signature,
            config: candidateConfig,
            stats: stats,
            rawConfig: true,
            id: instanceName,
            schema: schema,
            schedule: [],
            tags: {
                dummy: 'tag',
            },
        };
    });

    describe('Plugin Instance Factory Tests', () => {
        test('Test static factory with valid config, no stats, no schema', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.stats = {};
            modifiedSetup.schema = null;
            modifiedSetup.formatMap = null;

            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
                INSTANCE_ID: instanceName,
            });
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(null);
            expect(pi.getTags()).toEqual({ dummy: 'tag' });
        });

        test('Test static factory with valid config no id, generates id', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.stats = {};
            modifiedSetup.schema = null;
            modifiedSetup.formatMap = null;
            modifiedSetup.id = null;
            delete modifiedSetup.config.INSTANCE_ID;

            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).not.toBeNull();
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(null);
        });

        test('Test static factory with valid config, with stats, no schema', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.schema = null;
            modifiedSetup.formatMap = null;

            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
                INSTANCE_ID: instanceName,
            });
            expect(pi.getInstanceStats()).toEqual(stats);
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(null);
        });

        test('Test static factory with valid config, stats and schema', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.formatMap = null;

            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.getInstanceStats()).toEqual(stats);
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(schema);
        });

        test('Test static factory with valid config, stats, schema, formatter', () => {
            const pi = PluginInstance.make(setup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.getInstanceStats()).toEqual(stats);
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(schema);
        });

        test('Test static factory with valid config, stats, schema, formatter, rawConfig = false', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.rawConfig = false;

            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.getInstanceStats()).toEqual(stats);
            expect(pi.isDirty).toEqual(false);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(schema);
        });

        test('Test static factory with valid config, stats, schema, formatter, marked as dirty', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.dirty = true;
            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.id).toEqual(instanceName);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.getInstanceStats()).toEqual(stats);
            expect(pi.isDirty).toEqual(true);
            expect(pi.pipeline.getId()).toEqual(pipelineName);
            expect(pi.getPipelineId()).toEqual(pipelineName);
            expect(pi.schema).toEqual(schema);
        });

        test('Test static factory invalid config (validation fails), throws', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.config.NR_WITNESSES = 50;

            try {
                PluginInstance.make(modifiedSetup, pipeline);
            } catch (e) {
                expect(e.message).toEqual(
                    'Errors encountered when validating: \n Validation failed for key \'NR_WITNESSES\'. Received value 50 of type number. Expected type: integer, Allowed values: {"min":1,"max":20}',
                );
            }
        });

        test('Test static factory invalid config (missing mandatory fields), throws', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.schema.fields.push({
                key: 'DUMMY_MISSING',
                type: 'integer',
                label: 'Dummy Missing',
                description: 'some description.',
                default: null,
                required: true,
                allowedValues: null,
            });

            try {
                PluginInstance.make(modifiedSetup, pipeline);
            } catch (e) {
                expect(e.message).toEqual(
                    "Mandatory fields are missing from the plugin instance configuration. Couldn't properly instantiate.",
                );
            }
        });
    });

    describe('Plugin Instance getSchema() Tests', () => {
        test('Test getSchema() with formatter', () => {
            const pi = PluginInstance.make(setup, pipeline);

            expect(pi.getSchema()).toEqual({
                name: 'View Scene',
                description: 'This plugin is able to extract an witness image from a video stream or a video file.',
                type: 'VIEW_SCENE_01',
                fields: [
                    {
                        key: 'NR_WITNESSES', // this is not as in the original schema, but transformed
                        type: 'integer',
                        label: 'Witness Count',
                        description: 'Number of iterations before stopping execution.',
                        default: 5,
                        required: true,
                        allowedValues: {
                            min: 1,
                            max: 20,
                        },
                    },
                    {
                        key: 'PROCESS_DELAY', // this is not as in the original schema, but transformed
                        type: 'float',
                        label: 'Sample Delay',
                        description: 'Timespan between each iteration of the process.',
                        default: 1.5,
                        required: true,
                        allowedValues: null,
                    },
                ],
                options: { linkable: false },
                dct: { fps: 5, areaType: 'normal', cropRequired: 'false' },
            });
        });

        test('Test getSchema(raw = true) with formatter', () => {
            const pi = PluginInstance.make(setup, pipeline);
            expect(pi.getSchema(true)).toEqual(schema);
        });

        test('Test getSchema() without any formatter', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.formatMap = null;
            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.getSchema()).toEqual(schema);
        });

        test('Test getSchema() without any schema returns null', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.schema = null;
            const pi = PluginInstance.make(modifiedSetup, pipeline);

            expect(pi.getSchema()).toEqual(null);
        });
    });

    describe('Plugin Instance getConfig() Tests', () => {
        test('Test getConfig() with formatter', () => {
            const pi = PluginInstance.make(setup, pipeline);

            expect(pi.getConfig()).toEqual({
                PROCESS_DELAY: 1.5,
                NR_WITNESSES: 10,
            });

            expect(pi.getConfig()).not.toEqual(pi.config);
        });

        test('Test getConfig() without formatter returns clean raw config', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.formatMap = null;
            const pi = PluginInstance.make(modifiedSetup, pipeline);
            const rawConfig = pi.config;
            delete rawConfig.INSTANCE_ID;

            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
            expect(pi.getConfig()).toEqual(rawConfig);
        });

        test('Test getConfig() without any formatter or schema', () => {
            const modifiedSetup = JSON.parse(JSON.stringify(setup));
            modifiedSetup.formatMap = null;
            modifiedSetup.schema = null;
            const pi = PluginInstance.make(modifiedSetup, pipeline);
            const rawConfig = pi.config;

            expect(pi.getConfig()).toEqual(candidateConfig);
            expect(pi.getConfig()).toEqual(rawConfig);
        });
    });

    test('Test makeUpdateInstancePayload()', async () => {
        const pi = PluginInstance.make(setup, pipeline);

        expect(await pi.makeUpdateInstancePayload()).toEqual({
            NAME: pipelineName,
            INSTANCE_ID: instanceName,
            SIGNATURE: signature,
            INSTANCE_CONFIG: {
                ID_TAGS: {
                    dummy: 'tag',
                },
                INSTANCE_ID: instanceName,
                NR_WITNESSES: 10,
                WORKING_HOURS: [],
            },
        });
    });

    test('Test getRawInstanceCommandPayload()', () => {
        const pi = PluginInstance.make(setup, pipeline);
        const testCommand = {
            test: 'command',
        };

        expect(pi.getRawInstanceCommandPayload(testCommand)).toEqual({
            PAYLOAD: {
                NAME: pipelineName,
                INSTANCE_ID: instanceName,
                SIGNATURE: signature,
                INSTANCE_CONFIG: {
                    INSTANCE_COMMAND: testCommand,
                },
            },
            ACTION: NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
        });
    });

    test('Test sendCommand()', () => {
        const pi = PluginInstance.make(setup, pipeline);
        const testCommand = {
            test: 'command',
        };
        const expectedComand = pi.getRawInstanceCommandPayload(testCommand);
        const publishSpy = jest.spyOn(pipeline.client, 'publish');

        pi.sendCommand(testCommand);

        expect(publishSpy).toHaveBeenCalledWith(pipeline.node, expectedComand);
    });

    describe('Plugin Instance updateConfig() Tests', () => {
        test('Valid update', () => {
            const pi = PluginInstance.make(setup, pipeline);
            const update = {
                NR_WITNESSES: 4,
            };
            const addInstanceWatchSpy = jest.spyOn(pipeline, 'addInstanceWatch');

            pi.updateConfig(update);

            expect(addInstanceWatchSpy).toHaveBeenCalledWith([pipeline.node, pipelineName, signature, instanceName]);

            expect(pi.isDirty).toEqual(true);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 4,
                PROCESS_DELAY: 1.5,
            });
        });

        test('Invalid update', () => {
            const pi = PluginInstance.make(setup, pipeline);
            const update = {
                NR_WITNESSES: 2004,
            };
            const addInstanceWatchSpy = jest.spyOn(pipeline, 'addInstanceWatch');

            try {
                pi.updateConfig(update);
            } catch (e) {
                expect(e.message).toEqual(
                    'Errors encountered when validating: \n Validation failed for key \'NR_WITNESSES\'. Received value 2004 of type number. Expected type: integer, Allowed values: {"min":1,"max":20}',
                );
            }

            expect(addInstanceWatchSpy).not.toHaveBeenCalled();
            expect(pi.isDirty).toEqual(false);
            expect(pi.getConfig()).toEqual({
                NR_WITNESSES: 10,
                PROCESS_DELAY: 1.5,
            });
        });
    });

    describe('Plugin Instance Tags Tests', () => {
        test('Tags passed via setup object should be accessible', () => {
            const pi = PluginInstance.make(
                {
                    ...setup,
                    tags: {
                        color: 'blue',
                    },
                },
                pipeline,
            );

            expect(pi.getTags()).toEqual({ color: 'blue' });
        });

        test('addTag should add a new tag', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            expect(pi.getTags()).toEqual({ color: 'blue', dummy: 'tag' });
        });

        test('addTag should overwrite an existing tag', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            pi.addTag('color', 'red');
            expect(pi.getTags()).toEqual({ color: 'red', dummy: 'tag' });
        });

        test('removeTag should remove an existing tag', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            pi.removeTag('color');
            expect(pi.getTags()).toEqual({ dummy: 'tag' });
        });

        test('removeTag should do nothing if the tag does not exist', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            pi.removeTag('size'); // Non-existent tag
            expect(pi.getTags()).toEqual({ color: 'blue', dummy: 'tag' });
        });

        test('getTags should return all tags', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            pi.addTag('size', 'large');
            expect(pi.getTags()).toEqual({ color: 'blue', size: 'large', dummy: 'tag' });
        });

        test('resetTags should reset all tags to an empty object', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            pi.resetTags();
            expect(pi.getTags()).toEqual({});
        });

        test('bulkSetTags should set multiple tags at once', () => {
            const pi = PluginInstance.make(setup, pipeline);
            const newTags = { color: 'blue', size: 'large' };

            pi.bulkSetTags(newTags);
            expect(pi.getTags()).toEqual(newTags);
        });

        test('bulkSetTags should replace existing tags', () => {
            const pi = PluginInstance.make(setup, pipeline);

            pi.addTag('color', 'blue');
            const newTags = { material: 'cotton' };
            pi.bulkSetTags(newTags);
            expect(pi.getTags()).toEqual({ material: 'cotton' });
        });
    });

    describe('PluginInstance Schedule Management', () => {
        let pluginInstance;

        beforeEach(() => {
            pluginInstance = PluginInstance.make(setup, pipeline);
        });

        test('setSchedule should correctly set a uniform schedule for all days', () => {
            const uniformSchedule = [['09:00', '17:00']];
            pluginInstance.setSchedule(uniformSchedule);
            expect(pluginInstance.getSchedule()).toEqual(uniformSchedule);
        });

        test('setSchedule should correctly set a separate schedule for each day', () => {
            const detailedSchedule = {
                MON: [['09:00', '12:00']],
                TUE: [['10:00', '14:00']],
            };
            pluginInstance.setSchedule(detailedSchedule);
            expect(pluginInstance.getSchedule()).toEqual(detailedSchedule);
        });

        describe('_validateSchedule() Tests', () => {
            test('should return true for a valid non-stop schedule', () => {
                const schedule = [];
                expect(pluginInstance._validateSchedule(schedule)).toBe(true);
            });

            test('should return true for a valid uniform schedule', () => {
                const schedule = [['09:00', '17:00']];
                expect(pluginInstance._validateSchedule(schedule)).toBe(true);
            });

            test('should return true for a valid detailed schedule', () => {
                const schedule = {
                    MON: [['09:00', '12:00']],
                    TUE: [['10:00', '14:00']],
                };
                expect(pluginInstance._validateSchedule(schedule)).toBe(true);
            });

            test('should throw for an invalid parameter type', () => {
                const invalidSchedule = 'not-an-array';
                expect(() => pluginInstance._validateSchedule(invalidSchedule)).toThrow(
                    'Invalid schedule type: Schedule must be either an array or an object.',
                );
            });

            test('should throw for an invalid schedule format', () => {
                const invalidSchedule = ['09:00-12:00'];
                expect(() => pluginInstance._validateSchedule(invalidSchedule)).toThrow(
                    'Invalid schedule format: Each interval must be an array of two valid times.',
                );
            });

            test('should throw for an invalid schedule format when setting up weekly schedule', () => {
                const invalidSchedule = [['09:00-12:00']];
                expect(() => pluginInstance._validateSchedule(invalidSchedule)).toThrow(
                    'Invalid schedule format: Each interval must be an array of two valid times.',
                );
            });

            test('should throw for an invalid schedule format when setting up daily schedule', () => {
                const invalidSchedule = { MON: '09:00-12:00' };
                expect(() => pluginInstance._validateSchedule(invalidSchedule)).toThrow(
                    'Invalid schedule format for MON: Each interval must be an array of two valid times.',
                );
            });

            test('should throw for incorrect day keys', () => {
                const invalidSchedule = { MOON: [['09:00', '12:00']] };
                expect(() => pluginInstance._validateSchedule(invalidSchedule)).toThrow(
                    'Invalid schedule day: MOON is not a valid day of the week.',
                );
            });
        });
    });
});
