import { describe, expect, test, jest } from '@jest/globals';
import {base64ToUrlSafeBase64, decode, encode, urlSafeBase64ToBase64} from '../src/helper.functions';

const pseudopy = `img = plugin.dataapi_image()
if img is not None:
  plugin.int_cache['trimise'] += 1
  plugin.set_default_image(img)
  if plugin.int_cache['trimise'] > plugin.cfg_max_snapshots:
    plugin.cmdapi_archive_pipeline()
    _result = plugin.int_cache
_result = None`;

const encoded =
    'eJx9j0EKwjAQRfc9xexqEQS3Qj2CFxAZhmSaDjRp6EzF45uAbXeu3+f9/yUG6CFPa5B08WREWVAiBT51jQwghYtCmg0ec+JbA1tYkqEjN/KztUWiKLcvOPdwPSLKhp4HWif7OYuuK7yI/1nuG3VDwEgf1ERZx9m09u96F31dS4sb5c2YJfMkqQ6vIVxYS/Hxbq9qDlQ/fQF/6Voo';


describe('Helper Functions Tests', () => {
    describe('pako (zlib-port) encode/decode tests', () => {
        test('encode()', () => {
            return encode(pseudopy).then((result) => {
                expect(result).toBe(encoded);
            });
        });

        test('decode()', () => {
            return decode(encoded).then((result) => {
                expect(result).toBe(pseudopy);
            });
        });
    });

    describe('urlSafeBase64ToBase64() Tests', () => {
        test('converts URL-safe base64 to regular base64', () => {
            const urlSafeBase64 = 'a-b_cd=';
            const expectedBase64 = 'a+b/cd=';
            expect(urlSafeBase64ToBase64(urlSafeBase64)).toBe(expectedBase64);
        });

        test('handles empty string', () => {
            const urlSafeBase64 = '';
            const expectedBase64 = '';
            expect(urlSafeBase64ToBase64(urlSafeBase64)).toBe(expectedBase64);
        });
    });

    describe('base64ToUrlSafeBase64() Tests', () => {
        test('converts regular base64 to URL-safe base64', () => {
            const base64 = 'a+b/cd=';
            const expectedUrlSafeBase64 = 'a-b_cd=';
            expect(base64ToUrlSafeBase64(base64)).toBe(expectedUrlSafeBase64);
        });

        test('handles empty string', () => {
            const base64 = '';
            const expectedUrlSafeBase64 = '';
            expect(base64ToUrlSafeBase64(base64)).toBe(expectedUrlSafeBase64);
        });
    });
});
