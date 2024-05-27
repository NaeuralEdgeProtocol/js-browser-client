/**
 * @jest-environment node
 */

import { beforeAll, describe, expect, test } from '@jest/globals';
import NaeuralBC from '../src/web.blockchain.js';

describe('NaeuralEdgeProtocol Blockchain Tests', () => {
    let mockNaeuralEdgeProtocolBCEngine;

    const dummyPem = `-----BEGIN PRIVATE KEY-----
MIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQgVL9bnC4N8Lyyu/wlDfel
YbNENWKFGADQh0NK+Te+wP+hRANCAAR77XFSL/8i+5PeOSLoTYy1Fyo9gz722qaB
+A+mWoq308QYNQS0srH/OQ5sYtykEJpIUedYjPsZv0J6jf/VORAv
-----END PRIVATE KEY-----`;


    beforeAll(() => {
        mockNaeuralEdgeProtocolBCEngine = new NaeuralBC();

        const blockchainOptions = {
            debug: false,
            key: dummyPem,
            encrypt: false,
            secure: false,
        };

        mockNaeuralEdgeProtocolBCEngine.loadIdentity(blockchainOptions);
    });

    test('Identity correctly loaded', () => {
        const address = mockNaeuralEdgeProtocolBCEngine.getAddress();

        expect(address).toEqual('0xai_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT');
    });

    test('sign', async () => {
        const message = {
            SERVER: 'gts-test',
            COMMAND: 'UPDATE_CONFIG',
            PAYLOAD: { GIGI: 'BUNA' },
        };

        const result = await mockNaeuralEdgeProtocolBCEngine.sign(message);
        let messageToSend = JSON.parse(result);

        expect(messageToSend['EE_SIGN']).not.toBeNull();
        expect(messageToSend['EE_HASH']).toEqual('feca4c4882b2b0cfb872c73bda948b77048ced67b9eeae10c8bdd9028f9d20a1');
        expect(messageToSend['EE_SENDER']).toEqual('0xai_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT');


        expect(await mockNaeuralEdgeProtocolBCEngine.verify(result)).toBe(true);
    });

    test('verify with good signature, 0xai_ address prefix', async () => {
        const receivedMessage = `{
            "SERVER": "gigi",
            "COMMAND": "get",
            "PARAMS": "1",
            "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo",
            "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==",
            "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"
        }`;

        expect(await mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(true);
    });

    test('verify with bad signature', async () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINnzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(await mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad hash', async () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEUCIH9Pm3KyxXSPgsAQ_VmvBP09k69FGJ0U9Ikd1_MgQiasAiEAx_nENZRt2DcPNLj_ReWSFczXIWyYuR9-St3eENVh6TA=", "EE_HASH": "5b5fc7b39c2cd4db70728fae3a665e7a370ceb9ef6a29f511aeb03daf50156fb"}';

        expect(await mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad address', async () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "0xai_AsteqC-MZkBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(await mockNaeuralEdgeProtocolBCEngine.verify(receivedMessage)).toBe(false);
    });

    xtest('encrypt', async () => {
        const data = '{"value": "Hello World"}';
        const destinationAddress = '0xai_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT';

        const encryptedData = await mockNaeuralEdgeProtocolBCEngine.encrypt(data, destinationAddress);
        // const decryptedData = mockNaeuralEdgeProtocolBCEngine.decrypt(encryptedData, destinationAddress);
        //
        // expect(decryptedData).toEqual(data);

        console.log(encryptedData);

        expect(true).toEqual(true);
    });

});
