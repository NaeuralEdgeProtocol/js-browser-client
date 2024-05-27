import {
    applyDefaultsToObject,
    checkMandatoryFields,
    validateAgainstSchema,
    IsObject,
} from '../helper.functions.js';

/**
 * @class DataCaptureThread
 *
 * This is the class describing the structure of a DCT. Please see the network documentation for a detailed description
 * of the Data Capture Threads.
 *
 * A DCT is defined by a config object and a set of statistics received from the network node. Use the `make` method for
 * instantiating DCTs to ensure the proper validation of all the assets needed for correct instantiation.
 */
export class DataCaptureThread {
    /**
     * Signals synchronization on network node.
     *
     * @type {boolean}
     */
    isDirty = false;

    /**
     * The Data Capture Thread config.
     *
     * @type {Object}
     */
    config = {};

    /**
     * Time.
     *
     * @type {Object}
     */
    time = {};

    /**
     * Stats.
     *
     * @type {Object}
     */
    stats = {};

    /**
     * Data Per Second metrics.
     *
     * @type {Object}
     */
    dps = {};

    /**
     * The config schema used for validation.
     *
     * @type {SchemaDefinition}
     */
    schema;

    /**
     * Private constructor. Use the `make()` method for creating new instances of DCTs.
     *
     * @constructor
     * @param config
     * @param {SchemaDefinition} schema
     * @param dirty
     * @private
     */
    constructor(config, schema, dirty = false) {
        this.schema = schema;
        this.config = config;
        this.isDirty = dirty;
    }

    /**
     * Static factory to instantiate DataCaptureThreads.
     *
     * When called, will attempt to validate the config against the schema. Any errors will be thrown. This method
     * is used both internally, when loading pipeline configurations from the heartbeat info, and when creating
     * new pipelines to be deployed on the network node.
     *
     * @param {*} candidateConfig
     * @param {*} stats
     * @param {SchemaDefinition|null} schema
     * @param {boolean} dirty
     * @return {DataCaptureThread}
     */
    static make(candidateConfig, stats = null, schema = null, dirty = false) {
        let cleanConfig = {};
        if (IsObject(candidateConfig)) {
            cleanConfig = { ...candidateConfig };
        }

        if (schema !== null && schema.fields !== null && Array.isArray(schema.fields)) {
            cleanConfig = applyDefaultsToObject(cleanConfig, schema, dirty); // on newly created, add optional properties
            if (!checkMandatoryFields(cleanConfig, schema)) {
                throw new Error(
                    "Mandatory fields are missing from the DCT configuration. Couldn't properly instantiate.",
                );
            }

            const errors = validateAgainstSchema(cleanConfig, schema);
            if (errors.length > 0) {
                throw new Error(`Errors encountered when validating: \n ${errors.join('\n')}`);
            }
        }

        const instance = new DataCaptureThread(cleanConfig, schema, dirty);

        if (stats !== null) {
            instance.setStats(stats);
        }

        return instance;
    }

    /**
     * Sets the statistics for this capture thread, as received from heartbeat.
     *
     * @method
     * @param stats
     * @return {DataCaptureThread}
     */
    setStats(stats) {
        this.stats = stats;
        this.time = stats.NOW ? new Date(stats.NOW) : new Date();
        this.dps = {
            actual: stats.DPS,
            config: stats.CFG_DPS,
            target: stats.TGT_DPS,
        };

        return this;
    }

    /**
     * Returns the DCT config as stored on the instance. If a schema is provided, any properties missing from the
     * schema will be dropped from the returned object. Any properties missing from the config and present on the
     * schema will be returned with their default values as defined by the schema.
     *
     * @return {Object}
     */
    getConfig() {
        let cleanConfig = {};
        const schema = this.schema?.fields ?? null;

        if (schema) {
            for (const fieldDefinition of schema) {
                if (!this.config[fieldDefinition.key]) {
                    continue;
                }

                cleanConfig[fieldDefinition.key] = this.config[fieldDefinition.key] ?? fieldDefinition.default;
            }
        } else {
            cleanConfig = this.config;
        }

        return cleanConfig;
    }

    /**
     * Updates the config values of a DCT. The update is validated against the stored schema, if the validation fails
     * the errors are thrown.
     *
     * When updating, the DCT instance will be marked as dirty in order to be synchronized with the edge node by the
     * node manager handling the communication.
     *
     * @param update
     * @return {DataCaptureThread}
     */
    updateConfig(update) {
        const errors = validateAgainstSchema(update, this.schema);
        if (errors.length > 0) {
            throw new Error(`Errors encountered when validating: \n ${errors.join('\n')}`);
        }

        this.config = Object.assign(this.config, update);
        this.isDirty = true;

        return this;
    }

    /**
     * Shorthand method for returning the properties stored on the `STREAM_CONFIG_METADATA` config key. Depending on
     * the DCT implementation, this metadata can describe how the data is provided for the pipeline. One such example
     * could be the resolution of the extracted video frames that are fed into the computer vision pipelines.
     *
     * @return {Object}
     */
    getMetadata() {
        return this.config?.STREAM_CONFIG_METADATA ?? null;
    }

    /**
     * Shorthand method for updating the DCT metadata stored on the `STREAM_CONFIG_METADATA` config key.
     *
     * @param {Object} metadata
     * @return {DataCaptureThread}
     */
    updateMetadata(metadata) {
        if (!this.config?.STREAM_CONFIG_METADATA) {
            this.config.STREAM_CONFIG_METADATA = {};
        }

        this.config.STREAM_CONFIG_METADATA = Object.assign({}, this.config.STREAM_CONFIG_METADATA, metadata);
        this.isDirty = true;

        return this;
    }
}
