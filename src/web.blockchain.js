import asn1 from 'asn1.js';
import stringify from 'json-stable-stringify';
import {base64ToUrlSafeBase64, urlSafeBase64ToBase64} from './helper.functions.js';
import {ec as EC} from 'elliptic';
import {BN} from 'bn.js';
import {Buffer} from 'buffer';
import {words} from './utils/words';

const EE_SIGN = 'EE_SIGN';
const EE_SENDER = 'EE_SENDER';
const EE_HASH = 'EE_HASH';
const ADDR_PREFIX = '0xai_';
const ALLOWED_PREFIXES = ['0xai_', 'aixp_'];
const NON_DATA_FIELDS = [EE_SIGN, EE_SENDER, EE_HASH];

const ECPrivateKey = asn1.define('ECPrivateKey', function () {
    this.seq().obj(
        this.key('version').int(),
        this.key('privateKey').octstr(),
        this.key('publicKey').explicit(1).optional().bitstr()
    );
});

const PKCS8 = asn1.define('PKCS8', function () {
    this.seq().obj(
        this.key('version').int(),
        this.key('privateKeyAlgorithm').seq().obj(
            this.key('algorithm').objid(),
            this.key('parameters').objid()
        ),
        this.key('privateKey').octstr(),
    );
});

/**
 * @class NaeuralBC
 *
 * This is the NaeuralEdgeProtocol Network Blockchain engine. Its purpose is to offer any integrator common features like
 * signature checking, message validation or key pair generation.
 */
export class NaeuralBC {
    keyPair;

    /**
     * A handy cache for the public key.
     *
     * @type {string}
     * @private
     */
    compressedPublicKey = '';

    /**
     * Flag to boot the engine in debug mode. Will output signature verification logs.
     *
     * @type {boolean}
     * @private
     */
    debugMode = false;

    static ec = new EC('secp256k1');

    loadIdentity(options) {
        if (options.key) {
            this.keyPair = NaeuralBC.loadPrivateKey(options.key);
        } else {
            this.keyPair = NaeuralBC.generateKeys();
        }

        this.debugMode = options.debug || false;
        this.compressedPublicKey = NaeuralBC.compressPublicKeyObject(this.keyPair.getPublic(true, 'hex'));

        if (this.debugMode) {
            console.log('NaeuralEdgeProtocol Blockchain address: ' + this.getAddress());
        }
    }

    /**
     * Generates a pair of public-private keys using the secp256k1 curve.
     *
     * @return {object} An object containing the keys where keys are instances of `elliptic` keys
     */
    static generateKeys() {
        const ec = this.ec('secp256k1');
        const keyPair = ec.genKeyPair();
        const publicKey = keyPair.getPublic();
        const privateKey = keyPair.getPrivate();

        return {
            publicKey: publicKey.encode('hex'),  // Encoding to hex for easier handling/display
            privateKey: privateKey.toString(),
        };
    }

    static generateRandomWords(numWords = 24) {
        const randomWords = [];

        let i = 0;
        while (i < numWords) {
            const randomIndex = Math.floor(Math.random() * words.length);
            if (!randomWords.includes(words[randomIndex])) {
                randomWords.push(words[randomIndex]);
                i++;
            }
        }

        return randomWords;
    }

    static async generateIdentityFromSecretWords(words) {
        const asString = words.join(';');
        const encoder = new TextEncoder();
        const encodedInput = encoder.encode(asString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

        const hashInt = BigInt(`0x${hashHex}`);
        const orderN = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
        const validSeed = hashInt % orderN;

        return this.ec.keyFromPrivate(validSeed.toString(16));
    }

    static convertEllipticPrivateKeyToPKCS8DER(privateKeyHex) {
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

        const ecPrivateKey = ECPrivateKey.encode({
            version: 1,
            privateKey: privateKeyBuffer,
        }, 'der');

        return PKCS8.encode({
            version: 0,
            privateKeyAlgorithm: {
                algorithm: [1, 2, 840, 10045, 2, 1],
                parameters: [1, 3, 132, 0, 10]
            },
            privateKey: ecPrivateKey
        }, 'der');
    }

    static convertECKeyPairToPEM(keyPair) {
        const privateKeyHex = keyPair.getPrivate('hex');
        const publicKeyHex = keyPair.getPublic('hex').slice(2);
        const pkcs8DER = NaeuralBC.convertEllipticPrivateKeyToPKCS8DER(privateKeyHex, publicKeyHex);

        return `-----BEGIN PRIVATE KEY-----\n${pkcs8DER.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
    }

    /**
     * Loads a PEM formatted private key into an elliptic key pair
     */
    static loadPrivateKey(pem) {
        const pemHeader = "-----BEGIN PRIVATE KEY-----";
        const pemFooter = "-----END PRIVATE KEY-----";
        const base64 = pem.replace(/\n|\r/g, '').replace(pemHeader, '').replace(pemFooter, '').trim();
        const definition = PKCS8.decode(Buffer.from(base64, 'base64'), 'der');
        const keyData = ECPrivateKey.decode(definition.privateKey, 'der');

        return this.ec.keyFromPrivate(keyData.privateKey, 'hex');
    }

    static async pemFromSecretWords(words) {
        const identity = await NaeuralBC.generateIdentityFromSecretWords(words);

        return NaeuralBC.convertECKeyPairToPEM(identity);
    }

    /**
     * Removes the prefix from the address.
     *
     * @param {string} address
     * @return {string}
     * @private
     */
    static _removeAddressPrefix(address) {
        let pkB64 = address;
        ALLOWED_PREFIXES.forEach((prefix) => {
            pkB64 = pkB64.replace(prefix, '');
        });

        return pkB64;
    }

    /**
     * Converts a compressed public key address to an elliptic curve public key object.
     *
     * @param {string} address The public key address with potential prefix.
     * @return An elliptic curve public key object.
     */
    static addressToECPublicKey(address) {
        const pkB64 = this._removeAddressPrefix(address);
        const standardB64 = urlSafeBase64ToBase64(pkB64);
        const binaryString = atob(standardB64);
        let hexString = '';
        for (let i = 0; i < binaryString.length; i++) {
            const hex = binaryString.charCodeAt(i).toString(16);
            hexString += (hex.length === 1 ? '0' : '') + hex;
        }

        return this.ec.keyFromPublic(hexString, 'hex');
    }

    /**
     * Compresses an elliptic curve public key object.
     *
     * @param publicKey An elliptic curve public key object.
     * @return {string} The compressed public key as a hex string.
     */
    static compressPublicKeyObject(publicKey) {
        const compressedPublicKey = Buffer.from(publicKey, 'hex');
        const base64String = compressedPublicKey.toString('base64');

        return base64ToUrlSafeBase64(base64String);
    }

    static addressFromPublicKey(publicKey) {
        return ADDR_PREFIX + this.compressPublicKeyObject(publicKey);
    }

    /**
     * Returns the NaeuralEdgeProtocol Network blockchain address.
     *
     * @return {string} the NaeuralEdgeProtocol Network Address
     */
    getAddress() {
        return ADDR_PREFIX + this.compressedPublicKey;
    }

    /**
     * Returns the signed input object with all the cryptographical metadata appended to it. The format can be either
     * `json` or `object` and it allows the caller to select the format of the returned value.
     *
     * @param {object|string} input the input to be signed
     * @param {string} format selector for the returned value
     * @return {string|any} the signed input
     */
    async sign(input, format = 'json') {
        const { binHash } = await this._getHash(input);
        const signatureB64 = await this._signHash(binHash);

        return this._prepareMessage(input, signatureB64, format);
    }

    /**
     * Verifies the message signature. If the message is incorrectly signed, will return false.
     *
     * @param {string} fullJSONMessage the message to verify
     * @return {boolean} verification result
     */
    async verify(fullJSONMessage) {
        let hashResult = false;
        let signatureResult = false;
        let objReceived;

        try {
            objReceived = JSON.parse(fullJSONMessage);
        } catch (e) {
            return false;
        }

        const signatureB64 = objReceived[EE_SIGN];
        const pkB64 = objReceived[EE_SENDER] ? NaeuralBC._removeAddressPrefix(objReceived[EE_SENDER]) : null;
        const receivedHash = objReceived[EE_HASH];
        const objData = Object.fromEntries(
            Object.entries(objReceived).filter(([key]) => !NON_DATA_FIELDS.includes(key)),
        );
        const strData = stringify(objData);

        const encoder = new TextEncoder();
        const encodedInput = encoder.encode(strData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);
        const hashArray = new Uint8Array(hashBuffer);
        const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex !== receivedHash) {
            hashResult = false;
            if (this.debugMode) {
                console.log(
                    'Hashes do not match or public key is missing:\n',
                    '  Computed: ' + hashHex + '\n',
                    '  Received: ' + receivedHash + '\n',
                    '  Public key:' + pkB64 + '\n',
                    '  Data: ' + JSON.stringify(objData) + '\n',
                    '  Stringify: \'' + strData + '\'',
                );
            }
        } else {
            hashResult = true;
        }

        if (pkB64) {
            const signatureBuffer = Buffer.from(urlSafeBase64ToBase64(signatureB64), 'base64');
            const publicKeyObj = NaeuralBC.addressToECPublicKey(pkB64);

            const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', hashArray));
            signatureResult = NaeuralBC.ec.verify([...hash], [...signatureBuffer], publicKeyObj);
        }

        return hashResult && signatureResult;
    }

    // async encrypt(message, destinationAddress) {
    //     const encoder = new TextEncoder();
    //     const destinationKey = NaeuralBC.addressToECPublicKey(destinationAddress);
    //     const sharedKey = await this._deriveSharedKey(destinationKey.getPublic());
    //
    //     const iv = crypto.getRandomValues(new Uint8Array(12));
    //
    //     const key = await crypto.subtle.importKey(
    //         'raw',
    //         sharedKey,
    //         { name: 'AES-GCM', length: 256 },
    //         false,
    //         ['encrypt']
    //     );
    //
    //     const encryptedData = await window.crypto.subtle.encrypt(
    //         { name: 'AES-GCM', iv: iv },
    //         key,
    //         encoder.encode(message)
    //     );
    //
    //     const encryptedArray = new Uint8Array(encryptedData);
    //     const combined = new Uint8Array(iv.length + encryptedArray.length);
    //     combined.set(iv);
    //     combined.set(encryptedArray, iv.length);
    //
    //     return this._arrayBufferToBase64(combined);
    // }
    //
    // _arrayBufferToBase64(buffer) {
    //     let binary = '';
    //     const bytes = new Uint8Array(buffer);
    //     for (let i = 0; i < bytes.byteLength; i++) {
    //         binary += String.fromCharCode(bytes[i]);
    //     }
    //     return window.btoa(binary);
    // }

    /**
     * Returns the hash for a provided input. Inputs can be either a string or an object. Any other datatype will
     * throw an error.
     *
     * @param input
     * @return {Promise<{strHash: string, binHash: Uint8Array}>}
     * @private
     */
    async _getHash(input) {
        let inputString;

        if (typeof input === 'object') {
            inputString = stringify(input);
        } else if (typeof input === 'string') {
            inputString = input;
        } else {
            throw new Error('Unsupported input type. Input must be a string or object.');
        }

        const encoder = new TextEncoder();
        const encodedInput = encoder.encode(inputString);

        const hashBuffer = await crypto.subtle.digest('SHA-256', encodedInput);
        const hashArray = new Uint8Array(hashBuffer);

        // Convert the byte array to a hexadecimal string
        const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');

        return {
            strHash: hashHex,
            binHash: hashArray,
        };
    }

    /**
     * Signs a hash and returns the signature in base64 format.
     * @param {Uint8Array} hash - The binary hash to sign, expected as a Uint8Array
     * @returns {Promise<string>} - The base64-encoded signature
     */
    async _signHash(hash) {
        const keyPair = this.keyPair;

        const hashBuffer = new Uint8Array(await crypto.subtle.digest('SHA-256', hash));
        const options = { k: () => { return new BN(Math.round(Math.random() * 10000)); } };
        const signature = keyPair.sign(hashBuffer, options);

        return base64ToUrlSafeBase64(Buffer.from(signature.toDER('hex'), 'hex').toString('base64'));
    }

    /**
     * Generates and applies all the signatures and hashes to the input object. The format can be either
     * `json` or `object` and it allows the caller to select the format of the returned value.
     *
     * @param input
     * @param {string} signatureB64 the signature
     * @param {string} format the format to return
     * @return {object|string} the original object with signature properties appended
     * @private
     */
    async _prepareMessage(input, signatureB64, format) {
        const message = Object.assign({}, input, {
            [EE_SIGN]: signatureB64,
            [EE_SENDER]: this.getAddress(),
            [EE_HASH]: (await this._getHash(input)).strHash,
        });

        if (format === 'json') {
            return JSON.stringify(message);
        } else if (format === 'object') {
            return message;
        } else {
            throw new Error('Unsupported format. Format must be either "object" or "json".');
        }
    }

    // /**
    //  *
    //  * @param peerPublicKey
    //  * @return {*}
    //  * @private
    //  */
    // async _deriveSharedKey(peerPublicKey) {
    //     const encoder = new TextEncoder();
    //     const sharedSecret = this.keyPair.derive(peerPublicKey);
    //
    //     const saltBuffer = encoder.encode(null);
    //     const infoBuffer = encoder.encode('0xai handshake data');
    //     const derivedKey = await crypto.subtle.deriveKey(
    //         {
    //             name: "HKDF",
    //             hash: "SHA-256",
    //             salt: saltBuffer,
    //             info: infoBuffer
    //         },
    //         sharedSecret,
    //         { name: "AES-GCM", length: 32 },
    //         true,
    //         ["encrypt", "decrypt"]
    //     );
    //
    //     return Buffer.from(derivedKey);
    // }
}

export default NaeuralBC;
