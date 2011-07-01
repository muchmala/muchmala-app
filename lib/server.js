var async = require('async');
var _ = require('underscore');
var io = require('socket.io-cluster');

var common = require('muchmala-common');
var logger = common.logger;
var db = common.db;

var Games = require('./games');
var Client = require('./client');
var config = require('../config');

var NEW_PUZZLES_QUEUE = 'new-puzzle';

db.connect(config.mongodb, function(err) {
    if (err) {
        throw err;
    }
    
    var games = new Games(db);
    var socket = io.makeListener({
        REDIS_HOST: config.queue.host,
        REDIS_PORT: config.queue.port,
        REDIS_PASSWORD: config.queue.password,
        REDIS_DATABASE: config.queue.database
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
    
    var queue = new common.queueAdapter(config.queue);
    
    queue.subscribe(NEW_PUZZLES_QUEUE, function(metadata) {
        async.waterfall([
            function(callback) {
                savePuzzle(metadata, callback);
            }, 
            function(queueIndex, callback) {
                informUser(metadata, queueIndex, callback);
            }
        ], function(err) {
            if (err) {
                logger.error(err);
            } else {
                logger.info("Puzzle " + metadata.puzzleId + " processed.");
            }
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
            callback(null, queueIndex);
        });
    }

    function informUser(metadata, queueIndex, callback) {
        logger.info("Puzzle " + metadata.puzzleId + " is added to database. Queue index: " + queueIndex);
        
        queue.publish(NEW_PUZZLES_QUEUE + '-' + metadata.sessionId, {
            puzzleId: metadata.puzzleId,
            queueIndex: queueIndex
        });
            
        callback();
    }
});

