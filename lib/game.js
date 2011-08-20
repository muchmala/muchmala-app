var db = require('muchmala-common').db;
var _ = require('underscore');
var flow = require('flow');

var Player = require('./player');
var MESSAGES = require('./messages');

function Game(io, puzzle) {
    this.puzzle = puzzle;
    this.io = io;
    
    var self = this;
    
    setInterval(function() {
        self.puzzle.unlockOldPieces(function(pieces) {
            _.each(pieces, function(coords) {
                self.broadcastUnlockPiece(coords);
            }); 
        });
    }, 60000);
}

Game.prototype.addPlayer = function(client, user) {
    var self = this;
    var player = new Player(client, self.puzzle, user);

    player.on('userNameChanged', function() {
        self.broadcastLeadersBoard();
    });
    player.on('scoreChanged', function() {
        self.broadcastLeadersBoard();
    });
    player.on('pieceUnlocked', function(coords) {
        self.broadcastUnlockPiece(coords, user.name);
    });
    player.on('pieceLocked', function(coords) {
        self.broadcastLockPiece(coords, user.name);
    });
    player.on('piecesSwapped', function(coords) {
        self.broadcastSwapPieces(coords);
        self.broadcastUnlockPiece(coords[0], user.name);
        self.puzzle.addSwap(function() {
            self.broadcastPuzzleData();
        });
    });

    client.join(this.puzzle._id);

    client.onDisconnect(function() {
        client.leave(self.puzzle._id);
        player.unlockSelectedPiece();
        user.online -= 1;
        user.save(function() {
            self.broadcastPuzzleData();
            self.broadcastLeadersBoard();
        });
    });
            
    user.online += 1;
    user.save(function() {
        self.broadcastPuzzleData();
        self.broadcastLeadersBoard();
    });
};

Game.prototype.broadcastLeadersBoard = function() {
    this.getLeadersBoardData((function(data) {
        this.broadcast(MESSAGES.leadersBoard, data);
    }).bind(this));
};

Game.prototype.broadcastPuzzleData = function() {
    this.getPuzzleData((function(data) {
        this.broadcast(MESSAGES.puzzleData, data);
    }).bind(this));
};

Game.prototype.broadcastLockPiece = function(coords, userName) {
    this.broadcast(MESSAGES.lockPiece, {userName: userName, coords: coords});
};

Game.prototype.broadcastUnlockPiece = function(coords, userName) {
    this.broadcast(MESSAGES.unlockPiece, {userName: userName, coords: coords});
};

Game.prototype.broadcastSwapPieces = function(coords) {
    this.broadcast(MESSAGES.swapPieces, coords);
};

Game.prototype.broadcast = function(event, data) {
    this.io.in(this.puzzle._id).send(MESSAGES.create(event, data));
};

Game.prototype.getPuzzleData = function(callback) {
    var connected = 0;
    var puzzleId = this.puzzle._id;
    
    if (this.io.manager.rooms['/' + this.puzzle._id]) {
        connected = this.io.manager.rooms['/' + this.puzzle._id].length;
    }
    
    this.puzzle.compactInfo(function(info) {
        db.Users.countOfLinkedWith(puzzleId, function(count) {
            callback(_.extend(info, {
                connected: connected,
                participants: count
            }));
        });
    });
};

Game.prototype.getLeadersBoardData = function(callback) {
    var self = this;
    var result = {};

    flow.exec(function() {
        db.Users.allLinkedWith(self.puzzle._id, this);
    }, function(users) {

        flow.serialForEach(users, function(user) {
            this.user = user;
            this.user.getPuzzleData(self.puzzle._id, this);
            
        }, function(puzzleData) {
            result[this.user._id] = {
                name: this.user.name,
                online: this.user.online,
                score: puzzleData.score,
                swaps: puzzleData.swaps,
                found: puzzleData.found
            };
        }, function() {
            callback(_.select(result, function(user) {
                return user.score && user.found;
            }));
        });
    });
};

module.exports = Game;