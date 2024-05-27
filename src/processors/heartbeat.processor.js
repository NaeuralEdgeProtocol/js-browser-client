import { decode } from '../helper.functions.js';

export const processHeartbeat = async (data) => {
    if (data.ENCODED_DATA) {
        const decoded = JSON.parse(await decode(data.ENCODED_DATA));
        Object.keys(decoded).forEach((key) => {
            data[key] = decoded[key];
        });

        delete data.ENCODED_DATA;
    }

    const raw = { ...data };
    const processed = {
        raw,
    };

    const activePluginsStats = parseActivePlugins(data.ACTIVE_PLUGINS);
    const pipelines = {};

    for (const config of data.CONFIG_STREAMS) {
        const stats = data.DCT_STATS[config.NAME] ?? {};
        const plugins = config.PLUGINS ? parsePluginsConfig(config.PLUGINS, activePluginsStats[config.NAME] ?? {}) : {};
        delete config.PLUGINS;

        pipelines[config.NAME] = {
            config,
            stats,
            plugins: plugins,
        };
    }

    delete data.ACTIVE_PLUGINS;
    delete data.CONFIG_STREAMS;
    delete data.DCT_STATS;

    processed['pipelines'] = pipelines;
    processed['node'] = {
        EE_ID: data.EE_ID,
        EE_VERSION: data.EE_VERSION,
        CURRENT_TIME: data.CURRENT_TIME,
        EE_ADDR: data.EE_ADDR,
        EE_IS_SUPER: data.EE_IS_SUPER,
        SECURED: data.SECURED,
        EE_HB_TIME: data.EE_HB_TIME,
        DEVICE_STATUS: data.DEVICE_STATUS,
        MACHINE_IP: data.MACHINE_IP,
        CPU_USED: 1.7,
        TIMESTAMP: data.TIMESTAMP,
        UPTIME: data.UPTIME,
        STOP_LOG: data.STOP_LOG,
    };

    delete data.EE_ID;
    delete data.EE_VERSION;
    delete data.CURRENT_TIME;
    delete data.EE_ADDR;
    delete data.EE_IS_SUPER;
    delete data.SECURED;
    delete data.EE_HB_TIME;
    delete data.DEVICE_STATUS;
    delete data.MACHINE_IP;
    delete data.CPU_USED;
    delete data.TIMESTAMP;
    delete data.UPTIME;
    delete data.STOP_LOG;

    processed['hardware'] = data;

    return processed;
};

const parseActivePlugins = (plugins) => {
    const activePluginsStats = {};

    plugins.forEach((pluginStats) => {
        if (!activePluginsStats[pluginStats.STREAM_ID]) {
            activePluginsStats[pluginStats.STREAM_ID] = {};
        }

        if (!activePluginsStats[pluginStats.STREAM_ID][pluginStats.SIGNATURE]) {
            activePluginsStats[pluginStats.STREAM_ID][pluginStats.SIGNATURE] = {};
        }

        activePluginsStats[pluginStats.STREAM_ID][pluginStats.SIGNATURE][pluginStats.INSTANCE_ID] = { ...pluginStats };
    });

    return activePluginsStats;
};

const parsePluginsConfig = (plugins, activePluginsStats) => {
    const parsedPlugins = {};
    plugins.forEach((pluginType) => {
        parsedPlugins[pluginType.SIGNATURE] = {};
        pluginType.INSTANCES.forEach((instanceConfig) => {
            let stats = {};
            if (
                activePluginsStats[pluginType.SIGNATURE] !== undefined &&
                activePluginsStats[pluginType.SIGNATURE][instanceConfig.INSTANCE_ID] !== undefined
            ) {
                stats = activePluginsStats[pluginType.SIGNATURE][instanceConfig.INSTANCE_ID];
            }

            parsedPlugins[pluginType.SIGNATURE][instanceConfig.INSTANCE_ID] = {
                config: { ...instanceConfig },
                stats,
            };
        });
    });

    return parsedPlugins;
};
