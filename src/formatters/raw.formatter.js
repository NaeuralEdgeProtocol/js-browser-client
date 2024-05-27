import { envelopeKeys } from '../constants.js';

/**
 * Transforms `raw` messages into the default format.
 * TODO: add link to the internal format docs.
 *
 * @param message
 * @return {Object}
 */
export const rawIn = (message) => {
    const formatted = {};

    for (const key of envelopeKeys) {
        if (message[key]) {
            formatted[key] = message[key];
            delete message[key];
        }
    }

    formatted['DATA'] = message;

    return formatted;
};
