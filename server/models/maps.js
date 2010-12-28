var db = require('../db');

var loader = function(mapsCollection) {
    var Map = function(id, callback) {
        var _id = new db.ObjectId(id);

        callback.call(this, {
            lock: function(x, y, userId, callback) {
                mapsCollection.update(
                    {_id: _id, pieces: {$elemMatch: {x: +x, y: +y, locked: ''}}},
//                    {_id: _id, 'pieces.x': x, 'pieces.y': y, 'pieces.locked': ''},
                    {$set: {"pieces.$.locked": userId}},
                    function(error, result) {
                        callback.call(this, true);
                    });
            },

            unlock: function(x, y, userId, callback) {
                mapsCollection.update(
                    {_id: _id, pieces: {$elemMatch: {x: +x, y: +y, locked: userId}}},
                    {$set: {"pieces.$.locked": ''}},
                    function(error, result) {
                        callback.call(this, true);
                    });
            },

            unlockAll: function(userId, callback) {
                mapsCollection.findOne({_id: _id}, function(error, mapInfo) {
                    var lockedItems = [];

                    for (var i in mapInfo.pieces) {
                        if (mapInfo.pieces[i].locked == userId) {
                        mapsCollection.update(
                            {_id: _id, pieces: {$elemMatch: {x: mapInfo.pieces[i].x, y: mapInfo.pieces[i].y, locked: userId}}},
                            {$set: {"pieces.$.locked": ''}});

                            lockedItems.push([mapInfo.pieces[i].x, mapInfo.pieces[i].y]);
                        }
                    }

                    callback.call(this, lockedItems);
                });
            },

            flip: function(x1, y1, x2, y2, userId, callback) {
                mapsCollection.findOne({_id: _id, pieces: {$elemMatch: {x: +x1, y: +y1, locked: userId}}},
                    function(error, mapInfo) {
                        if (mapInfo === undefined) {
                            callback.call(this, false);
                        } else {
                            mapsCollection.update(
                                {_id: _id, pieces: {$elemMatch: {x: +x2, y: +y2, locked: ''}}},
                                {$set: {"pieces.$.x": +x1, "pieces.$.y": +y1}},
                                function(error, result) {
                                    mapsCollection.update(
                                        {_id: _id, pieces: {$elemMatch: {x: +x1, y: +y1, locked: userId}}, $atomic : 1},
                                        {$set: {"pieces.$.locked": '', "pieces.$.x": +x2, "pieces.$.y": +y2}},
                                        function(error, result) {
                                            callback.call(this, true);
                                        });
                                });
                        }
                    });
            },

            getCompactInfo: function(callback) {
                mapsCollection.findOne({_id: _id}, function(error, mapInfo) {
                    var compactData = {
                        id: id,
                        imageSrc: mapInfo.imageSrc,
                        piceSize: mapInfo.pieceSize,
                        map: []
                    };

                    var pieces = mapInfo.pieces.concat();

                    for (var i in pieces) {
                        if (compactData.map[pieces[i].y] === undefined) {
                            compactData.map[pieces[i].y] = [];
                        }

                        compactData.map[pieces[i].y][pieces[i].x] = {
                            t: pieces[i].top,
                            l: pieces[i].left,
                            b: pieces[i].bottom,
                            r: pieces[i].right,
                            x: pieces[i].realX,
                            y: pieces[i].realY,
                            d: !!pieces[i].locked
                        };
                    }

                    callback.call(this, compactData);
                });
            },

            get _id () {
                return _id;
            }
        });
    };

    return {
        generateMap: function(width, height, pieceSize, imageSrc, name, callback) {
            var mapData = {
                name: name,
                imageSrc: imageSrc,
                pieceSize: pieceSize,
                width: width,
                height: height,
                created: new Date(),
                pieces: generatePieces(width, height, pieceSize)
            };

            mapsCollection.insert(mapData, function(error, ids) {
                Map(ids[0]._id.toHexString(), callback);
            });
        },

        getLastMap: function(callback) {
            mapsCollection.find({created:{$lt:new Date()}}, {sort: [['created', -1]], limit: 1}, function(error, cursor) {
                cursor.toArray(function(error, items) {
                    Map(items[0]._id.toHexString(), callback);
                });
            });
        },

        getMapById: function(id, callback) {
            Map(id, callback);
        }
    };
};

function toInt(value) {
    return parseInt(value, 10);
}

function rand(max) {
    return Math.floor(Math.random() * (max + 1));
}

function generatePiece(x, y) {
    return {
        realX: x,
        realY: y,
        x: x,
        y: y,
        top: rand(1),
        bottom: rand(1),
        left: rand(1),
        right: rand(1),
        locked: ''
    };
}

function generatePieces(width, height, pieceSize) {
    var rectSize = toInt(pieceSize/3 * 2);
    var countH = toInt((width - rectSize/2) / rectSize);
    var countV = toInt((height - rectSize/2) / rectSize);

    var initialPositions = [];

    var typesIndex = {};
    var piecesSequence = [];

    var piece;

    for (var y = 0; y < countV; y++) {
        initialPositions[y] = [];

        for (var x = 0; x < countH; x++) {
            piece = generatePiece(x, y);

            if (initialPositions[y-1] != null && initialPositions[y-1][x] != null) {
                piece.top = (initialPositions[y-1][x].bottom == 1) ? 0 : 1;
            }

            if (initialPositions[y] != null && initialPositions[y][x-1] != null) {
                piece.left = (initialPositions[y][x-1].right == 1) ? 0 : 1;
            }

            initialPositions[y][x] = piece;

            addToIndex(piece);
        }
    }

    return getShuffled();

    function addToIndex(piece) {
        var key = '' + piece.left + piece.bottom +
                 piece.right + piece.top;

        if (typesIndex[key] == null) {
            typesIndex[key] = [];
        }

        typesIndex[key].push(initialPositions[y][x]);
        piecesSequence.push(key);
    }

    function getShuffled() {
        var resultSet = [];

        for (var i in typesIndex) {
            typesIndex[i].sort(function() {
                return 0.5 - Math.random();
            });
        }

        for(var y = 0, k = 0; y < countV; y++) {
            for(var x = 0, piece; x < countH; x++, k++) {
                piece = typesIndex[piecesSequence[k]].pop();
                piece.x = x;
                piece.y = y;

                resultSet.push(piece);
            }
        }

        return resultSet;
    }

}

exports.load = loader;
