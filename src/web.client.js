import mqtt from 'mqtt';
import EventEmitter2 from 'eventemitter2';
import { concatMap, filter, fromEvent, map, tap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
    HEARTBEATS_STREAM,
    MESSAGE_TYPE_HEARTBEAT,
    MESSAGE_TYPE_NOTIFICATION,
    MESSAGE_TYPE_PAYLOAD, NODE_COMMAND_ARCHIVE_CONFIG, NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_PIPELINE_COMMAND,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
    NOTIFICATIONS_STREAM,
    PAYLOADS_STREAM, REST_CUSTOM_EXEC_SIGNATURE, ZxAI_SUPERVISOR_PAYLOAD
} from './constants';
import NaeuralBC from './web.blockchain';
import { processHeartbeat } from './processors/heartbeat.processor';
import { notificationProcessor } from './processors/notification.processor';
import { payloadProcessor } from './processors/payload.processor';
import { rawIn } from './formatters/raw.formatter';
import { identityFormatter } from './formatters/identity.formatter';
import { StateManager } from './models/state.manager';
import { Logger } from './logger';
import { NodeManager } from './models/node.manager';
import { defaultSchemas } from './utils/schema.providers';

export class NaeuralWebClient extends EventEmitter2 {
    logger = null;

    topicPaths = {
        heartbeats: 'lummetry/ctrl',
        notifications: 'lummetry/notif',
        payloads: 'lummetry/payloads',
    };

    schemas = {};

    bootOptions = {
        initiator: null,
        blockchain: {
            debug: false,
            key: '',
            encrypt: true,
            secure: true,
        },
        mqttOptions: {
            url: null,
            username: null,
            password: null,
        },
        customFormatters: {},
        fleet: [],
    };

    /**
     * @type {StateManager}
     */
    state = null;

    formatters = {
        raw: { in: rawIn },
        '0xai1.0': { in: identityFormatter },
    };

    connections = {
        heartbeats: null,
        notifications: null,
        payloads: null,
        outbound: null,
    };

    networkStreams = {
        [`${HEARTBEATS_STREAM}`]: null,
        [`${NOTIFICATIONS_STREAM}`]: null,
        [`${PAYLOADS_STREAM}`]: null,
    };

    /**
     *
     * @type {NaeuralBC}
     */
    naeuralBC = null;

    constructor(options) {
        super();

        this.logger = new Logger();
        this.bootOptions = Object.assign(this.bootOptions, options);

        if (!options.initiator) {
            this.bootOptions.initiator = uuidv4().substring(0, 13);
        }

        if (options.customFormatters !== undefined && typeof options.customFormatters === 'object') {
            Object.keys(options.customFormatters).forEach((formatterName) => {
                this.logger.log(`... loading custom formatters: ${formatterName}`);
                if (!this.formatters[formatterName]) {
                    this.formatters[formatterName] = {
                        in: null,
                        out: null,
                    };
                }

                if (Object.keys(options.customFormatters[formatterName]).includes('in')) {
                    this.formatters[formatterName].in = options.customFormatters[formatterName].in;
                    this.logger.log(`... loaded ${formatterName}: in()`);
                }

                if (Object.keys(options.customFormatters[formatterName]).includes('out')) {
                    this.formatters[formatterName].out = options.customFormatters[formatterName].out;
                    this.logger.log(`... loaded ${formatterName}: out()`);
                }
            })
        }

        this.naeuralBC = new NaeuralBC();
        this.state = new StateManager(this.logger);
        this.schemas = defaultSchemas();
    }

    setNetworkConnectionOptions(options) {
        this.bootOptions.mqttOptions = options;
    }

    loadIdentity(options) {
        this.naeuralBC.loadIdentity(options);
    }

    connect() {
        this.networkStreams[`${HEARTBEATS_STREAM}`] = this.connectUpstream(this.connections.heartbeats, this.topicPaths[`${HEARTBEATS_STREAM}`]);
        this.networkStreams[`${NOTIFICATIONS_STREAM}`] = this.connectUpstream(this.connections.notifications, this.topicPaths[`${NOTIFICATIONS_STREAM}`]);
        this.networkStreams[`${PAYLOADS_STREAM}`] = this.connectUpstream(this.connections.payloads, this.topicPaths[`${PAYLOADS_STREAM}`]);

        this.networkStreams[`${HEARTBEATS_STREAM}`].subscribe((message) =>
            this._heartbeatProcessor(message),
        );

        this.networkStreams[`${NOTIFICATIONS_STREAM}`].subscribe((message) =>
            this._notificationsProcessor(message),
        );

        this.networkStreams[`${PAYLOADS_STREAM}`].subscribe((message) =>
            this._payloadsProcessor(message),
        );

        this.connections.outbound = mqtt.connect(this.bootOptions.mqttOptions.url, {
            username: this.bootOptions.mqttOptions.username,
            password: this.bootOptions.mqttOptions.password,
            clean: true,
            clientId: null,
        });

        this.connections.outbound.on('connect', () => {
            this.logger.log('Successfully connected to MQTT on outbound connection.');
        });

        this.connections.outbound.on('error', this._onError);
    }

    setFleet(fleet) {
        this.bootOptions.fleet = fleet;
    }

    getFleet() {
        return this.bootOptions.fleet;
    }

    connectUpstream(handler, topic) {
        handler = mqtt.connect(this.bootOptions.mqttOptions.url, {
            username: this.bootOptions.mqttOptions.username,
            password: this.bootOptions.mqttOptions.password,
            clean: true,
            clientId: null,
        });

        handler.on('connect', () => {
            this.logger.log('Successfully connected to MQTT.');
            handler.subscribe(topic, (err) => {
                if (!err) {
                    this.logger.log(`Successfully connected to "${topic}".`);

                    return;
                }

                this.logger.error(`Could not subscribe to "${topic}".`);
            });
        });

        handler.on('error', this._onError);

        return fromEvent(handler, 'message')
            .pipe(
                map((message) => this._toString(message[1])),
                filter((message) => this._messageIsSigned(message)),
                map((message) => this._toJSON(message)),
                filter((message) => this._messageIsFromEdgeNode(message)),
                tap((message) => this._processSupervisorMessage(message)),
                filter((message) => this._messageFromControlledFleet(message)),
                filter((message) => this._messageHasKnownFormat(message)),
                concatMap((message) => this._decodeToInternalFormat(message)),
            );
    }

    getName() {
        return this.bootOptions.initiator;
    }

    getBlockChainAddress() {
        return this.naeuralBC.getAddress();
    }

    getStream(stream) {
        return this.networkStreams[stream];
    }

    getUniverse() {
        return this.state.getUniverse();
    }

    /**
     * Returns a `NodeManager` for a specific node.
     *
     * @param node
     * @return {Promise<NodeManager|null>}
     */
    async getNodeManager(node) {
        if (await this._checkNode(node)) {
            return NodeManager.getNodeManager(this, node, this.logger);
        }

        return null;
    }

    /**
     * Returns a list of all the registered DCT Schemas.
     *
     * @return {Array<Object>}
     */
    getRegisteredDCTTypes() {
        return Object.keys(this.schemas.dct).map((key) => ({
            type: this.schemas.dct[key].type,
            name: this.schemas.dct[key].name,
            description: this.schemas.dct[key].description,
        }));
    }

    /**
     * Allows for hot registration of a new DCT Schema to be used by the network client.
     *
     * @param {string} name
     * @param {SchemaDefinition} schema
     * @return {NaeuralWebClient}
     */
    registerDCTType(name, schema) {
        if (!this.schemas.dct) {
            this.schemas.dct = {};
        }

        this.schemas.dct[name] = schema;

        // TODO: hot registration should notify child threads and other processes
        return this;
    }

    /**
     * Returns the schema associated to a DCT name.
     *
     * @param {string} dctName
     * @return {SchemaDefinition|null}
     */
    getDCTSchema(dctName) {
        return this.schemas?.dct[dctName] ?? null;
    }

    /**
     * Returns the list of Plugin Schemas associated to this network client.
     *
     * @return {Array<Object>}
     */
    getRegisteredPluginTypes() {
        return Object.keys(this.schemas.plugins)
            .filter((signature) => signature !== REST_CUSTOM_EXEC_SIGNATURE)
            .map((signature) => ({
                signature,
                name: this.schemas.plugins[signature].name,
                description: this.schemas.plugins[signature].description,
                linkable: this.schemas.plugins[signature].options?.linkable ?? false,
            }));
    }

    /**
     * Returns the loaded schema for a specific plugin `signature`.
     *
     * @param signature
     * @return {SchemaDefinition|null}
     */
    getPluginSchema(signature) {
        return this.schemas?.plugins[signature] ?? null;
    }

    /**
     * Associates a schema with a plugin `signature`.
     *
     * @param {string} signature
     * @param {Object} schema
     * @return {NaeuralWebClient}
     */
    registerPluginSchema(signature, schema) {
        this.schemas.plugins[signature] = schema;

        this.logger.log(`[Main Thread] Successfully registered schema for ${signature}.`);

        return this;
    }

    /**
     * Method for publishing a message for an NaeuralEdgeProtocol Node.
     *
     * @param {string} node
     * @param {Object} message
     * @param {Array<Array<string>>} extraWatches
     * @return {Promise<unknown>}
     */
    async publish(node, message, extraWatches = []) {
        if (!message) {
            return new Promise((resolve) => {
                resolve({
                    data: {
                        notification: 'Already closed.',
                    },
                });
            });
        }

        message['INITIATOR_ID'] = this.bootOptions.initiator;
        message['EE_ID'] = node;
        message['TIME'] = new Date();

        const watches = [];
        if (extraWatches.length > 0) {
            extraWatches.forEach((watch) => {
                watches.push(watch);
            });
        }

        switch (message['ACTION']) {
        case NODE_COMMAND_UPDATE_PIPELINE_INSTANCE:
            watches.push([
                node,
                message['PAYLOAD']['NAME'],
                message['PAYLOAD']['SIGNATURE'],
                message['PAYLOAD']['INSTANCE_ID'],
            ]);
            break;
        case NODE_COMMAND_UPDATE_CONFIG:
        case NODE_COMMAND_PIPELINE_COMMAND:
            watches.push([node, message['PAYLOAD']['NAME'], null, null]);

            break;
        case NODE_COMMAND_ARCHIVE_CONFIG:
            watches.push([node, message['PAYLOAD'], null, null]);

            break;
        case NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE:
            message['PAYLOAD'].forEach((updateInstanceCommand) => {
                watches.push([
                    node,
                    updateInstanceCommand['NAME'],
                    updateInstanceCommand['SIGNATURE'],
                    updateInstanceCommand['INSTANCE_ID'],
                ]);
            });

            break;
        }

        const mqttConnection = this.connections.outbound;
        const blockchainEngine = this.naeuralBC;

        return new Promise(async (resolve, reject) => {
            const request = this.state.registerMessage(message, watches, resolve, reject);
            message['SESSION_ID'] = request.getId();

            let toSend = {...message};
            // todo: encrypt
            // if (this.bootOptions.blockchain.encrypt === true) {
            //     const encrypted = blockchainEngine.encrypt(
            //         JSON.stringify({
            //             ACTION: message.ACTION,
            //             PAYLOAD: message.PAYLOAD,
            //         }),
            //         this.universeAddresses[node],
            //     );
            //
            //     toSend = {
            //         EE_IS_ENCRYPTED: true,
            //         EE_ENCRYPTED_DATA: encrypted,
            //         INITIATOR_ID: message.INITIATOR_ID,
            //         SESSION_ID: message.SESSION_ID,
            //         EE_ID: message.EE_ID,
            //         TIME: message.TIME,
            //     };
            // }

            blockchainEngine.sign(toSend).then(signed => {
                mqttConnection.publish(`lummetry/${node}/config`, signed);

                if (watches.length === 0) {
                    resolve({
                        DATA: {
                            NOTIFICATION: `${message['ACTION']} command sent.`,
                        },
                    });
                }
            });
        });
    }

    /**
     *
     * @param message
     * @private
     */
    _heartbeatProcessor(message) {
        this.state.nodeInfoUpdate(message);

        return true;
    }

    /**
     *
     * @param message
     * @private
     */
    _notificationsProcessor(message) {
        const messageClone = {...message};
        const context = this._makeContext(messageClone.EE_PAYLOAD_PATH);

        const data = { ...messageClone.DATA };
        delete messageClone.DATA;
        context.metadata = messageClone;
        context.metadata['SESSION_ID'] = data['SESSION_ID'];

        context.metadata['NOTIFICATION_CODE'] = data['NOTIFICATION_CODE'];
        context.metadata['NOTIFICATION_TAG'] = data['NOTIFICATION_TAG'];
        context.metadata['NOTIFICATION_TYPE'] = data['NOTIFICATION_TYPE'];

        this.state.onRequestResponseNotification({
            data,
            context,
            error: null,
        });

        return true;
    }

    /**
     *
     * @param message
     * @private
     */
    _payloadsProcessor(message) {
        const messageClone = {...message};
        const context = this._makeContext(messageClone.EE_PAYLOAD_PATH);

        const data = { ...messageClone.DATA };
        delete messageClone.DATA;
        context.metadata = messageClone;
        context.metadata['SESSION_ID'] = data['SESSION_ID'];

        this.emit(context.instance.signature, null, data, context);

        return true;
    }

    /**
     *
     * @param path
     * @return {{pipeline: *, metadata: *, instance: *}}
     * @private
     */
    _makeContext(path) {
        const context = {
            pipeline: null,
            instance: null,
            metadata: null,
        };

        const nodeState = this.state.getNodeInfo(path[0]);
        let pipelines = null;
        if (!!nodeState) {
            pipelines = nodeState.data?.pipelines ?? null;
        }

        if (path[1] !== null) {
            // needs pipeline context
            const pipeline = pipelines && pipelines[path[1]] ? pipelines[path[1]] : null;
            if (pipeline) {
                context.pipeline = {
                    name: path[1],
                    type: pipeline.config.TYPE,
                    config: { ...pipeline.config },
                    stats: { ...pipeline.stats },
                    pluginsCount: Object.keys(pipeline.plugins)
                        .map((signature) => Object.keys(pipeline.plugins[signature]).length)
                        .reduce((r, v) => r + v, 0),
                };
            }
        }

        if (path[2] !== null && path[3] !== null) {
            // needs instance context
            const signature = path[2];
            const instanceId = path[3];
            const instance =
                !!nodeState &&
                !!pipelines[path[1]]?.plugins[signature] &&
                !!pipelines[path[1]]?.plugins[signature][instanceId]
                    ? pipelines[path[1]].plugins[signature][instanceId]
                    : null;

            let config = {};
            if (instance !== null && instance?.config !== undefined) {
                config = { ...instance.config };
            }

            let stats = {};
            if (instance !== null && instance?.stats !== undefined) {
                stats = { ...instance.stats };
            }

            context.instance = {
                name: instanceId,
                signature,
                config: config,
                stats: stats,
            };
        }

        return context;
    }

    /**
     * Private method for checking if a specified node is in the controlled fleet or if it's heartbeat has been
     * witnessed.
     *
     * @param {string} node
     * @return {Promise<boolean>}
     * @private
     */
    async _checkNode(node) {
        if (!this.bootOptions.fleet.includes(node)) {
            this.logger.error(`Node ${node} is not registered in the working fleet.`);

            return false;
        }

        // TODO: parse supervisor info for nodes that are missing
        // if (this.alertedNodes[node]) {
        //     this.logger.error(`[Main Thread] Node ${node} is offline.`);
        //
        //     return false;
        // }

        const universe = this.getUniverse();
        if (!universe[node]) {
            this.logger.error(`Node ${node} is either offline or no heartbeat has been witnessed yet.`);

            return false;
        }

        return true;
    }

    /**
     *
     * @param message
     * @private
     */
    _onError(message) {
        this.logger.error(message);
    }

    /**
     *
     * @param message
     * @private
     */
    _toString(message) {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(message);
    }

    /**
     *
     * @param message
     * @private
     */
    _messageIsSigned(message) {
        // todo: check signature
        return true;
    }

    /**
     *
     * @param message
     * @private
     */
    _toJSON(message) {
        return JSON.parse(message);
    }

    /**
     *
     * @param message
     * @private
     */
    _messageIsFromEdgeNode(message) {
        const fromEdgeNode = !!message.EE_PAYLOAD_PATH;

        if (fromEdgeNode) {
            this.state.markNodeAsSeen(message.EE_PAYLOAD_PATH[0], new Date().getTime());
        }

        return fromEdgeNode;
    }

    /**
     *
     * @param message
     * @private
     */
    _messageFromControlledFleet(message) {
        const node = message.EE_PAYLOAD_PATH[0];

        return this.bootOptions.fleet.includes(node);
    }

    /**
     *
     * @param message
     * @private
     */
    _processSupervisorMessage(message) {
        if (message.EE_PAYLOAD_PATH[1]?.toLowerCase() === 'admin_pipeline') {
            const duplicate = { ...message };
            if (this._messageHasKnownFormat(duplicate)) {
                this._decodeToInternalFormat(duplicate).then((decoded) => {
                    if (decoded.EE_PAYLOAD_PATH[2]?.toLowerCase() === 'net_mon_01') {

                    }

                    const context = this._makeContext(decoded.EE_PAYLOAD_PATH);

                    const data = { ...decoded.DATA };
                    delete decoded.DATA;
                    context.metadata = decoded;
                    context.metadata['SESSION_ID'] = data['SESSION_ID'];

                    this.emit(ZxAI_SUPERVISOR_PAYLOAD, null, data, context);
                });
            }
        }
    }

    /**
     *
     * @param message
     * @private
     */
    _messageHasKnownFormat(message) {
        let knownFormat =
            message.EE_FORMATTER === '' ||
            !message.EE_FORMATTER ||
            !!this.formatters[message.EE_FORMATTER.toLowerCase()];

        if (!knownFormat) {
            this.logger.warn(`Unknown format ${message.EE_FORMATTER}. Message dropped.`);
        }

        return knownFormat;
    }

    /**
     *
     * @param message
     * @private
     */
    async _decodeToInternalFormat(message) {
        const format = message.EE_FORMATTER ?? 'raw';
        const internalMessage = this.formatters[format].in(message);

        switch (internalMessage.EE_EVENT_TYPE) {
        case MESSAGE_TYPE_HEARTBEAT:
            internalMessage.DATA = await processHeartbeat(internalMessage.DATA);
            break;
        case MESSAGE_TYPE_NOTIFICATION:
            internalMessage.DATA = notificationProcessor(internalMessage.DATA);
            break;
        case MESSAGE_TYPE_PAYLOAD:
            internalMessage.DATA = payloadProcessor(internalMessage.DATA);
            break;
        }

        return internalMessage;
    }
}
