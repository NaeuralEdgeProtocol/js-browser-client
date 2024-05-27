import { generateId } from '../helper.functions.js';
import {
    NODE_COMMAND_ARCHIVE_CONFIG,
    NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE,
    NODE_COMMAND_PIPELINE_COMMAND,
    NODE_COMMAND_UPDATE_CONFIG,
    NODE_COMMAND_UPDATE_PIPELINE_INSTANCE,
    NOTIFICATION_TYPE_EXCEPTION,
    PIPELINE_ARCHIVE_FAILED,
    PIPELINE_ARCHIVE_OK,
    PIPELINE_DATA_FAILED,
    PIPELINE_DATA_OK,
    PIPELINE_FAILED,
    PIPELINE_OK,
    PLUGIN_CONFIG_IN_PAUSE_FAILED,
    PLUGIN_CONFIG_IN_PAUSE_OK,
    PLUGIN_FAILED,
    PLUGIN_INSTANCE_COMMAND_FAILED,
    PLUGIN_INSTANCE_COMMAND_OK,
    PLUGIN_OK,
    PLUGIN_PAUSE_FAILED,
    PLUGIN_PAUSE_OK,
    PLUGIN_RESUME_FAILED,
    PLUGIN_RESUME_OK,
    PLUGIN_WORKING_HOURS_SHIFT_END,
    PLUGIN_WORKING_HOURS_SHIFT_END_FAILED,
    PLUGIN_WORKING_HOURS_SHIFT_START,
    PLUGIN_WORKING_HOURS_SHIFT_START_FAILED,
} from '../constants.js';

/**
 * Defines the strategy to be applied when attempting to solve an ARCHIVE_CONFIG network request.
 *
 * @param {Object} notification
 * @param {NetworkRequest} request
 */
const archiveConfigRequestStrategy = (notification, request) => {
    switch (notification.context.metadata.NOTIFICATION_CODE) {
        case PIPELINE_ARCHIVE_OK:
            request.resolve();
            break;
        case PIPELINE_ARCHIVE_FAILED:
            request.reject();
            break;
    }
};

/**
 * Defines the strategy to be applied when attempting to solve an UPDATE_CONFIG network request.
 *
 * @param {Object} notification
 * @param {NetworkRequest} request
 */
const updateConfigRequestStrategy = (notification, request) => {
    switch (notification.context.metadata.NOTIFICATION_CODE) {
        case PIPELINE_OK:
        case PIPELINE_DATA_OK:
        case PLUGIN_OK:
        case PLUGIN_RESUME_OK:
        case PLUGIN_PAUSE_OK:
        case PLUGIN_WORKING_HOURS_SHIFT_START:
        case PLUGIN_WORKING_HOURS_SHIFT_END:
        case PLUGIN_CONFIG_IN_PAUSE_OK:
            request.resolve();
            break;
        case PIPELINE_FAILED:
        case PIPELINE_DATA_FAILED:
        case PLUGIN_FAILED:
        case PLUGIN_RESUME_FAILED:
        case PLUGIN_PAUSE_FAILED:
        case PLUGIN_WORKING_HOURS_SHIFT_START_FAILED:
        case PLUGIN_WORKING_HOURS_SHIFT_END_FAILED:
        case PLUGIN_CONFIG_IN_PAUSE_FAILED:
            request.reject();
            break;
    }
};

/**
 * Defines the strategy to be applied when attempting to solve an UPDATE_PIPELINE_INSTANCE or
 * BATCH_UPDATE_PIPELINE_INSTANCE network request.
 *
 * @param {Object} notification
 * @param {NetworkRequest} request
 */
const updatePipelineInstanceRequestStrategy = (notification, request) => {
    switch (notification.context.metadata.NOTIFICATION_CODE) {
        case PLUGIN_OK:
        case PLUGIN_INSTANCE_COMMAND_OK:
        case PLUGIN_RESUME_OK:
        case PLUGIN_PAUSE_OK:
        case PLUGIN_WORKING_HOURS_SHIFT_START:
        case PLUGIN_WORKING_HOURS_SHIFT_END:
        case PLUGIN_CONFIG_IN_PAUSE_OK:
            request.resolve();
            break;
        case PLUGIN_FAILED:
        case PLUGIN_INSTANCE_COMMAND_FAILED:
        case PLUGIN_RESUME_FAILED:
        case PLUGIN_PAUSE_FAILED:
        case PLUGIN_WORKING_HOURS_SHIFT_START_FAILED:
        case PLUGIN_WORKING_HOURS_SHIFT_END_FAILED:
        case PLUGIN_CONFIG_IN_PAUSE_FAILED:
            request.reject();
            break;
    }
};

/**
 * @class NetworkRequest
 *
 * This is the Network Request model. It handles the lifecycle of a request made for a network node and keeps track
 * of the responses received. Based on the notifications intercepted from the node, it attempts to resolve or reject
 * the promise returned upwards.
 */
export class NetworkRequest {
    /**
     * Network request id.
     *
     * @type {string|null}
     */
    id = null;

    /**
     * Request status.
     *
     * @type {boolean|null}
     */
    closed = null;

    /**
     * Success callback.
     *
     * @type {function}
     */
    onSuccess;

    /**
     * Fail callback.
     *
     * @type {function}
     */
    onFail;

    /**
     * A dictionary of targets to track when processing responses. It allows for correctly interpreting the flow
     * of notifications received from the nodes.
     *
     * @type {Object}
     * @private
     */
    targets = {};

    /**
     * A temporary storage for all the incoming notifications. Will be bubbled upwards when resolving the promise.
     *
     * @type {Array<Object>}
     * @private
     */
    transactionNotifications = [];

    /**
     * The strategy to use when interpreting the stream of received notifications.
     *
     * @type {function}
     * @private
     */
    strategy;

    /**
     * Handlers for the timeouts.
     *
     * @type {{completion: number, firstResponse: number}}
     * @private
     */
    timeoutIds = {
        firstResponse: null,
        completion: null,
    };

    /**
     * Reference to the network request handler that keeps track of all the open requests.
     *
     * @type {NetworkRequestsHandler}
     * @private
     */
    nodeRequestsHandler;

    /**
     * The NetworkRequest constructor.
     *
     * @param {NetworkRequestsHandler} handler
     * @param {function} onSuccess
     * @param {function} onFail
     */
    constructor(handler, onSuccess, onFail) {
        this.id = generateId();
        this.closed = false;
        this.onSuccess = onSuccess;
        this.onFail = onFail;
        this.nodeRequestsHandler = handler;
    }

    /**
     * Returns the transaction id.
     *
     * @return {string|null}
     */
    getId() {
        return this.id;
    }

    /**
     * Returns the status of the transaction.
     *
     * @return {boolean}
     */
    isClosed() {
        return this.closed === true;
    }

    /**
     * Closes the transaction and removes the completion timeout.
     *
     * @return {NetworkRequest}
     */
    close() {
        this.closed = true;
        this.clearCompletionTimeout();

        return this;
    }

    /**
     * Registers a notification path to track when resolving the transaction.
     *
     * @param {string[]} path
     * @return {NetworkRequest}
     */
    watch(path) {
        this.targets[path.join(':')] = {
            status: null,
            reason: null,
        };

        this.nodeRequestsHandler.index(path, this);

        return this;
    }

    /**
     * Returns `true` if the current transaction is keeping track of a specific notification `path`.
     *
     * @param  {string[]} path
     * @return {boolean}
     */
    watches(path) {
        return Object.keys(this.targets).includes(path.join(':'));
    }

    /**
     * Returns all the notification `path`s watched by the current transaction.
     *
     * @return {Array<Array<(string|null)>>}
     */
    listWatches() {
        return Object.keys(this.targets).map((key) =>
            key.split(':').map((element) => (element !== '' ? element : null)),
        );
    }

    /**
     * Returns `true` if all the transaction targets were hit. The completion status concerns only if all the
     * expected notifications were received, it doesn't offer information about the success of the request.
     *
     * @return {boolean}
     */
    isComplete() {
        return Object.keys(this.targets)
            .map((path) => this.targets[path].status)
            .reduce((result, status) => result && status !== null, true);
    }

    /**
     * Returns `true` if all the transaction targets were hit and the responses are all successful.
     *
     * @return {boolean}
     */
    canResolve() {
        return Object.keys(this.targets)
            .map((path) => this.targets[path].status)
            .reduce((result, status) => result && status, true);
    }

    /**
     * Pushes a notification onto the list of notifications linked to a specific target `path`.
     *
     * @param {Object} notification
     * @return {NetworkRequest}
     */
    updateTarget(notification) {
        const path = notification.context.metadata.EE_PAYLOAD_PATH;

        this.transactionNotifications.push(notification.data);

        this.targets[path.join(':')].reason = notification.data['NOTIFICATION'];
        this.targets[path.join(':')].status =
            notification.context.metadata.NOTIFICATION_TYPE !== NOTIFICATION_TYPE_EXCEPTION;

        return this;
    }

    /**
     * Loads a solving strategy for the current transaction.
     *
     * @param {function} strategy
     * @return {NetworkRequest}
     */
    setProcessingStrategy(strategy) {
        this.strategy = strategy;

        return this;
    }

    /**
     * Main processing function. All notifications should be routed through this method. When first notification is
     * received, the timeout for the first response is cleared.
     *
     * @param {Object} message
     */
    process(message) {
        if (!this.watches(message.context.metadata.EE_PAYLOAD_PATH) || this.isClosed()) {
            return;
        }

        this.clearFirstResponseTimeout().updateTarget(message);
        if (message.context.metadata.NOTIFICATION_TYPE === NOTIFICATION_TYPE_EXCEPTION) {
            this.reject();
        }

        this.strategy(message, this);
    }

    /**
     * Sets the timeout ids for the two timeout callbacks.
     * - firstResponseTimeoutId is the callback id for the timer waiting for the first network response
     * - completionTimeoutId is the callback id for the timer keeping track of the successful completion of the whole
     * transaction.
     *
     * @param {number} firstResponseTimeoutId
     * @param {number} completionTimeoutId
     * @return {NetworkRequest}
     */
    setTimeoutIds(firstResponseTimeoutId, completionTimeoutId) {
        this.timeoutIds.firstResponse = firstResponseTimeoutId;
        this.timeoutIds.completion = completionTimeoutId;

        return this;
    }

    /**
     * Trigger the timeout on the transaction.
     */
    timeout() {
        this.close();
        this.onFail({
            message: 'FAKE TIMEOUT NOTIFICATION',
        });
    }

    /**
     * Clears the timeout for the first network response.
     *
     * @return {NetworkRequest}
     */
    clearFirstResponseTimeout() {
        if (this.timeoutIds.firstResponse !== null) {
            clearTimeout(this.timeoutIds.firstResponse);
            this.timeoutIds.firstResponse = null;
        }

        return this;
    }

    /**
     * Clears the timeout for the resolving of the transaction.
     *
     * @return {NetworkRequest}
     */
    clearCompletionTimeout() {
        if (this.timeoutIds.completion !== null) {
            clearTimeout(this.timeoutIds.completion);
            this.timeoutIds.completion = null;
        }

        return this;
    }

    /**
     * Attempt to resolve the transaction.
     */
    resolve() {
        if (this.isComplete() && this.canResolve()) {
            this.close();
            this.onSuccess(this.transactionNotifications);
        }
    }

    /**
     * Attempt to reject the transaction.
     */
    reject() {
        if (this.isComplete() && !this.canResolve()) {
            this.close();
            this.onFail(this.transactionNotifications);
        }
    }
}

/**
 * This is the manager keeping track of all the open transactions published for the network nodes.
 */
export class NetworkRequestsHandler {
    /**
     * The list of open transactions.
     *
     * @type {Object}
     * @private
     */
    pendingRequests = {};

    /**
     * The list of object transactions indexed by the notification `path`s targeted.
     *
     * @type {Object}
     * @private
     */
    requestsIndexes = {};

    /**
     * Creates a new transaction handling the message publishing for a network node.
     *
     * @param {string} action
     * @param {function} onSuccess
     * @param {function} onFail
     * @return {NetworkRequest}
     */
    createRequest(action, onSuccess, onFail) {
        const request = new NetworkRequest(this, onSuccess, onFail);

        switch (action) {
            case NODE_COMMAND_UPDATE_PIPELINE_INSTANCE:
            case NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE:
                request.setProcessingStrategy(updatePipelineInstanceRequestStrategy);
                break;
            case NODE_COMMAND_UPDATE_CONFIG:
            case NODE_COMMAND_PIPELINE_COMMAND:
                request.setProcessingStrategy(updateConfigRequestStrategy);
                break;
            case NODE_COMMAND_ARCHIVE_CONFIG:
                request.setProcessingStrategy(archiveConfigRequestStrategy);
                break;
        }

        this.pendingRequests[request.getId()] = request;

        return request;
    }

    /**
     * Indexes the transaction `request` by the specified notification `path` to watch for.
     *
     * @param {string[]} path
     * @param {NetworkRequest} request
     * @return {NetworkRequestsHandler}
     */
    index(path, request) {
        this.requestsIndexes[path.join(':')] = request; // should maybe prefix session_id

        return this;
    }

    /**
     * Retrieves the transaction handler watching for the supplied `path`.
     *
     * @param {string[]} path
     * @return {NetworkRequest|null}
     */
    find(path) {
        return this.requestsIndexes[path.join(':')] ?? null;
    }

    /**
     * Cleans up the transaction handler related to the supplied `path`.
     *
     * @param {string[]} path
     * @return {NetworkRequestsHandler}
     */
    destroy(path) {
        const request = this.find(path);
        if (!request) {
            // already closed.
            return this;
        }

        request.listWatches().forEach((watch) => {
            delete this.requestsIndexes[watch.join(':')];
        });
        delete this.pendingRequests[request.id];

        return this;
    }
}
