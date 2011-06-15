module.exports = {
    userData: 'userData',
    puzzleData: 'puzzleData',
    piecesData: 'piecesData',
    noPuzzles: 'noPuzzles',
    initialize: 'initialize',
    initialized: 'initialized',
    setUserName: 'setUserName',
    leadersBoard: 'leadersBoard',
    topTwenty: 'topTwenty',
    lockPiece: 'lockPiece',
    unlockPiece: 'unlockPiece',
    swapPieces: 'swapPieces',
    scoreAdded: 'scoreAdded',

    create: function(event, data) {
        return JSON.stringify({event: event, data: data});
    }
};