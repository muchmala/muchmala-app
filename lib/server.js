var async = require('async'),
    _ = require('underscore'),
    io = require('socket.io-cluster'),

    logger = require('muchmala-common').logger,
    db = require('muchmala-common').db,
    QueueAdapter = require('muchmala-common').queueAdapter,

    Games = require('./games'),
    Client = require('./client'),
    config = require('../config'),

    queue = new QueueAdapter(config.queue);

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

    queue.subscribe('new-puzzle', function(metadata) {
        async.waterfall([function(callback) {
            savePuzzle(metadata, callback);

        }, function(metadata, queueIndex, callback) {
            informUser(metadata, queueIndex, callback);

        }], function(err) {
            if (err) {
                logger.error(err);
                return;
            }

            logger.info("Puzzle " + metadata.puzzleId + " processed.");
        });
    });

    logger.info("Ready. Listening for incoming connections...");


    function addPlayer(client, data) {
        var puzzleId = null, anonymousId = null, sessionId = null;

        if (!_.isUndefined(data)) {
            anonymousId = data.anonymousId || null;
            sessionId = data.sessionId || null;
            puzzleId = data.puzzleId || null;
        }

        games.addPlayer(new Client(client), anonymousId, sessionId, puzzleId);
    }

    function savePuzzle(metadata, callback) {
        db.Puzzles.add(metadata.piecesMap, {
            id: metadata.puzzleId,
            name: metadata.name,
            invisible: metadata.invisible,
            pieceSize: metadata.pieceSize,
            spriteSize: metadata.spriteSize,
            hLength: metadata.hLength,
            vLength: metadata.vLength
        }, function(added, queueIndex) {
            callback(null, metadata, queueIndex);
        });
    }

    function informUser(metadata, queueIndex, callback) {
        logger.info("Puzzle " + metadata.puzzleId + " is added to database. Queue index: " + queueIndex);
        callback();
    }
});

