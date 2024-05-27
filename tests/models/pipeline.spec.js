import { beforeEach, describe, expect, test, jest } from '@jest/globals';
import { defaultSchemas } from '../../src/utils/schema.providers.js';
import Pipeline from '../../src/models/pipeline.js';
import { PluginInstance } from '../../src/models/plugin.instance.js';
import NodeManager from '../../src/models/node.manager.js';
import { DCT_TYPE_VIDEO_STREAM } from '../../src/utils/dcts/video.stream.dct.js';

const VIEW_SCENE_SIGNATURE = 'VIEW_SCENE_01';

describe('Pipeline Model Tests', () => {
    const testInstanceName = 'test-instance';
    const testPipelineName = 'unit-tests';
    const instanceCandidateConfig = {
        NR_WITNESSES: 5,
        PROCESS_DELAY: 1.5,
        INSTANCE_ID: testInstanceName,
    };
    let schemas;
    let mockClient = {
        state: {
            getRunningInstanceConfig: async () => {
                return {
                    NR_WITNESSES: 15,
                    PROCESS_DELAY: 1.5,
                };
            },
        },
        publish: jest.fn(),
    };
    let config;
    let node = 'test-node';

    const pluginSchemas = {
        [`${VIEW_SCENE_SIGNATURE}`]: {
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
        },
    };

    beforeEach(() => {
        schemas = defaultSchemas();
        schemas.plugins = pluginSchemas;
        config = {
            config: {
                INITIATOR_ID: 'unit-tests',
                NAME: testPipelineName,
                TYPE: DCT_TYPE_VIDEO_STREAM,
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            },
            stats: null,
            plugins: [],
        };

        jest.resetAllMocks();
    });

    describe('Pipeline Factory Tests', () => {
        test('Test static factory with valid configuration, as from heartbeat info', () => {
            const pipeline = Pipeline.make(mockClient, node, config, schemas);

            expect(pipeline.id).toEqual(config.config.NAME);
            expect(pipeline.getId()).toEqual(config.config.NAME);
            expect(pipeline.initiator).toEqual(config.config.INITIATOR_ID);
            expect(pipeline.getInitiator()).toEqual(config.config.INITIATOR_ID);
            expect(pipeline.node).toEqual(node);
            expect(pipeline.getNode()).toEqual(node);
            expect(pipeline.instances).toEqual([]);
            expect(pipeline.isDirty).toEqual(false);
            expect(pipeline.dct.getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
            expect(pipeline.getInstanceWatches()).toEqual([]);
        });

        test('Test static factory with valid configuration w/ plugin, as from heartbeat info', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(config));
            modifiedConfig.plugins = {
                [`${VIEW_SCENE_SIGNATURE}`]: {
                    [`${testInstanceName}`]: {
                        config: instanceCandidateConfig,
                        stats: {},
                    },
                },
            };

            const pipeline = Pipeline.make(mockClient, node, modifiedConfig, schemas);

            expect(pipeline.id).toEqual(config.config.NAME);
            expect(pipeline.getId()).toEqual(config.config.NAME);
            expect(pipeline.initiator).toEqual(config.config.INITIATOR_ID);
            expect(pipeline.getInitiator()).toEqual(config.config.INITIATOR_ID);
            expect(pipeline.node).toEqual(node);
            expect(pipeline.getNode()).toEqual(node);
            expect(pipeline.instances.length).toEqual(1);
            expect(pipeline.isDirty).toEqual(false);
            expect(pipeline.getDataCaptureThread().getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
            expect(pipeline.dct.getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            });
            expect(pipeline.getInstanceWatches()).toEqual([]);
        });

        test('Test static factory with valid configuration, as from newly created pipeline', () => {
            const pipeline = Pipeline.make(mockClient, node, config, schemas, true);

            expect(pipeline.id).toEqual(config.config.NAME);
            expect(pipeline.initiator).toEqual(config.config.INITIATOR_ID);
            expect(pipeline.instances).toEqual([]);
            expect(pipeline.isDirty).toEqual(false);
            expect(pipeline.dct.isDirty).toEqual(true);
            expect(pipeline.dct.getConfig()).toEqual({
                CAP_RESOLUTION: 24,
                LIVE_FEED: true,
                RECONNECTABLE: 'YES',
                URL: 'http://google.com',
            });
        });

        test('Test static factory with invalid configuration, fails', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(config));
            modifiedConfig.config.CAP_RESOLUTION = -24;

            try {
                Pipeline.make(mockClient, node, modifiedConfig, schemas);
            } catch (e) {
                expect(e.message).toEqual(
                    'Errors encountered when validating: \n Validation failed for key \'CAP_RESOLUTION\'. Received value -24 of type number. Expected type: integer, Allowed values: {"min":1}',
                );
            }
        });
    });

    describe('Pipeline Instances', () => {
        test('Modifying Instance, adds Instance Watch', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(config));
            modifiedConfig.plugins = {
                [`${VIEW_SCENE_SIGNATURE}`]: {
                    [`${testInstanceName}`]: {
                        config: {
                            NR_WITNESSES: 5,
                            PROCESS_DELAY: 1.5,
                            INSTANCE_ID: testInstanceName,
                        },
                        stats: {},
                    },
                },
            };

            const pipeline = Pipeline.make(mockClient, node, modifiedConfig, schemas);
            const instance = pipeline.instances.filter((instance) => instance.id === testInstanceName).pop();
            const addInstanceWatchSpy = jest.spyOn(pipeline, 'addInstanceWatch');

            instance.updateConfig({ NR_WITNESSES: 15 });
            expect(instance.getConfig()).toEqual({
                NR_WITNESSES: 15,
                PROCESS_DELAY: 1.5,
            });

            expect(addInstanceWatchSpy).toHaveBeenCalledWith([
                node,
                testPipelineName,
                VIEW_SCENE_SIGNATURE,
                testInstanceName,
            ]);

            expect(pipeline.getInstanceWatches()).toEqual([
                [node, testPipelineName, VIEW_SCENE_SIGNATURE, testInstanceName],
            ]);

            expect(pipeline.isDirty).toEqual(false);
            expect(instance.isDirty).toEqual(true);
        });

        test('Adding Instance, adds Instance Watch', () => {
            const pipeline = Pipeline.make(mockClient, node, config, schemas);
            const addInstanceWatchSpy = jest.spyOn(pipeline, 'addInstanceWatch');
            const instance = PluginInstance.make({
                dirty: false,
                signature: VIEW_SCENE_SIGNATURE,
                config: instanceCandidateConfig,
                stats: {},
                rawConfig: true,
                id: testInstanceName,
                forcedPause: false,
                schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                schedule: [],
                tags: {},
            });

            NodeManager.attachPluginInstanceToPipeline(pipeline, instance);

            expect(addInstanceWatchSpy).toHaveBeenCalledWith([
                node,
                testPipelineName,
                VIEW_SCENE_SIGNATURE,
                testInstanceName,
            ]);

            expect(pipeline.getInstanceWatches()).toEqual([
                [node, testPipelineName, VIEW_SCENE_SIGNATURE, testInstanceName],
            ]);

            expect(pipeline.isDirty).toEqual(true);
        });

        test('Adding existing instance throws', () => {
            const modifiedConfig = JSON.parse(JSON.stringify(config));
            modifiedConfig.plugins = {
                [`${VIEW_SCENE_SIGNATURE}`]: {
                    [`${testInstanceName}`]: {
                        config: {
                            NR_WITNESSES: 5,
                            PROCESS_DELAY: 1.5,
                            INSTANCE_ID: testInstanceName,
                        },
                        stats: {},
                    },
                },
            };

            const pipeline = Pipeline.make(mockClient, node, modifiedConfig, schemas);
            const addInstanceWatchSpy = jest.spyOn(pipeline, 'addInstanceWatch');
            const instance = PluginInstance.make({
                dirty: false,
                signature: VIEW_SCENE_SIGNATURE,
                config: instanceCandidateConfig,
                stats: {},
                rawConfig: true,
                id: testInstanceName,
                forcedPause: false,
                schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                schedule: [],
                tags: {},
            });

            try {
                NodeManager.attachPluginInstanceToPipeline(pipeline, instance);
            } catch (e) {
                expect(e.message).toEqual(
                    `Instance ${testInstanceName} is already associated with ${testPipelineName} on ${node}. Please update instead of recreating.`,
                );
            }

            expect(addInstanceWatchSpy).not.toHaveBeenCalled();

            expect(pipeline.getInstanceWatches()).toEqual([]);
            expect(pipeline.isDirty).toEqual(false);
        });

        test('Can add/remove Instance Watch', () => {
            const pipeline = Pipeline.make(mockClient, node, config, schemas);

            expect(pipeline.getInstanceWatches()).toEqual([]);

            pipeline.addInstanceWatch(['node', 'pipeline1', 'signature1', 'instance1']);
            pipeline.addInstanceWatch(['node', 'pipeline2', 'signature2', 'instance2']);

            expect(pipeline.getInstanceWatches()).toEqual([
                ['node', 'pipeline1', 'signature1', 'instance1'],
                ['node', 'pipeline2', 'signature2', 'instance2'],
            ]);

            pipeline.removeInstanceWatch(['node', 'pipeline2', 'signature2', 'instance2']);

            expect(pipeline.getInstanceWatches()).toEqual([['node', 'pipeline1', 'signature1', 'instance1']]);

            pipeline.removeAllInstanceWatches();

            expect(pipeline.getInstanceWatches()).toEqual([]);
        });
    });
});
