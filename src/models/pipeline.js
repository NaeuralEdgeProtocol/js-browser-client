import { NODE_COMMAND_PIPELINE_COMMAND, STICKY_COMMAND_ID_KEY } from '../constants.js';
import { DataCaptureThread } from './data.capture.thread.js';
import { generateId } from '../helper.functions.js';
import { ID_TAGS, PluginInstance, WORKING_HOURS, WORKING_HOURS_TIMEZONE } from './plugin.instance.js';
import { NodeManager } from './node.manager.js';

/**
 * @class Pipeline
 *
 * This is the model that allows interactions with the pipelines deployed on the network nodes. Please see the network
 * documentation for a detailed description of the Pipelines.
 *
 * A Pipeline is defined by a config object and a set of plugins running on the pipeline.  Use the `make` method for
 * creating new `Pipeline`s to ensure the proper validation of all the assets needed for correct instantiation.
 */
export class Pipeline {
    /**
     * Flag for signalling uncommitted changes to this model.
     *
     * @type {boolean}
     */
    isDirty = false;

    /**
     * The pipeline name.
     *
     * @readonly
     * @type {string}
     */
    id;

    /**
     * List of plugin instances running on this pipeline.
     *
     * @type {PluginInstance[]}
     */
    instances = [];

    /**
     * The NaeuralEdgeProtocol Edge Node on which this pipeline is running.
     *
     * @type {string}
     * @readonly
     */
    node;

    /**
     * The Data Capture Thread used for feeding data to the pipeline.
     *
     * @type {DataCaptureThread | null}
     * @private
     */
    dct = null;

    /**
     * The id of the process that changed the pipeline last.
     *
     * @type {string}
     * @readonly
     */
    initiator = null;

    /**
     * The reference to the NaeuralEdgeProtocol Network Client.
     *
     * @type {NaeuralWebClient}
     * @private
     */
    client;

    /**
     * A dictionary of paths involved in publishing messages.
     *
     * @type {{}}
     * @private
     */
    watches = {};

    /**
     * The Pipeline model constructor.
     *
     * @param {string} initiator
     * @param {string} node
     * @param {string} name
     * @param {DataCaptureThread} dct
     * @param {NaeuralWebClient} client
     *
     * @private
     */
    constructor(initiator, node, name, dct, client) {
        this.initiator = initiator;
        this.node = node;
        this.id = name;
        this.dct = dct;
        this.client = client;
    }

    /**
     * Static factory for constructing Pipeline models.
     *
     * @param {NaeuralWebClient} client
     * @param {string} node
     * @param {Object} config
     * @param {SchemasRepository} schemas
     * @param {boolean} dirty
     * @return {Pipeline}
     */
    static make(client, node, config, schemas, dirty = false) {
        const schema = schemas.dct[config.config.TYPE];
        const pluginSchemas = schemas.plugins;
        const dct = DataCaptureThread.make(config.config, config.stats, schema, dirty);

        const useName = config.config?.NAME ?? generateId();
        const initiator = config.config.INITIATOR_ID;
        const plugins = config.plugins;
        const pipeline = new Pipeline(initiator, node, useName, dct, client);

        Object.keys(plugins).forEach((signature) => {
            const schema = pluginSchemas[signature] ?? null;
            Object.keys(plugins[signature]).forEach((instanceId) => {
                const { config: rawConfig, stats: instanceStats } = plugins[signature][instanceId];
                const tags = rawConfig[ID_TAGS] ?? {};
                const schedule = rawConfig[WORKING_HOURS] ?? [];
                const timezone = rawConfig[WORKING_HOURS_TIMEZONE] ?? 'UTC+0';

                delete rawConfig[ID_TAGS];
                delete rawConfig[WORKING_HOURS];
                delete rawConfig[WORKING_HOURS_TIMEZONE];

                const instance = PluginInstance.make(
                    {
                        dirty: false,
                        signature: signature,
                        config: rawConfig,
                        stats: instanceStats,
                        rawConfig: true,
                        id: rawConfig.INSTANCE_ID ?? null,
                        schema: schema,
                        tags,
                        schedule,
                        scheduleTimezone: timezone,
                    },
                    pipeline,
                );

                NodeManager.attachPluginInstanceToPipeline(pipeline, instance, true);
            });
        });

        return pipeline;
    }

    /**
     * Returns the pipeline name/id.
     *
     * @return {string}
     */
    getId() {
        return this.id;
    }

    /**
     * Returns the id of the process that changed the pipeline last.
     *
     * @return {string}
     */
    getInitiator() {
        return this.initiator;
    }

    /**
     * Returns the name of the NaeuralEdgeProtocol Network Node this pipeline runs on.
     *
     * @return {string}
     */
    getNode() {
        return this.node;
    }

    /**
     * Returns the type of the datasource feeding data into this pipeline.
     *
     * @return {string}
     */
    getType() {
        return this.dct.config.TYPE;
    }

    /**
     * Returns the NaeuralEdgeProtocol Network Client reference.
     *
     * @return {NaeuralWebClient}
     */
    getClient() {
        return this.client;
    }

    /**
     * Returns the configured Data Capture Thread Model that feeds data into this pipeline.
     *
     * @return {DataCaptureThread|null}
     */
    getDataCaptureThread() {
        return this.dct;
    }

    /**
     * Returns the metadata set on this pipeline.
     *
     * @return {*}
     */
    getMetadata() {
        return this.dct.getMetadata();
    }

    /**
     * Updates metadata set on this pipeline.
     *
     * @param {Object} metadata
     * @return {Pipeline}
     */
    updateMetadata(metadata) {
        this.dct.updateMetadata(metadata);

        return this;
    }

    /**
     * Adds an `EE_MESSAGE_PATH` to watch for in the following network request.
     *
     * @param {Array<string>} path
     * @return {Pipeline}
     */
    addInstanceWatch(path) {
        this.watches[path.join(':')] = path;

        return this;
    }

    /**
     * Returns all configured `EE_MESSAGE_PATH`s to be watched in the following network request.
     *
     * @return {Array<Array<string>>}
     */
    getInstanceWatches() {
        return Object.keys(this.watches).map((watchKey) => this.watches[watchKey]);
    }

    /**
     * Removes a previously configured `EE_MESSAGE_PATH` from the list to be watched in the following network request.
     *
     * @param {Array<string>} path
     * @return {Pipeline}
     */
    removeInstanceWatch(path) {
        if (this.watches[path.join(':')]) {
            delete this.watches[path.join(':')];
        }

        return this;
    }

    /**
     * Removes all previously configured `EE_MESSAGE_PATHS` from the list to be watched in the following network request.
     *
     * @return {Pipeline}
     */
    removeAllInstanceWatches() {
        this.watches = {};

        return this;
    }

    /**
     * Sends the provided `command` to the pipeline running on the NaeuralEdgeProtocol Node.
     *
     * @param {Object} command
     * @return {Promise<*>}
     */
    sendCommand(command) {
        return this.client.publish(this.node, this._getRawPipelineCommandPayload(command));
    }

    /**
     * Returns the Edge Node command wrapping the Pipeline command.
     *
     * @param {Object} command
     * @return {ZxAICommand}
     * @private
     */
    _getRawPipelineCommandPayload(command) {
        command[STICKY_COMMAND_ID_KEY] = generateId();

        return {
            PAYLOAD: {
                NAME: this.id,
                PIPELINE_COMMAND: command,
            },
            ACTION: NODE_COMMAND_PIPELINE_COMMAND,
        };
    }
}

