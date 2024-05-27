export const payloadProcessor = (data) => {
    const keys = Object.keys(data);

    data['PLUGIN_META'] = {};
    data['PIPELINE_META'] = {};

    keys.forEach((key) => {
        if (key.substring(0, 3) === '_P_') {
            data['PLUGIN_META'][key] = data[key];
            delete data[key];
        } else if (key.substring(0, 3) === '_C_') {
            data['PIPELINE_META'][key] = data[key];
            delete data[key];
        }
    });

    return data;
};
