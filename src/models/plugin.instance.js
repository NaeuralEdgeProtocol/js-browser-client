import { NODE_COMMAND_UPDATE_PIPELINE_INSTANCE, STICKY_COMMAND_ID_KEY } from '../constants.js';
import {
    applyDefaultsToObject,
    checkMandatoryFields,
    computeDifferences,
    generateId,
    IsObject,
    validateAgainstSchema,
} from '../helper.functions.js';

export const ID_TAGS = 'ID_TAGS';
export const WORKING_HOURS = 'WORKING_HOURS';
export const WORKING_HOURS_TIMEZONE = 'WORKING_HOURS_TIMEZONE';
export const LINKED_INSTANCES = 'LINKED_INSTANCES';
export const SINGLE_INSTANCE = 'SINGLE_INSTANCE';
export const reservedKeys = [ID_TAGS, WORKING_HOURS, WORKING_HOURS_TIMEZONE, LINKED_INSTANCES, SINGLE_INSTANCE];

/**
 * @class PluginInstance
 *
 * This is the model that enables the interaction with the plugin instances running on the network node pipelines.
 * Please see the network documentation for a detailed description of the Plugin Instances.
 *
 * A PluginInstance is defined by a config object, a set of tags and the instance working hours.  Use the `make` method
 * for creating new `PluginInstance`s to ensure the proper validation of all the assets needed for correct
 * instantiation.
 */
export class PluginInstance {
    /**
     * Flag signaling that this plugin instance has changes that need to be committed to the network.
     *
     * @type {boolean}
     */
    isDirty = false;

    /**
     * The instance id.
     *
     * @type {string | null}
     */
    id = null;

    /**
     * The plugin signature.
     *
     * @type {string}
     */
    signature = null;

    /**
     * The instance config as it is on the Plugin Instance running on the NaeuralEdgeProtocol Network node.
     *
     * @type {Object}
     */
    config = {};

    /**
     * Instance stats, including errors, error times, etc.
     *
     * @type {Object}
     */
    stats = {};

    /**
     * Instance tags.
     *
     * @type {Object}
     */
    tags = {};

    /**
     * The instance schedule.
     *
     * @type {Object}
     */
    schedule = {};

    /**
     * The instance schedule timezone.
     *
     * @type {string}
     * @private
     */
    scheduleTimezone = 'UTC+0';

    /**
     * Flag for signalling if this particular instance is outside its configured working schedule.
     *
     * @type {boolean}
     */
    outsideWorkingHours = false;

    /**
     * The frequency with which this instance consumes inputs from the pipeline's DCT.
     *
     * @type {number|null}
     */
    frequency = 0;

    /**
     * Handler for the pipeline model this instance is deployed on.
     *
     * @type Pipeline
     */
    pipeline;

    /**
     * Instances to collect results from.
     *
     * @type {Array<string>}
     */
    linkedInstances = [];

    /**
     * The collector instance if this instance has its results collected by another instance.
     *
     * @type {string | null}
     */
    collectorInstance = null;

    /**
     * The config object schema definition.
     *
     * @type {SchemaDefinition|null}
     */
    schema = null;

    /**
     * The PluginInstance constructor.
     *
     * @param {string} id
     * @param {string} signature
     * @param {*} config
     * @param {SchemaDefinition} schema
     * @param {boolean} dirty
     *
     * @private
     */
    constructor(id, signature, config, schema = null, dirty = false) {
        this.id = id;
        this.schema = schema;
        this.signature = signature;
        this.config = config;
        this.tags = {};
        this.isDirty = dirty;
    }

    /**
     * Factory method for creating new `PluginInstance`s.
     *
     * The setup object should provide a config object and a schema for proper instantiation of the PluginInstance. If
     * the `schema` is provided, then this method will attempt to validate the config object based on the schema rules
     * and throw any errors.
     *
     * @param {Object} setup
     * @param {Pipeline|null} pipeline
     * @return {PluginInstance}
     */
    static make(setup, pipeline = null) {
        // TODO: setup.signature missing -> throw error

        let cleanConfig = setup.config ?? {};
        const schema = setup.schema;

        let useId = setup.id;
        if (!useId) {
            useId = generateId();
        }

        if (schema !== null && schema.fields !== null && Array.isArray(schema.fields)) {
            cleanConfig = applyDefaultsToObject(cleanConfig, schema);
            if (!checkMandatoryFields(cleanConfig, schema)) {
                throw new Error(
                    'Mandatory fields are missing from the plugin instance configuration. Couldn\'t properly instantiate.',
                );
            }

            const errors = validateAgainstSchema(cleanConfig, schema);
            if (errors.length > 0) {
                throw new Error(`Errors encountered when validating: \n ${errors.join('\n')}`);
            }
        }

        const instance = new PluginInstance(useId, setup.signature, cleanConfig, schema, setup.dirty ?? false)
            .updateStats(setup.stats ?? null)
            .bulkSetTags(setup.tags ?? {})
            .setSchedule(setup.schedule, setup.scheduleTimezone, !setup.dirty);

        if (pipeline) {
            instance.setPipeline(pipeline);
        }

        return instance;
    }

    /**
     * Returns the id of the pipeline this plugin instance is working on.
     *
     * @return {string}
     */
    getPipelineId() {
        return this.pipeline.id;
    }

    /**
     * Returns the instance's schema.
     *
     * @return {SchemaDefinition}
     */
    getSchema() {
        return this.schema ?? null;
    }

    /**
     * Retrieves the running config from the PluginInstance model. The returned config will be remapped
     * on the schema if it exists.
     *
     * @return {Object}
     */
    getConfig() {
        let cleanConfig = {};
        const schema = this.schema?.fields ?? null;

        if (schema) {
            schema.forEach((fieldDefinition) => {
                cleanConfig[fieldDefinition.key] = this.config[fieldDefinition.key] ?? fieldDefinition.default;
            });
        } else {
            cleanConfig = this.config;
        }

        return cleanConfig;
    }

    /**
     * Method for updating the config on this instance.
     *
     * @param {Object} update
     * @return {PluginInstance}
     */
    updateConfig(update) {
        const errors = validateAgainstSchema(update, this.schema);
        if (errors.length > 0) {
            throw new Error(`Errors encountered when validating: \n ${errors.join('\n')}`);
        }

        this.config = Object.assign(this.config, update);
        this.isDirty = true;
        this.pipeline.addInstanceWatch([this.pipeline.node, this.pipeline.id, this.signature, this.id]);

        return this;
    }

    /**
     * Returns `true` if this plugin instance is linkable with others based on the associated schema.
     *
     * @return {boolean}
     */
    isLinkable() {
        return this.schema?.options?.linkable ?? false;
    }

    /**
     * Returns `true` if plugin instance is either collecting other instances or if its output is collected by another.
     *
     * @return {boolean}
     */
    isLinked() {
        return this.isLinkable() && (this.linkedInstances.length > 0 || this.collectorInstance !== null);
    }

    /**
     * Returns `true` if this particular instance's output is collected by another instance.
     *
     * @return {boolean}
     */
    isCollected() {
        return this.collectorInstance !== null;
    }

    /**
     * Returns `true` if this instance is the main instance, collecting and reporting output from other instances.
     *
     * @return {boolean}
     */
    isCollecting() {
        return this.linkedInstances.length > 0;
    }

    /**
     * Returns the list of collected instances.
     *
     * @return {Array<string>}
     */
    getLinkedInstances() {
        return this.linkedInstances;
    }

    /**
     * Returns the path of the collecting instance.
     *
     * @return {string|null}
     */
    getCollectorInstance() {
        return this.collectorInstance;
    }

    /**
     * Sets `this` instance as collected by the provided `instance`.
     *
     * @param {PluginInstance} instance
     * @return {PluginInstance}
     */
    setCollectorInstance(instance) {
        this.collectorInstance = `${instance.pipeline.id}:${instance.id}`;
        this.isDirty = true;

        return this;
    }

    // TODO: this is dangerous to have available
    /**
     * Removes all links to this instance.
     *
     * @return {PluginInstance}
     */
    purgeLinks() {
        this.collectorInstance = null;
        this.linkedInstances = [];
        this.isDirty = true;

        return this;
    }

    /**
     * Returns `true` if this instance is collecting data from the `tester` instance provided.
     *
     * @param {PluginInstance} tester
     * @return {boolean}
     */
    isCollectingFrom(tester) {
        if (this.linkedInstances.length === 0) {
            return false;
        }

        for (const link of this.linkedInstances) {
            const [pipelineId, instanceId] = link.split(':');
            if (instanceId === tester.id && pipelineId === tester.pipeline.id) {
                return true;
            }
        }

        return false;
    }

    /**
     * Attempts to link `this` instance to the `candidate` instance.
     *
     * @param {PluginInstance} candidate
     * @return {PluginInstance}
     */
    link(candidate) {
        const targetMetadata = candidate.schema;
        const thisMetadata = this.schema;

        if (
            targetMetadata.type === thisMetadata.type &&
            targetMetadata.options?.linkable &&
            thisMetadata.options?.linkable &&
            !this.isCollectingFrom(candidate)
        ) {
            this.linkedInstances.push(`${candidate.pipeline.id}:${candidate.id}`);
            candidate.setCollectorInstance(this);
            this.isDirty = true;
        }

        return this;
    }

    /**
     * Removes the link between `this` instance and the provided `linkedInstance` instance.
     *
     * @param {PluginInstance} linkedInstance
     * @return {PluginInstance}
     */
    unlink(linkedInstance) {
        linkedInstance.setCollectorInstance(null);

        for (let i = 0; i < this.linkedInstances.length; i++) {
            const [pipelineId, instanceId] = this.linkedInstances[i].split(':');

            if (pipelineId === linkedInstance.pipeline.id && instanceId === linkedInstance.id) {
                this.linkedInstances.splice(i, 1);
                this.isDirty = true;
            }
        }

        return this;
    }

    /**
     * Removes a tag from the instance if it exists.
     *
     * @param {string} key - The key of the tag to remove.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    removeTag(key) {
        if (this.tags[key]) {
            delete this.tags[key];
        }

        return this;
    }

    /**
     * Adds a tag to the instance or updates an existing tag.
     *
     * @param {string} key - The key of the tag to add or update.
     * @param {string} value - The value of the tag to add or update.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    addTag(key, value) {
        this.tags[key] = value;

        return this;
    }

    /**
     * Retrieves all tags from the instance.
     *
     * @returns {Object} An object containing all tags.
     */
    getTags() {
        return this.tags;
    }

    /**
     * Resets all tags to an empty object.
     *
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    resetTags() {
        this.tags = {};

        return this;
    }

    /**
     * Sets multiple tags at once, replacing any existing tags.
     *
     * @param {Object} tags - An object containing multiple tags to set.
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    bulkSetTags(tags) {
        this.tags = tags;

        return this;
    }

    /**
     * Retrieves the current working hours schedule of the instance.
     *
     * @returns {Object|Array} The current schedule. Returns an object for schedules
     * specific to days of the week, or an array for a uniform schedule across all days.
     */
    getSchedule() {
        return this.schedule;
    }

    /**
     * Sets the working hours schedule for the instance.
     * This method accepts either a detailed schedule for each day of the week
     * or a single schedule for all days.
     *
     * @param {Object|Array} schedule - The schedule to set. If an object, it should
     * map days to time intervals. If an array, it applies the same schedule to all days.
     * @param {string} timezone The schedule timezone.
     * @param {boolean} dontMarkDirty
     *
     * @returns {PluginInstance} The instance of PluginInstance to allow method chaining.
     */
    setSchedule(schedule, timezone = 'UTC+0', dontMarkDirty = false) {
        this._validateSchedule(schedule);
        this.schedule = schedule;
        this.scheduleTimezone = timezone;
        this.isDirty = !dontMarkDirty;

        return this;
    }

    /**
     * Method for updating the running stats on this instance.
     *
     * @param {Object} stats
     * @return {PluginInstance}
     */
    updateStats(stats = {}) {
        this.frequency = stats.FREQUENCY ?? null;
        this.stats = stats;
        this.outsideWorkingHours = stats.OUTSIDE_WORKING_HOURS ?? false;

        return this;
    }

    /**
     * Returns the instance running statistics.
     *
     * @return {Object}
     */
    getInstanceStats() {
        return this.stats;
    }

    /**
     * Sets the pipeline on which this instance is running.
     *
     * @param {Pipeline} pipeline
     * @return {PluginInstance}
     */
    setPipeline(pipeline) {
        this.pipeline = pipeline;

        return this;
    }

    /**
     * Sends a command to the instance running on the NaeuralEdgeProtocol Network node.
     *
     * @param {Object} command
     * @return {Promise<Object>}
     */
    sendCommand(command) {
        return this.pipeline.getClient().publish(this.pipeline.getNode(), this.getRawInstanceCommandPayload(command));
    }

    /**
     * Computes the instance update config by comparing the config running on the NaeuralEdgeProtocol Node with the proposed
     * configuration stored on the instance model.
     *
     * @return {Promise<ZxAIUpdateInstanceConfig>}
     */
    async makeUpdateInstancePayload() {
        const candidateConfig = this.compile();
        const runningConfig = await this.pipeline
            .getClient()
            .state
            .getRunningInstanceConfig(this.pipeline.node, this.pipeline.id, this.id);

        const changeSet = computeDifferences(runningConfig, candidateConfig);
        if (changeSet !== null) {
            return {
                NAME: this.pipeline.id,
                INSTANCE_ID: this.id,
                SIGNATURE: this.signature,
                INSTANCE_CONFIG: changeSet,
            };
        }

        return null;
    }

    /**
     * Puts together all the information in one config object.
     *
     * @return {Object}
     */
    compile() {
        const config = this.config;

        if (Object.keys(this.tags).length) {
            config[ID_TAGS] = {};
            Object.keys(this.tags).forEach((key) => {
                config[ID_TAGS][`${key}`] = this.tags[key];
            });
        }

        if (
            (Array.isArray(this.schedule) && this.schedule.length > 0) ||
            (IsObject(this.schedule) && Object.keys(this.schedule).length > 0)
        ) {
            config[WORKING_HOURS] = this.schedule;
            config[WORKING_HOURS_TIMEZONE] = this.scheduleTimezone;
        } else {
            config[WORKING_HOURS] = [];
        }

        if (this.isLinkable()) {
            if (!this.isCollected() && !this.isCollecting()) {
                config[SINGLE_INSTANCE] = true;
                config[LINKED_INSTANCES] = [];
            } else if (this.isCollected()) {
                config[SINGLE_INSTANCE] = false;
                config[LINKED_INSTANCES] = [];
            } else if (this.isCollecting()) {
                config[LINKED_INSTANCES] = this.linkedInstances.map((linkPath) => linkPath.split(':'));
            }
        }

        return this.config;
    }

    /**
     * Returns the instance command wrapped within an NaeuralEdgeProtocol Node command.
     *
     * @param command
     * @return {ZxAICommand}
     */
    getRawInstanceCommandPayload(command) {
        command[STICKY_COMMAND_ID_KEY] = generateId();

        return {
            PAYLOAD: {
                NAME: this.pipeline.id,
                INSTANCE_ID: this.id,
                SIGNATURE: this.signature,
                INSTANCE_CONFIG: {
                    INSTANCE_COMMAND: command,
                },
            },
            ACTION: NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
        };
    }

    /**
     * Validates the structure and content of the schedule object.
     * For separate schedules, ensures each key is a valid day and each value is an array of time intervals.
     * For a single schedule for all days, ensures it's an array of time intervals.
     * Time intervals should be in the format ["HH:MM", "HH:MM"].
     *
     * @private
     * @param {Object|Array} schedule - The schedule to validate.
     * @returns {boolean} True if the schedule is valid, otherwise throws an Error.
     */
    _validateSchedule(schedule) {
        const isValidTime = (time) => /^\d{2}:\d{2}$/.test(time);
        const isValidInterval = (interval) =>
            Array.isArray(interval) && interval.length === 2 && interval.every(isValidTime);
        const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

        if (Array.isArray(schedule)) {
            if (schedule.length !== 0 && !schedule.every(isValidInterval)) {
                throw new Error('Invalid schedule format: Each interval must be an array of two valid times.');
            }
        } else if (typeof schedule === 'object') {
            Object.entries(schedule).forEach(([day, intervals]) => {
                if (!daysOfWeek.includes(day)) {
                    throw new Error(`Invalid schedule day: ${day} is not a valid day of the week.`);
                }
                if (!Array.isArray(intervals) || !intervals.every(isValidInterval)) {
                    throw new Error(
                        `Invalid schedule format for ${day}: Each interval must be an array of two valid times.`,
                    );
                }
            });
        } else {
            throw new Error('Invalid schedule type: Schedule must be either an array or an object.');
        }

        return true;
    }
}
