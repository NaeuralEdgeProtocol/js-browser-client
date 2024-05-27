import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { PluginInstance } from '../../src/models/plugin.instance.js';
import {
    NODE_COMMAND_ARCHIVE_CONFIG,
    NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_PIPELINE_COMMAND,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
} from '../../src/constants.js';
import NodeManager from '../../src/models/node.manager.js';
import { defaultSchemas } from '../../src/utils/schema.providers.js';
import { DCT_TYPE_VIDEO_STREAM } from '../../src/utils/dcts';

const LINKABLE_SIGNATURE = 'LINKABLE_SIGNATURE';
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
    let mockNodeInfo = {
        data: {
            pipelines: {
                existing: {
                    config: {
                        INITIATOR_ID: 'unit-tests',
                        NAME: 'existing',
                        TYPE: DCT_TYPE_VIDEO_STREAM,
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                    },
                    stats: null,
                    plugins: [],
                },
                forLinking: {
                    config: {
                        INITIATOR_ID: 'unit-tests',
                        NAME: 'forLinking',
                        TYPE: DCT_TYPE_VIDEO_STREAM,
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                    },
                    stats: null,
                    plugins: [],
                },
            },
        },
    };

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

    let mockClient = {
        state: {
            getRunningInstanceConfig: async () => {
                return {
                    NR_WITNESSES: 15,
                    PROCESS_DELAY: 1.5,
                };
            },
            getNodeInfo: async () => mockNodeInfo,
        },
        publish: jest.fn(),
    };

    let mockLogger = {
        log: jest.fn(),
    };

    let config;
    let node = 'test-node';
    let nodeManager;

    beforeEach(() => {
        schemas = defaultSchemas();
        schemas.plugins = pluginSchemas;

        config = {
            type: DCT_TYPE_VIDEO_STREAM,
            config: {
                CAP_RESOLUTION: 24,
                URL: 'http://google.com',
            },
        };

        mockClient.schemas = schemas;
        mockClient.bootOptions = {};
        mockClient.bootOptions.initiator = 'mock-initiator';

        nodeManager = NodeManager.getNodeManager(mockClient, node, mockLogger);

        jest.resetAllMocks();
    });

    describe('Pipeline Operations', () => {
        test('Create pipeline, no instance, triggers UPDATE_CONFIG', async () => {
            const pipeline = await nodeManager.createPipeline(config, testPipelineName);
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: {
                        NAME: 'unit-tests',
                        TYPE: 'VideoStream',
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                        DEFAULT_PLUGIN: false,
                        LIVE_FEED: true,
                        RECONNECTABLE: 'YES',
                        PLUGINS: [],
                    },
                },
                [],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Create pipeline, add instance, triggers UPDATE_CONFIG', async () => {
            const pipeline = await nodeManager.createPipeline(config, testPipelineName);
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');
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

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: {
                        NAME: 'unit-tests',
                        TYPE: 'VideoStream',
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                        DEFAULT_PLUGIN: false,
                        LIVE_FEED: true,
                        RECONNECTABLE: 'YES',
                        PLUGINS: [
                            {
                                INSTANCES: [
                                    {
                                        INSTANCE_ID: testInstanceName,
                                        NR_WITNESSES: 5,
                                        PROCESS_DELAY: 1.5,
                                        WORKING_HOURS: [],
                                    },
                                ],
                                SIGNATURE: VIEW_SCENE_SIGNATURE,
                            },
                        ],
                    },
                },
                [[node, testPipelineName, VIEW_SCENE_SIGNATURE, testInstanceName]],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Existing pipeline, attach instance, triggers UPDATE_CONFIG', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
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
                'existing',
                VIEW_SCENE_SIGNATURE,
                testInstanceName,
            ]);

            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: {
                        NAME: 'existing',
                        TYPE: 'VideoStream',
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                        PLUGINS: [
                            {
                                INSTANCES: [
                                    {
                                        INSTANCE_ID: testInstanceName,
                                        NR_WITNESSES: 5,
                                        PROCESS_DELAY: 1.5,
                                        WORKING_HOURS: [],
                                    },
                                ],
                                SIGNATURE: VIEW_SCENE_SIGNATURE,
                            },
                        ],
                    },
                },
                [[node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName]],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Existing pipeline, modify instance, triggers INSTANCE_UPDATE', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            const existingInstance = PluginInstance.make(
                {
                    dirty: false,
                    signature: VIEW_SCENE_SIGNATURE,
                    config: {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    },
                    stats: {},
                    rawConfig: true,
                    id: testInstanceName,
                    schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                    tags: {},
                    schedule: [],
                },
                pipeline,
            );
            pipeline.instances.push(existingInstance);
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');
            const instance = await nodeManager.getPluginInstance(pipeline, testInstanceName);

            nodeManager.updateInstance(instance, {
                NR_WITNESSES: 17,
            });

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
                    PAYLOAD: {
                        NAME: 'existing',
                        INSTANCE_ID: testInstanceName,
                        SIGNATURE: VIEW_SCENE_SIGNATURE,
                        INSTANCE_CONFIG: {
                            NR_WITNESSES: 17,
                            WORKING_HOURS: [],
                        },
                    },
                },
                [[node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName]],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Existing pipeline, modify multiple instances, triggers BATCH_INSTANCE_UPDATE', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            pipeline.instances.push(
                PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 10,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: testInstanceName,
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                ),
            );
            pipeline.instances.push(
                PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 11,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: `${testInstanceName}-2`,
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                ),
            );

            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');
            const instance1 = await nodeManager.getPluginInstance('existing', testInstanceName);
            const instance2 = await nodeManager.getPluginInstance('existing', `${testInstanceName}-2`);

            await nodeManager.updateInstance(instance1, {
                NR_WITNESSES: 18,
            });
            await nodeManager.updateInstance(instance2, {
                NR_WITNESSES: 19,
            });

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
                    PAYLOAD: [
                        {
                            NAME: 'existing',
                            INSTANCE_ID: testInstanceName,
                            SIGNATURE: VIEW_SCENE_SIGNATURE,
                            INSTANCE_CONFIG: {
                                NR_WITNESSES: 18,
                                WORKING_HOURS: [],
                            },
                        },
                        {
                            NAME: 'existing',
                            INSTANCE_ID: `${testInstanceName}-2`,
                            SIGNATURE: VIEW_SCENE_SIGNATURE,
                            INSTANCE_CONFIG: {
                                NR_WITNESSES: 19,
                                WORKING_HOURS: [],
                            },
                        },
                    ],
                },
                [
                    [node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName],
                    [node, 'existing', VIEW_SCENE_SIGNATURE, `${testInstanceName}-2`],
                ],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Existing pipeline, modify one instance and add another triggers UPDATE_CONFIG', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            pipeline.instances.push(
                PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 10,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: testInstanceName,
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                ),
            );
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');
            const existingInstance = pipeline.instances.filter((instance) => instance.id === testInstanceName).pop();

            nodeManager.updateInstance(existingInstance, {
                NR_WITNESSES: 17,
            });

            const addedInstance = PluginInstance.make({
                dirty: false,
                signature: VIEW_SCENE_SIGNATURE,
                config: instanceCandidateConfig,
                stats: {},
                rawConfig: true,
                id: 'added-instance',
                forcedPause: false,
                schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                schedule: [],
                tags: {},
            });

            NodeManager.attachPluginInstanceToPipeline(pipeline, addedInstance);

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: {
                        NAME: 'existing',
                        TYPE: 'VideoStream',
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                        PLUGINS: [
                            {
                                INSTANCES: [
                                    {
                                        INSTANCE_ID: testInstanceName,
                                        NR_WITNESSES: 17,
                                        PROCESS_DELAY: 1.5,
                                        WORKING_HOURS: [],
                                    },
                                    {
                                        INSTANCE_ID: 'added-instance',
                                        NR_WITNESSES: 5,
                                        PROCESS_DELAY: 1.5,
                                        WORKING_HOURS: [],
                                    },
                                ],
                                SIGNATURE: VIEW_SCENE_SIGNATURE,
                            },
                        ],
                    },
                },
                [
                    [node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName],
                    [node, 'existing', VIEW_SCENE_SIGNATURE, 'added-instance'],
                ],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        describe('Removing Instances', () => {
            test('Existing pipeline, remove instance, triggers UPDATE_CONFIG', async () => {
                const pipeline = await nodeManager.getPipeline('existing');
                const existingInstance = PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 15,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: 'existing-instance',
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                );
                pipeline.instances.push(existingInstance);

                const publishSpy = jest.spyOn(mockClient, 'publish');
                const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');

                await nodeManager.removePluginInstance(pipeline, existingInstance);
                await nodeManager.commit();

                expect(publishSpy).toHaveBeenCalledWith(
                    node,
                    {
                        ACTION: NODE_COMMAND_UPDATE_CONFIG,
                        PAYLOAD: {
                            NAME: 'existing',
                            TYPE: 'VideoStream',
                            CAP_RESOLUTION: 24,
                            URL: 'http://google.com',
                            PLUGINS: [],
                        },
                    },
                    [],
                );
                expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
            });

            test('Removing Existing Instance', async () => {
                const pipeline = await nodeManager.getPipeline('existing');
                const existingInstance = PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 15,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: testInstanceName,
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                );
                pipeline.instances.push(existingInstance);

                const instance = await nodeManager.getPluginInstance(pipeline, testInstanceName);
                const removeInstanceWatchSpy = jest.spyOn(pipeline, 'removeInstanceWatch');

                // This should be removed by removing the instance from the pipeline
                pipeline.addInstanceWatch([node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName]);

                nodeManager.removePluginInstance(pipeline, instance);

                expect(removeInstanceWatchSpy).toHaveBeenCalledWith([
                    node,
                    'existing',
                    VIEW_SCENE_SIGNATURE,
                    testInstanceName,
                ]);

                expect(pipeline.getInstanceWatches()).toEqual([]);
                expect(pipeline.isDirty).toEqual(true);
            });

            test('Removing Nonexisting Instance', async () => {
                const pipeline = await nodeManager.getPipeline('existing');
                const nonExistingInstance = PluginInstance.make(
                    {
                        dirty: false,
                        signature: VIEW_SCENE_SIGNATURE,
                        config: {
                            NR_WITNESSES: 15,
                            PROCESS_DELAY: 1.5,
                        },
                        stats: {},
                        rawConfig: true,
                        id: testInstanceName,
                        schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                        tags: {},
                        schedule: [],
                    },
                    pipeline,
                );

                const removeInstanceWatchSpy = jest.spyOn(pipeline, 'removeInstanceWatch');
                pipeline.addInstanceWatch([node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName]);

                await nodeManager.removePluginInstance(pipeline, nonExistingInstance);

                expect(removeInstanceWatchSpy).not.toHaveBeenCalled();
                expect(pipeline.getInstanceWatches()).toEqual([
                    [node, 'existing', VIEW_SCENE_SIGNATURE, testInstanceName],
                ]);
                expect(pipeline.isDirty).toEqual(false);
            });
        });

        test('Existing pipeline, modify DCT triggers UPDATE_CONFIG', async () => {
            // TODO: also modify dct config
            const pipeline = await nodeManager.getPipeline('existing');
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const removeAllInstanceWatchesSpy = jest.spyOn(pipeline, 'removeAllInstanceWatches');

            await nodeManager.updatePipelineMetadata(pipeline, {
                dummy: 'value',
            });

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: {
                        NAME: 'existing',
                        TYPE: 'VideoStream',
                        CAP_RESOLUTION: 24,
                        URL: 'http://google.com',
                        PLUGINS: [],
                        STREAM_CONFIG_METADATA: {
                            dummy: 'value',
                        },
                    },
                },
                [],
            );
            expect(removeAllInstanceWatchesSpy).toHaveBeenCalled();
        });

        test('Close pipeline, triggers ARCHIVE_CONFIG', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            const publishSpy = jest.spyOn(mockClient, 'publish');

            await nodeManager.closePipeline(pipeline);
            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(node, {
                ACTION: NODE_COMMAND_ARCHIVE_CONFIG,
                PAYLOAD: 'existing',
            });
        });

        test('Instance Command, triggers INSTANCE_UPDATE', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            const existingInstance = PluginInstance.make(
                {
                    dirty: false,
                    signature: VIEW_SCENE_SIGNATURE,
                    config: {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    },
                    stats: {},
                    rawConfig: true,
                    id: testInstanceName,
                    schema: schemas.plugins[VIEW_SCENE_SIGNATURE],
                    tags: {},
                    schedule: [],
                },
                pipeline,
            );
            pipeline.instances.push(existingInstance);
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const instance = await nodeManager.getPluginInstance(pipeline, testInstanceName);

            instance.sendCommand({
                test: 'command',
            });

            expect(publishSpy).toHaveBeenCalledWith(node, {
                ACTION: NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
                PAYLOAD: {
                    NAME: 'existing',
                    SIGNATURE: VIEW_SCENE_SIGNATURE,
                    INSTANCE_ID: testInstanceName,
                    INSTANCE_CONFIG: {
                        INSTANCE_COMMAND: {
                            __COMMAND_ID: expect.any(String),
                            test: 'command',
                        },
                    },
                },
            });
        });

        test('Pipeline Command, triggers PIPELINE_COMMAND', async () => {
            const pipeline = await nodeManager.getPipeline('existing');
            const publishSpy = jest.spyOn(mockClient, 'publish');

            pipeline.sendCommand({
                test: 'command',
            });

            expect(publishSpy).toHaveBeenCalledWith(node, {
                ACTION: NODE_COMMAND_PIPELINE_COMMAND,
                PAYLOAD: {
                    NAME: 'existing',
                    PIPELINE_COMMAND: {
                        __COMMAND_ID: expect.any(String),
                        test: 'command',
                    },
                },
            });
        });
    });

    describe('Instance Linking', () => {
        beforeEach(() => {
            mockClient.schemas.plugins[`${LINKABLE_SIGNATURE}`] = {
                name: 'Linkable Plugin',
                description: 'Dummy description',
                type: LINKABLE_SIGNATURE,
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
                    linkable: true,
                },
                dct: {
                    fps: 5,
                    areaType: 'normal',
                    cropRequired: 'false',
                },
            };
        });

        test('Linking new instances', async () => {
            const publishSpy = jest.spyOn(mockClient, 'publish');
            const pipeline1 = await nodeManager.getPipeline('existing');
            const existingInstance1 = PluginInstance.make(
                {
                    dirty: false,
                    signature: LINKABLE_SIGNATURE,
                    config: {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    },
                    stats: {},
                    rawConfig: true,
                    id: 'instance-one',
                    schema: schemas.plugins[LINKABLE_SIGNATURE],
                    tags: {},
                    schedule: [],
                },
                pipeline1,
            );
            pipeline1.instances.push(existingInstance1);

            const pipeline2 = await nodeManager.getPipeline('forLinking');
            const existingInstance2 = PluginInstance.make(
                {
                    dirty: false,
                    signature: LINKABLE_SIGNATURE,
                    config: {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    },
                    stats: {},
                    rawConfig: true,
                    id: 'instance-two',
                    schema: schemas.plugins[LINKABLE_SIGNATURE],
                    tags: {},
                    schedule: [],
                },
                pipeline2,
            );
            pipeline2.instances.push(existingInstance2);
            const existingInstance3 = PluginInstance.make(
                {
                    dirty: false,
                    signature: LINKABLE_SIGNATURE,
                    config: {
                        NR_WITNESSES: 15,
                        PROCESS_DELAY: 1.5,
                    },
                    stats: {},
                    rawConfig: true,
                    id: 'instance-three',
                    schema: schemas.plugins[LINKABLE_SIGNATURE],
                    tags: {},
                    schedule: [],
                },
                pipeline2,
            );
            pipeline2.instances.push(existingInstance3);

            expect(existingInstance1.isLinked()).toEqual(false);
            expect(existingInstance2.isLinked()).toEqual(false);
            expect(existingInstance3.isLinked()).toEqual(false);
            expect(existingInstance1.isLinkable()).toEqual(true);
            expect(existingInstance2.isLinkable()).toEqual(true);
            expect(existingInstance3.isLinkable()).toEqual(true);

            await nodeManager.linkInstances([existingInstance1, existingInstance2, existingInstance3]);

            expect(existingInstance1.getLinkedInstances()).toEqual([
                'forLinking:instance-two',
                'forLinking:instance-three',
            ]);
            expect(existingInstance1.getCollectorInstance()).toEqual(null);
            expect(existingInstance1.isCollecting()).toEqual(true);
            expect(existingInstance1.isCollected()).toEqual(false);
            expect(existingInstance1.isLinked()).toEqual(true);

            expect(existingInstance2.getLinkedInstances()).toEqual([]);
            expect(existingInstance2.getCollectorInstance()).toEqual('existing:instance-one');
            expect(existingInstance2.isCollecting()).toEqual(false);
            expect(existingInstance2.isCollected()).toEqual(true);
            expect(existingInstance2.isLinked()).toEqual(true);

            expect(existingInstance3.getLinkedInstances()).toEqual([]);
            expect(existingInstance3.getCollectorInstance()).toEqual('existing:instance-one');
            expect(existingInstance3.isCollecting()).toEqual(false);
            expect(existingInstance3.isCollected()).toEqual(true);
            expect(existingInstance3.isLinked()).toEqual(true);

            await nodeManager.commit();

            expect(publishSpy).toHaveBeenCalledWith(
                node,
                {
                    ACTION: NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
                    PAYLOAD: [
                        {
                            NAME: 'existing',
                            INSTANCE_ID: 'instance-one',
                            SIGNATURE: 'LINKABLE_SIGNATURE',
                            INSTANCE_CONFIG: {
                                WORKING_HOURS: [],
                                LINKED_INSTANCES: [
                                    ['forLinking', 'instance-two'],
                                    ['forLinking', 'instance-three'],
                                ],
                            },
                        },
                        {
                            NAME: 'forLinking',
                            INSTANCE_ID: 'instance-two',
                            SIGNATURE: 'LINKABLE_SIGNATURE',
                            INSTANCE_CONFIG: { LINKED_INSTANCES: [], WORKING_HOURS: [], SINGLE_INSTANCE: false },
                        },
                        {
                            NAME: 'forLinking',
                            INSTANCE_ID: 'instance-three',
                            SIGNATURE: 'LINKABLE_SIGNATURE',
                            INSTANCE_CONFIG: { LINKED_INSTANCES: [], WORKING_HOURS: [], SINGLE_INSTANCE: false },
                        },
                    ],
                },
                [],
            );
        });
    });
});
