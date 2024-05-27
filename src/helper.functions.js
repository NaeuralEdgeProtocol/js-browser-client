import * as pako from 'pako';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents the configuration for an interval.
 * @typedef {Object} IntervalDefinition
 * @property {number} [min] The minimum value for the interval
 * @property {number} [max] The maximum value for the interval
 */

/**
 * Represents the allowed values for a field.
 * @typedef {string[]|IntervalDefinition} AllowedValues
 */

/**
 * Represents a field in the configuration.
 * @typedef {Object} Field
 * @property {string} key - The key identifier for the field.
 * @property {string} type - The type of the field (e.g., 'integer').
 * @property {string} label - The human-readable label for the field.
 * @property {string} description - The description of the field.
 * @property {*} default - The default value for the field.
 * @property {boolean} required - Whether the field is required.
 * @property {AllowedValues} [allowedValues] - The allowed values for the field.
 */

/**
 * Represents the schema configuration
 * @typedef {Object} SchemaDefinition
 * @property {*} [options] - Optional property describing other options.
 * @property {string} name - The name of the DCT.
 * @property {string} description - The description of the DCT.
 * @property {string} type - The type of the DCT, indicating the specific DCT type.
 * @property {Field[]} fields - An array of fields for the DCT configuration.
 */

/**
 * A dictionary object holding schema configurations
 * @typedef {Object.<string, SchemaDefinition>} SchemaCollection
 */

/**
 * @typedef {{dct: SchemaCollection, plugins: SchemaCollection}} SchemasRepository
 */


/**
 * Helper function for zipping a string and encoding the result as base64.
 *
 * @param {string} code
 * @return {Promise<string>}
 */
export const encode = (code) => {
    return new Promise((resolve, reject) => {
        try {
            // Convert string to Uint8Array
            const textEncoder = new TextEncoder();
            const input = textEncoder.encode(code);

            // Deflate (compress) the input
            const compressed = pako.deflate(input);

            // Convert Uint8Array to base64
            const base64Encoded = btoa(String.fromCharCode(...compressed));
            resolve(base64Encoded);
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Helper function for unzipping a string that has been received as base64.
 *
 * @param {string} value the base64 encoded and zipped information.
 * @return {Promise<string>}
 */
export const decode = (value) => {
    return new Promise((resolve, reject) => {
        try {
            // Convert base64 to Uint8Array
            const input = Uint8Array.from(atob(value), c => c.charCodeAt(0));

            // Inflate (decompress) the input
            const decompressed = pako.inflate(input);

            // Convert Uint8Array to string
            const textDecoder = new TextDecoder();
            const result = textDecoder.decode(decompressed);
            resolve(result);
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Helper function that reverts any replaced URL-unsafe characters in a base64 string.
 *
 * @param {string} urlSafeBase64
 * @return {string}
 */
export const urlSafeBase64ToBase64 = (urlSafeBase64) => {
    return urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
};

/**
 * Helper function that replaces any URL-unsafe characters from a base64 string.
 *
 * @param {string} base64
 * @return {string}
 */
export const base64ToUrlSafeBase64 = (base64) => {
    return base64.replace(/\+/g, '-').replace(/\//g, '_');
};

/**
 * Helper function for checking if a value-object is of a specific type (as defined in the schema) and if it's value
 * complies with the allowedValues rule.
 *
 * @param {Object} value
 * @param {string} type
 * @param {AllowedValues} allowedValues
 * @return {boolean}
 */
export const checkType = (value, type, allowedValues) => {
    if (!type) {
        return false;
    }

    switch (type) {
    case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            return false;
        }
        break;
    case 'float':
        if (typeof value !== 'number') {
            return false;
        }
        break;
    case 'boolean':
        if (typeof value !== 'boolean') {
            return false;
        }
        break;
    case 'string':
        if (typeof value !== 'string') {
            return false;
        }

        if (Array.isArray(allowedValues) && !allowedValues.includes(value)) {
            return false;
        }
        break;
    case 'object':
        return true;
    default:
        if (type.startsWith('array(')) {
            if (!Array.isArray(value)) {
                return false;
            }

            return value.every((element) => checkType(element, type.slice(6, -1), allowedValues));
        }

        return false;
    }

    if (allowedValues && (type === 'integer' || type === 'float')) {
        if (!Array.isArray(allowedValues) && allowedValues.min !== undefined && value < allowedValues.min) {
            return false;
        }

        if (!Array.isArray(allowedValues) && allowedValues.max !== undefined && value > allowedValues.max) {
            return false;
        }
    }

    return true;
};

/**
 * Helper function that validates a generic object based on a received schema. Will return an array of all the validation
 * errors, if any, empty array otherwise. This function will not check if all the mandatory keys are present, it will
 * only test if the provided values are of the correct type and the allowedValues rule is not broken.
 *
 * @param {Object} obj The object to test against the schema
 * @param {SchemaDefinition|null} schema The schema.
 * @return {Array<string>} The validation errors.
 */
export const validateAgainstSchema = (obj, schema) => {
    if (!schema) {
        return [];
    }
    const errors = [];

    for (let key in obj) {
        if (Object.hasOwn(obj, key)) {
            const field = schema.fields.find((f) => f.key === key);

            if (!field) {
                // errors.push(`Key '${key}' is not defined in the schema.`);
                continue;
            }

            const value = obj[key];

            if (!checkType(value, field.type, field.allowedValues)) {
                let message = `Validation failed for key '${key}'. Received value ${JSON.stringify(
                    value,
                )} of type ${typeof value}. Expected type: ${field.type}`;
                if (field.allowedValues) {
                    message += `, Allowed values: ${JSON.stringify(field.allowedValues)}`;
                }
                errors.push(message);
            }
        }
    }

    return errors;
};

/**
 * Helper function that returns an object with all the missing mandatory properties based on a generic object provided.
 * The mandatory properties are compuded based on the provided schema. All the properties added are assigned the default
 * values from the schema definition. If no default value is provided in the schema, the property is not added to the
 * returned object.
 *
 * @param {Object} obj The generic object.
 * @param {SchemaDefinition|null} schema The schema.
 * @param {boolean} addOptionals
 * @return {Object} A new object with all the missing properties.
 */
export const applyDefaultsToObject = (obj, schema, addOptionals = false) => {
    if (!schema) {
        return { ...obj };
    }

    const returnable = { ...obj };
    schema.fields.forEach((field) => {
        if (
            (addOptionals || field.required) &&
            (returnable[field.key] === undefined || returnable[field.key] === null)
        ) {
            if (Object.hasOwn(field, 'default')) {
                returnable[field.key] = field.default;
            }
        }
    });

    return returnable;
};

/**
 * Helper function that tests a generic object to have all the mandatory properties populated.
 *
 * @param {Object} obj The generic object.
 * @param {SchemaDefinition|null} schema The schema.
 * @return {boolean} `true` if all the mandatory properties have values.
 */
export const checkMandatoryFields = (obj, schema) => {
    if (!schema) {
        return true;
    }

    return schema.fields.every((field) => {
        if (field.required) {
            return Object.hasOwn(obj, field.key) && obj[field.key] !== null;
        }
        return true;
    });
};

/**
 * Helper function that tests if a specific value is an Object.
 *
 * @param {*} value the value to test
 * @return {boolean}
 */
export const IsObject = (value) => {
    return typeof value === 'object' && !Array.isArray(value);
};

/**
 * Helper function that extracts the first two groups of characters from a v4 Uuid. This function can be used for
 * generating unique identification strings for threads, messages or other entities.
 *
 * @return {string}
 */
export const generateId = () => {
    return uuidv4().substring(0, 13);
};

/**
 * Helper function that compares two generic objects and returns the modified keys from the second object when compared
 * to the first.
 *
 * @param {Object} original
 * @param {Object} modified
 * @return {Object|null}
 */
export const computeDifferences = (original, modified) => {
    let differences = {};

    for (const key in modified) {
        if (Object.hasOwn(modified, key)) {
            const originalValue = original[key];
            const modifiedValue = modified[key];

            if (typeof originalValue === 'object' || typeof modifiedValue === 'object') {
                if (JSON.stringify(originalValue) !== JSON.stringify(modifiedValue)) {
                    differences[key] = modifiedValue;
                }
            } else if (!Object.hasOwn(original, key) || originalValue !== modifiedValue) {
                differences[key] = modifiedValue;
            }
        }
    }

    return Object.keys(differences).length > 0 ? differences : null;
};