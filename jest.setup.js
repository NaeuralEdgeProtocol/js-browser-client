const { webcrypto } = require('crypto');
global.crypto = webcrypto;

global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

