var io = require('socket.io-cluster');
var db = require('muchmala-common').db;
var _ = require('underscore');

var Games = require('./games');
var Client = require('./client');
var config = require('../config');

db.connect(config.mongodb, function(err) {
    if (err) {
        throw err;
    }

    var games = new Games(db);
    var socket = io.makeListener({
            REDIS_HOST     : config.queue.host,
            REDIS_PORT     : config.queue.port,
            REDIS_PASSWORD : config.queue.password,
            REDIS_DATABASE : config.queue.database
        });

    socket.on('no-client', function(client) {
        addPlayer(client, {
            userId: client.userId,
            puzzleId: client.puzzleId
        });
    });

    socket.on('connection', function(client) {
        client.on('message', function(message) {
            message = JSON.parse(message);

            if (!_.isUndefined(message.action) && message.action == 'initialize') {
                addPlayer(client, message.data);
            }
        });
    });

    function addPlayer(client, data) {
        var puzzleId = null, anonymousId = null, sessionId = null;

        if (!_.isUndefined(data)) {
            anonymousId = data.anonymousId || null;
            sessionId = data.sessionId || null;
            puzzleId = data.puzzleId || null;
        }

        games.addPlayer(new Client(client), anonymousId, sessionId, puzzleId);
    }
});
