import { generateId } from '../helper.functions.js';
import { Pipeline } from './pipeline.js';
import {
    NODE_COMMAND_ARCHIVE_CONFIG,
    NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
} from '../constants.js';
import { PluginInstance } from './plugin.instance.js';

/**
 * @class NodeManager
 *
 * The manager for all the node operations.
 */
export class NodeManager {
    /**
     * The network client reference.
     *
     * @type {NaeuralWebClient}
     * @private
     */
    client;

    /**
     * The logger handler to be used for logging messages.
     *
     * @type {Logger}
     * @private
     */
    logger;

    /**
     * The node this manager is attached to.
     *
     * @type {string}
     * @private
     */
    node;

    /**
     * The list of open Pipelines on this node.
     *
     * @type {Array<Pipeline>}
     * @private
     */
    pipelines = [];

    /**
     * The list of Pipelines to be closed when commiting the pending changes.
     *
     * @type {Array<string>}
     * @private
     */
    pipelinesMarkedForClosing = [];

    /**
     * The NodeManager constructor.
     *
     * @param {NaeuralWebClient} client
     * @param {string} node
     * @param {Logger} logger
     *
     * @private
     */
    constructor(client, node, logger) {
        this.client = client;
        this.node = node;
        this.logger = logger;

        this.client.state.on('state.update', (update) => {
            this._updateState(update);
        });
    }

    /**
     * Returns an instance of a NodeManager for the requested `node`.
     *
     * @param {NaeuralWebClient} client
     * @param {string} node
     * @param {Logger} logger
     * @return {NodeManager}
     */
    static getNodeManager(client, node, logger) {
        return new NodeManager(client, node, logger);
    }

    /**
     * Static method that pushes a PluginInstance to a Pipeline. If the `nowatch` flag is set to true, this operation
     * will not automatically append a watch on this instance in the next network request. This behavior is needed when
     * attaching instances found on the received heartbeat, inside internal models, or when the watch is to be added
     * manually, for supporting custom deployment mechanisms.
     *
     * @param {Pipeline} pipeline
     * @param {PluginInstance} candidate
     * @param {boolean} nowatch
     */
    static attachPluginInstanceToPipeline(pipeline, candidate, nowatch = false) {
        if (!pipeline.instances) {
            pipeline.instances = [];
        }

        const existingInstance = pipeline.instances.filter((instance) => instance.id === candidate.id).pop() ?? null;
        if (existingInstance) {
            throw new Error(
                `Instance ${candidate.id} is already associated with ${pipeline.id} on ${pipeline.node}. Please update instead of recreating.`,
            );
        }

        candidate.setPipeline(pipeline);
        if (!nowatch) {
            pipeline.addInstanceWatch([pipeline.node, pipeline.id, candidate.signature, candidate.id]);
        }

        pipeline.instances.push(candidate);
        pipeline.isDirty = !nowatch;
    }

    /**
     * Compiles the changeset for a given Pipeline.
     *
     * @param {Pipeline} pipeline
     */
    static compilePipelineUpdateConfig(pipeline) {
        const candidateConfig = { ...pipeline.getDataCaptureThread().config };
        delete candidateConfig['INITIATOR_ID'];

        const instancesBySignature = pipeline.instances.reduce((collection, instance) => {
            if (!collection[instance.signature]) {
                collection[instance.signature] = [];
            }

            collection[instance.signature].push({
                ...instance.compile(),
                INSTANCE_ID: instance.id,
            });

            return collection;
        }, {});

        candidateConfig['PLUGINS'] = Object.keys(instancesBySignature).map((signature) => ({
            INSTANCES: instancesBySignature[signature],
            SIGNATURE: signature,
        }));

        return candidateConfig;
    }

    /**
     * Returns the change set list for all the plugin instances running on this pipeline.
     *
     * @param {Pipeline} pipeline
     * @return {Promise<ZxAIUpdateInstanceConfig[]>}
     */
    static async compilePipelineBatchUpdateInstances(pipeline) {
        const changeSet = [];
        for (const instance of pipeline.instances) {
            if (instance.isDirty) {
                const diff = await instance.makeUpdateInstancePayload();

                if (diff !== null) {
                    changeSet.push(diff);
                }
            }
        }

        return changeSet;
    }

    /**
     * Sends a request to restart the node.
     *
     * @return {Promise<Object>}
     */
    async restartEdgeNode() {
        const message = {
            ACTION: 'RESTART',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a request to stop the node.
     *
     * @return {Promise<Object>}
     */
    async shutdownEdgeNode() {
        const message = {
            ACTION: 'STOP',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a heartbeat request to the node.
     *
     * @return {Promise<Object>}
     */
    async getHeartbeatFromEdgeNode() {
        const message = {
            ACTION: 'TIMERS_ONLY_HEARTBEAT',
        };

        return this.client.publish(this.node, message);
    }

    /**
     * Sends a request for a detailed heartbeat to the node.
     *
     * @return {Promise<Object>}
     */
    async getFullHeartbeatFromEdgeNode() {
        const message = {
            ACTION: 'FULL_HEARTBEAT',
        };

        return this.client.publish(this.node, message);
    }

    //
    // async getNodeStats() {
    //     const command = {
    //         node: 'gts-staging',
    //         request: 'history',
    //         options: {
    //             steps: 20,
    //         }
    //     };
    //
    //     const netmonInstance = await this.getPluginInstance('admin_pipeline', 'NET_MON_01_INST');
    //     if (!netmonInstance) {
    //         console.log('ISSUEEEEe');
    //     }
    //
    //     return netmonInstance.sendCommand(command);
    // }

    /**
     * Creates a pipeline on the managed node.
     *
     * @param {Object} dataSource
     * @param {string|null} name
     * @return {Pipeline}
     */
    createPipeline(dataSource, name = null) {
        const id = name ?? generateId();
        if (!this.client.schemas?.dct[dataSource.type]) {
            throw new Error(
                `Unknown DCT of type "${dataSource.type}". Make sure the schema for "${dataSource.type}" is loaded.`,
            );
        }

        let pipeline = this.getPipeline(id);
        if (pipeline) {
            throw new Error(`Pipeline with name "${id}" already exists on "${this.node}"!`);
        }

        const config = dataSource.config;

        pipeline = Pipeline.make(
            this.client,
            this.node,
            {
                config: {
                    INITIATOR_ID: this.client.bootOptions.initiator,
                    NAME: id,
                    TYPE: dataSource.type,
                    ...config,
                },
                stats: null,
                plugins: [],
            },
            this.client.schemas,
            true,
        );

        this.pipelines.push(pipeline);

        return pipeline;
    }

    /**
     * Returns the pipeline with id `pipelineId` if it exists on this node.
     *
     * @param {string} pipelineId
     * @return {Pipeline|null}
     */
    getPipeline(pipelineId) {
        if (this.pipelines.length === 0) {
            this.getPipelines();
        }

        return this.pipelines.filter((pipeline) => pipeline.id === pipelineId).pop() ?? null;
    }

    /**
     * Returns all the pipelines associated with a node.
     *
     * @return {Array<Pipeline>}
     */
    getPipelines() {
        if (this.pipelines.length === 0) {
            this.pipelines = this._getRunningPipelines();
        }

        return this.pipelines;
    }

    /**
     * Method for creating a PluginInstance of a specific signature with the provided config. If no name is provided
     * a generated name will be assigned.
     *
     * @param {string} signature
     * @param {Object} config
     * @param {string|null} name
     * @return {PluginInstance}
     */
    createPluginInstance(signature, config = {}, name = null) {
        if (!name) {
            name = generateId();
        }

        const schema = this.client.schemas?.plugins[signature] ?? null;
        if (!schema) {
            throw new Error(`Unknown Plugin Type "${signature}". Make sure the schema for "${signature}" is loaded.`);
        }

        return PluginInstance.make({
            signature,
            config,
            stats: {},
            rawConfig: true,
            id: name,
            schema,
            dirty: true,
            tags: {},
            schedule: [],
        });
    }

    /**
     * Returns the Plugin Instance identified by `instanceId` from the instances running on this pipeline. If no
     * instance is found, then `null` is returned.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {string} instanceId
     * @return {PluginInstance|null}
     */
    getPluginInstance(pipelineOrId, instanceId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        }

        if (!pipeline) {
            console.log('no pipeline?!');
            return null;
        }

        return pipeline.instances.filter((instance) => instance.id === instanceId).pop() ?? null;
    }

    /**
     * Returns the list of plugin instances running on this pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     *
     * @return {Array<PluginInstance>}
     */
    getPluginInstances(pipelineOrId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        }

        return pipeline.instances;
    }

    /**
     * Updates the DataCaptureThread metadata for the specified pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {Object} metadata
     * @return {NodeManager}
     */
    updatePipelineMetadata(pipelineOrId, metadata) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        }

        pipeline.updateMetadata(metadata);

        return this;
    }

    // TODO: check if this should be supported updatePipelineConfig(pipeline, config) {}

    /**
     * Closes the pipeline by queueing an Archive Config command for the NaeuralEdgeProtocol node.
     *
     * @param {Pipeline|string} pipelineOrId
     * @return {Promise<NodeManager>}
     */
    async closePipeline(pipelineOrId) {
        let pipeline = pipelineOrId;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        }

        this.pipelinesMarkedForClosing.push(pipeline.id);

        return this;
    }

    /**
     * Adds a new Plugin Instance to be deployed on the Pipeline.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {NodeManager}
     */
    attachPluginInstance(pipelineOrId, instance) {
        let pipeline;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        } else {
            pipeline = pipelineOrId;
        }

        NodeManager.attachPluginInstanceToPipeline(pipeline, instance);

        return this;
    }

    /**
     * Removes a running plugin instance from the pipeline instance list.
     *
     * @param {Pipeline|string} pipelineOrId
     * @param {PluginInstance} instance
     * @return {Promise<NodeManager>}
     */
    removePluginInstance(pipelineOrId, instance) {
        if (instance.isLinked()) {
            const mainInstancePath = instance.getCollectorInstance()
                ? instance.getCollectorInstance().split(':')
                : null;

            if (!mainInstancePath) {
                // removing main instance; recalculate linking map
                const linkedInstances = [...instance.getLinkedInstances()];
                if (linkedInstances.length > 0) {
                    const newMainPath = linkedInstances.pop().split(':');
                    const newMain = this.getPluginInstance(newMainPath[0], newMainPath[1]);
                    newMain.purgeLinks();

                    for (const collectedPath of linkedInstances) {
                        const [pipelineId, instanceId] = collectedPath.split(':');
                        const collected = this.getPluginInstance(pipelineId, instanceId);
                        collected.purgeLinks();
                        newMain.link(collected);
                    }
                }
            } else {
                const mainInstance = this.getPluginInstance(mainInstancePath[0], mainInstancePath[1]);
                mainInstance.unlink(instance);
            }
        }

        let pipeline;
        if (typeof pipelineOrId === 'string') {
            pipeline = this.getPipeline(pipelineOrId);
        } else {
            pipeline = pipelineOrId;
        }

        for (let i = 0; i < pipeline.instances.length; i++) {
            const current = pipeline.instances[i];
            if (current.id === instance.id) {
                pipeline.instances.splice(i, 1);
                pipeline.isDirty = true;
                pipeline.removeInstanceWatch([this.node, pipeline.id, instance.signature, instance.id]);

                break;
            }
        }

        instance = null;

        return this;
    }

    /**
     * Links the instances provided as parameters.
     *
     * @param {Array<PluginInstance>} instances
     * @return {Promise<NodeManager>}
     */
    async linkInstances(instances) {
        if (instances.length < 2) {
            return this;
        }

        const firstType = instances[0].schema.type;
        const allSameType = instances.every((instance) => instance.schema.type === firstType);

        if (!allSameType) {
            throw new Error('Not all instances have the same type.');
        }

        let mainInstance = instances.find((instance) => instance.isCollecting() === true);

        if (!mainInstance) {
            mainInstance = instances[0];
        }

        for (const instance of instances) {
            if (instance.id === mainInstance.id && instance.pipeline.id === mainInstance.pipeline.id) {
                continue;
            }

            mainInstance.link(instance);
        }

        return this;
    }

    /**
     * Updates the config for a provided instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} update
     * @return {NodeManager}
     */
    updateInstance(instance, update) {
        instance.updateConfig(update);

        return this;
    }

    /**
     * Sets the provided tags on the instance.
     *
     * @param {PluginInstance} instance
     * @param {Object} tags
     * @return {NodeManager}
     */
    setInstanceTags(instance, tags) {
        instance.bulkSetTags(tags);

        return this;
    }

    /**
     * Sets the value for a specific tag on the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @param {string} value
     * @return {NodeManager}
     */
    tagInstance(instance, tag, value) {
        instance.addTag(tag, value);

        return this;
    }

    /**
     * Removes a tag from the plugin instance.
     *
     * @param {PluginInstance} instance
     * @param {string} tag
     * @return {NodeManager}
     */
    removeInstanceTag(instance, tag) {
        instance.removeTag(tag);

        return this;
    }

    /**
     * Sets the working hours schedule for the instance.
     * This method accepts either a detailed schedule for each day of the week
     * or a single schedule for all days.
     *
     * @param {PluginInstance} instance
     * @param {Object|Array} schedule - The schedule to set. If an object, it should
     * map days to time intervals. If an array, it applies the same schedule to all days.
     * @param {string} timezone
     * @returns {NodeManager} The instance of PluginInstance to allow method chaining.
     */
    setInstanceSchedule(instance, schedule, timezone = 'UTC+0') {
        instance.setSchedule(schedule, timezone);

        return this;
    }

    // TODO: instance watches should be handled here
    /**
     * Commits the changes registered for the node.
     *
     * @return {Promise<Array<Object>>}
     */
    async commit() {
        const runningPipelines = this._getRunningPipelines();
        const messages = {};

        for (const pipeline of this.pipelines) {
            if (this.pipelinesMarkedForClosing.includes(pipeline.id)) {
                continue;
            }

            const runningPipeline =
                runningPipelines.filter((runningPipeline) => runningPipeline.id === pipeline.id).pop() ?? null;

            if (pipeline.getDataCaptureThread().isDirty || pipeline.isDirty || !runningPipeline) {
                // new Pipeline, DCT changes or instances removed/added
                if (messages[NODE_COMMAND_UPDATE_CONFIG] === undefined) {
                    messages[NODE_COMMAND_UPDATE_CONFIG] = [];
                }

                messages[NODE_COMMAND_UPDATE_CONFIG].push({
                    payload: NodeManager.compilePipelineUpdateConfig(pipeline),
                    watches: [...pipeline.getInstanceWatches()],
                });
                pipeline.removeAllInstanceWatches();
            } else {
                // some of the instances may have been reconfigured
                const changeSet = await NodeManager.compilePipelineBatchUpdateInstances(pipeline);
                if (changeSet.length > 0) {
                    if (messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] === undefined) {
                        messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] = [];
                    }

                    messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE].push({
                        payload: changeSet,
                        watches: [...pipeline.getInstanceWatches()],
                    });
                    pipeline.removeAllInstanceWatches();
                }
            }
        }

        this.pipelinesMarkedForClosing.forEach((pipelineId) => {
            if (messages[NODE_COMMAND_ARCHIVE_CONFIG] === undefined) {
                messages[NODE_COMMAND_ARCHIVE_CONFIG] = [];
            }

            messages[NODE_COMMAND_ARCHIVE_CONFIG].push({
                payload: pipelineId,
                watches: [],
            });
        });

        const commands = [];
        if (
            messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE] &&
            messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE].length > 0
        ) {
            const batchUpdates = messages[NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE].reduce(
                (aggregated, command) => {
                    aggregated.payload = aggregated.payload.concat(command.payload);
                    aggregated.watches = aggregated.watches.concat(command.watches);

                    return aggregated;
                },
                { payload: [], watches: [] },
            );

            let action = NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE;
            let payload = batchUpdates.payload;
            if (batchUpdates.payload.length === 1) {
                action = NODE_COMMAND_UPDATE_PIPELINE_INSTANCE;
                payload = payload[0];
            }

            const message = {
                ACTION: action,
                PAYLOAD: payload,
            };

            commands.push(this.client.publish(this.node, message, batchUpdates.watches));
        }

        if (messages[NODE_COMMAND_UPDATE_CONFIG] && messages[NODE_COMMAND_UPDATE_CONFIG].length > 0) {
            messages[NODE_COMMAND_UPDATE_CONFIG].forEach((command) => {
                const message = {
                    ACTION: NODE_COMMAND_UPDATE_CONFIG,
                    PAYLOAD: command.payload,
                };

                commands.push(this.client.publish(this.node, message, command.watches));
            });
        }

        if (messages[NODE_COMMAND_ARCHIVE_CONFIG] && messages[NODE_COMMAND_ARCHIVE_CONFIG].length > 0) {
            messages[NODE_COMMAND_ARCHIVE_CONFIG].forEach((command) => {
                const message = {
                    ACTION: NODE_COMMAND_ARCHIVE_CONFIG,
                    PAYLOAD: command.payload,
                };

                commands.push(this.client.publish(this.node, message));
            });
        }

        return Promise.all(commands);
    }

    _updateState(nodeState) {
        return;

        const client = this.client;
        const node = this.node;

        const parsedPipelines = Object.keys(nodeState.pipelines).length > 0
            ? Object.keys(nodeState.pipelines).map((pipelineId) => {
                const pipelineConfig = nodeState.pipelines[pipelineId];

                return Pipeline.make(client, node, pipelineConfig, client.schemas);
            })
            : [];

        // for (const pipeline of this.pipelines) {
        //     if (!pipeline.isDirty) {
        //         continue;
        //     }
        //
        //
        // }

        this.pipelines = parsedPipelines;
    }

    /**
     * Returns the pipelines running on this node as they're reflected by the last received heartbeat.
     *
     * @return {Array<Pipeline>}
     * @private
     */
    _getRunningPipelines() {
        const client = this.client;
        const node = this.node;
        const nodeInfo = client.state.getNodeInfo(node);

        return nodeInfo.data?.pipelines
            ? Object.keys(nodeInfo.data?.pipelines).map((pipelineId) => {
                  const pipelineConfig = nodeInfo.data?.pipelines[pipelineId];

                  return Pipeline.make(client, node, pipelineConfig, client.schemas);
              })
            : [];
    }
}
