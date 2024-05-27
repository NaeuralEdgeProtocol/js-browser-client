/**
 * The default formatter. Does not alter the received message.
 *
 * @param message
 * @return {*}
 */
export const identityFormatter = (message) => {
    return message;
};
