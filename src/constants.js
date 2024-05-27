/**
 * @typedef {Object} ZxAICommand
 * @property {string} ACTION The action to be performed on the network node
 * @property {Object|string} PAYLOAD The payload for the forementioned `ACTION`
 * @property {string} [EE_ID] The node identificator to route the command to, is optional up until the actual publishing.
 * @property {string} [EE_SENDER] The identity of the sender, is optional up until publishing
 * @property {string} [EE_HASH] The sha256 hash of the `ACTION` and `PAYLOAD`
 * @property {string} [EE_SIGN] The signature of the `EE_HASH` using the `EE_SENDER`'s identity
 * @property {string} [INITIATOR_ID] Optional until publishing, the human-readable identity of the sender.
 * @property {string} [SESSION_ID] Optional, the session ID to be used when performing the action.
 */

/**
 * @typedef {Object} ZxAIUpdateInstanceConfig
 * @property {string} NAME The pipeline id
 * @property {string} SIGNATURE The instance signature
 * @property {string} INSTANCE_ID The instance id
 * @property {Object} INSTANCE_CONFIG The new configuration to be applied for the instance
 */

export const envelopeKeys = [
    'EE_SENDER',
    'EE_HASH',
    'EE_SIGN',
    'EE_PAYLOAD_PATH',
    'EE_EVENT_TYPE',
    'EE_MESSAGE_ID',
    'EE_MESSAGE_SEQ',
    'EE_TOTAL_MESSAGES',
    'EE_TIMESTAMP',
    'EE_TIMEZONE',
    'EE_TZ',
    'DATA',
];

export const MESSAGE_TYPE_HEARTBEAT = 'HEARTBEAT';
export const MESSAGE_TYPE_PAYLOAD = 'PAYLOAD';
export const MESSAGE_TYPE_NOTIFICATION = 'NOTIFICATION';
export const HEARTBEATS_STREAM = 'heartbeats';
export const PAYLOADS_STREAM = 'payloads';
export const NOTIFICATIONS_STREAM = 'notifications';

export const ALL_EDGE_NODES = '*';
export const STICKY_COMMAND_ID_KEY = '__COMMAND_ID';

export const NETWORK_REQUEST_RESPONSE_NOTIFICATION = 'network.request.response.notification';
export const NETWORK_STICKY_PAYLOAD_RECEIVED = 'network.sticky.payload.received';
export const SECOND = 1000;

export const TIMEOUT_MAX_REQUEST_TIME = 90 * SECOND;
export const TIMEOUT_TO_FIRST_RESPONSE = 1500 * SECOND;

export const REST_CUSTOM_EXEC_SIGNATURE = 'REST_CUSTOM_EXEC_01';

// Node Commands
export const NODE_COMMAND_ARCHIVE_CONFIG = 'ARCHIVE_CONFIG';
export const NODE_COMMAND_ARCHIVE_CONFIG_ALL = 'ARCHIVE_CONFIG_ALL';
export const NODE_COMMAND_BATCH_UPDATE_PIPELINE_INSTANCE = 'BATCH_UPDATE_PIPELINE_INSTANCE';
export const NODE_COMMAND_DELETE_CONFIG_ALL = 'DELETE_CONFIG_ALL';
export const NODE_COMMAND_PIPELINE_COMMAND = 'PIPELINE_COMMAND';
export const NODE_COMMAND_UPDATE_CONFIG = 'UPDATE_CONFIG';
export const NODE_COMMAND_UPDATE_PIPELINE_INSTANCE = 'UPDATE_PIPELINE_INSTANCE';

// Network client events
export const ZxAI_CLIENT_CONNECTED = 'ZxAICCONNSUCCESS';
export const ZxAI_CLIENT_SYS_TOPIC_SUBSCRIBE = 'ZxAICSTS';
export const ZxAI_BC_ADDRESS = 'ZxAIBCADDR';
export const ZxAI_CLIENT_BOOTED = 'ZxAIBOOT';
export const ZxAI_ENGINE_REGISTERED = 'ZxAIEEREG';
export const ZxAI_ENGINE_DEREGISTERED = 'ZxAIEEDEREG';
export const ZxAI_RECEIVED_HEARTBEAT_FROM_ENGINE = 'ZxAICONEE';
export const ZxAI_CLIENT_SYS_TOPIC_UNSUBSCRIBE = 'ZxAICSTUS';
export const ZxAI_CLIENT_DISCONNECTED = 'ZxAICDISCONN';
export const ZxAI_CLIENT_CONNECTION_ERROR = 'ZxAICCONNERR';
export const ZxAI_CLIENT_SHUTDOWN = 'ZxAISHUTDOWN';
export const ZxAI_EXCEPTION = 'ZxAIEX';
export const ZxAI_ENGINE_OFFLINE = 'ZxAIEEOFF';
export const ZxAI_ENGINE_ONLINE = 'ZxAIEEON';
export const ZxAI_SUPERVISOR_PAYLOAD = 'ZxAISUPERPAY';

// NOTIFICATION TYPES
export const NOTIFICATION_TYPE_EXCEPTION = 'EXCEPTION';
export const NOTIFICATION_TYPE_NORMAL = 'NORMAL';
export const NOTIFICATION_TYPE_ABNORMAL = 'ABNORMAL FUNCTIONING';

// RESPONSE CODES
export const PIPELINE_OK = 1;
export const PIPELINE_FAILED = -PIPELINE_OK;
export const PIPELINE_DATA_OK = PIPELINE_OK + 1;
export const PIPELINE_DATA_FAILED = -PIPELINE_DATA_OK;
export const PIPELINE_DCT_CONFIG_OK = PIPELINE_DATA_OK + 1;
export const PIPELINE_DCT_CONFIG_FAILED = -PIPELINE_DCT_CONFIG_OK;
export const PIPELINE_ARCHIVE_OK = PIPELINE_DCT_CONFIG_OK + 1;
export const PIPELINE_ARCHIVE_FAILED = -PIPELINE_ARCHIVE_OK;
export const PLUGIN_OK = 100;
export const PLUGIN_INSTANCE_COMMAND_OK = 101;
export const PLUGIN_FAILED = -PLUGIN_OK;
export const PLUGIN_INSTANCE_COMMAND_FAILED = -PLUGIN_INSTANCE_COMMAND_OK;
export const PLUGIN_PAUSE_OK = 110;
export const PLUGIN_PAUSE_FAILED = -PLUGIN_PAUSE_OK;
export const PLUGIN_RESUME_OK = 111;
export const PLUGIN_RESUME_FAILED = -PLUGIN_RESUME_OK;
export const PLUGIN_WORKING_HOURS_SHIFT_START = 112;
export const PLUGIN_WORKING_HOURS_SHIFT_START_FAILED = -PLUGIN_WORKING_HOURS_SHIFT_START;
export const PLUGIN_WORKING_HOURS_SHIFT_END = 113;
export const PLUGIN_WORKING_HOURS_SHIFT_END_FAILED = -PLUGIN_WORKING_HOURS_SHIFT_END;
export const PLUGIN_CONFIG_IN_PAUSE_OK = 120;
export const PLUGIN_CONFIG_IN_PAUSE_FAILED = -PLUGIN_CONFIG_IN_PAUSE_OK;
