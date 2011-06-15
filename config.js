var config = exports;

config.mongodb = {
    host:     '127.0.0.1',
    user:     'mongodb',
    database: 'muchmala'
};

config.queue = {
    host: "127.0.0.1",
    port: 6379,
    password: undefined,
    database: 0
};

var localConfigPath = './config.local.js';
if (require('path').existsSync(localConfigPath)) {
    var localConfig = require(localConfigPath),
        deepExtend = require('muchmala-common').misc.deepExtend;

    deepExtend(config, localConfig);
}