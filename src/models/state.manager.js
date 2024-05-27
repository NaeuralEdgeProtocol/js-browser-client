import EventEmitter2 from 'eventemitter2';
import { NetworkRequestsHandler } from './network.requests.handler';
import {TIMEOUT_MAX_REQUEST_TIME, TIMEOUT_TO_FIRST_RESPONSE} from '../constants';

export class StateManager extends EventEmitter2 {
    state = {
        hb: {},
        pending: {},
        universe: {},
        network: {},
    };

    logger;

    /**
     * The open network transactions handler.
     *
     * @type {NetworkRequestsHandler}
     * @private
     */
    networkRequestsHandler;

    constructor(logger) {
        super();
        this.logger = logger;
        this.networkRequestsHandler = new NetworkRequestsHandler();
    }

    nodeInfoUpdate(info){
        const now = new Date().getTime();
        const path = info.EE_PAYLOAD_PATH;
        const nodeTime = {
            date: info.EE_TIMESTAMP,
            utc: info.EE_TIMEZONE,
        };
        const data = info.DATA;

        if (!this.state.hb[path[0]]) {
            this.state.hb[path[0]] = {
                lastUpdate: null,
                nodeTime: null,
                data: null,
            };
        }

        this.state.hb[path[0]].lastUpdate = now;
        this.state.hb[path[0]].nodeTime = { ...nodeTime };
        this.state.hb[path[0]].data = { ...data };

        this.emit('state.update', this.state.hb[path[0]].data);

        return this;
    }

    getUniverse() {
        return this.state.universe;
    }

    /**
     * Retrieves the cached heartbeat info.
     *
     * @param node
     * @return {Object}
     */
    getNodeInfo(node) {
        return this.state.hb[node] !== undefined ? this.state.hb[node] : null;
    }

    /**
     * Returns the configuration of a specific pipeline running on the requested node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @return {Object}
     */
    getRunningPipelineConfig(node, pipelineId) {
        const nodeInfo = this.getNodeInfo(node);
        const pipelines = nodeInfo?.data?.pipelines;
        if (pipelines && pipelines[pipelineId] !== undefined) {
            return pipelines[pipelineId].config;
        }
        return null;
    }

    /**
     * Returns the configuration of a specific instance deployed on a pipeline running on the provided node.
     *
     * @param {string} node
     * @param {string} pipelineId
     * @param {string} instanceId
     * @return {Object}
     */
    getRunningInstanceConfig(node, pipelineId, instanceId) {
        const nodeInfo = this.getNodeInfo(node);
        const pipelines = nodeInfo?.data?.pipelines;
        if (pipelines && pipelines[pipelineId] !== undefined) {
            for (const signature of Object.keys(pipelines[pipelineId].plugins)) {
                const instance = pipelines[pipelineId].plugins[signature][instanceId];
                if (instance) {
                    return instance.config;
                }
            }
        }
        return null;
    }

    updateNetworkSnapshot(supervisor, update) {
        this.state.network[supervisor] = update;

        return true;
    }

    getNetworkSupervisors() {
        return Object.keys(this.state.network);
    }

    getNetworkSnapshot(supervisor) {
        return this.state.network[supervisor] ?? null;
    }

    markNodeAsSeen(node, timestamp) {
        this.state.universe[node] = timestamp;

        return true;
    }

    /**
     * Creates and configures a new transaction that will follow the completion of the request published to the
     * network.
     *
     * @param {Object} message
     * @param {Array<Array<string>>} watches
     * @param {function} onSuccess
     * @param {function} onFail
     * @return {NetworkRequest}
     */
    registerMessage(message, watches, onSuccess, onFail) {
        const request = this.networkRequestsHandler.createRequest(message['ACTION'], onSuccess, onFail);
        watches.forEach((watchPath) => {
            request.watch(watchPath);
        });

        const firstResponseTimeout = setTimeout(() => {
            request.timeout();
        }, TIMEOUT_TO_FIRST_RESPONSE);
        const completeTimeout = setTimeout(() => {
            request.timeout();
        }, TIMEOUT_MAX_REQUEST_TIME);
        request.setTimeoutIds(firstResponseTimeout, completeTimeout);

        return request;
    }

    onRequestResponseNotification(message) {
        const request = this.networkRequestsHandler.find(message.context.metadata.EE_PAYLOAD_PATH);
        if (request) {
            request.process(message);
            if (request.isClosed()) {
                this.networkRequestsHandler.destroy(message.context.metadata.EE_PAYLOAD_PATH);
            }
        }
    }
}

