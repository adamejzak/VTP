/**
 * Tic Tac Toe Game State Management
 * Keeps track of active Tic Tac Toe games
 */

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

function determineOpponent(game, userId) {
  if (game.playerX === userId) {
    return game.playerO;
  }

  if (game.playerO === userId) {
    return game.playerX;
  }

  return null;
}

function resolveSymbol(game, userId) {
  return game.playerX === userId ? 'X' : 'O';
}

function evaluateWinner(board, symbol) {
  for (const combination of WINNING_COMBINATIONS) {
    if (combination.every(position => board[position] === symbol)) {
      return {
        symbol,
        combination
      };
    }
  }

  return {
    symbol: null,
    combination: null
  };
}

class TicTacToeStateManager {
  constructor() {
    this.games = new Map(); // gameId -> game state
    this.userGames = new Map(); // userId -> gameId
  }

  /**
   * Creates a new Tic Tac Toe game instance
   * @param {string} gameId
   * @param {string} playerX
   * @param {string} playerO
   * @returns {object} Newly created game state
   */
  createGame(gameId, playerX, playerO) {
    const game = {
      id: gameId,
      playerX,
      playerO,
      currentPlayer: playerX,
      board: Array(9).fill(null),
      status: 'active',
      winner: null,
      result: null,
      winningCombo: null,
      lastMoveBy: null,
      cancelReason: null,
      timeoutRef: null,
      createdAt: Date.now()
    };

    this.games.set(gameId, game);
    this.userGames.set(playerX, gameId);
    this.userGames.set(playerO, gameId);

    return game;
  }

  /**
   * Stores timeout reference for a game
   * @param {string} gameId
   * @param {NodeJS.Timeout} timeoutRef
   */
  setTimeoutRef(gameId, timeoutRef) {
    const game = this.games.get(gameId);
    if (!game) {
      return;
    }

    if (game.timeoutRef) {
      clearTimeout(game.timeoutRef);
    }

    game.timeoutRef = timeoutRef;
  }

  /**
   * Checks if user currently participates in a game
   * @param {string} userId
   * @returns {boolean}
   */
  hasUserActive(userId) {
    return this.userGames.has(userId);
  }

  /**
   * Returns game state by ID
   * @param {string} gameId
   * @returns {object|null}
   */
  getGame(gameId) {
    return this.games.get(gameId) ?? null;
  }

  /**
   * Returns game state by user ID
   * @param {string} userId
   * @returns {object|null}
   */
  getGameByUser(userId) {
    const gameId = this.userGames.get(userId);
    return gameId ? this.getGame(gameId) : null;
  }

  /**
   * Applies a move to the given game
   * @param {string} gameId
   * @param {string} userId
   * @param {number} position
   * @returns {{ success: boolean, error?: string, game?: object }}
   */
  applyMove(gameId, userId, position) {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: 'not_found' };
    }

    if (game.status !== 'active') {
      return { success: false, error: 'inactive' };
    }

    if (userId !== game.playerX && userId !== game.playerO) {
      return { success: false, error: 'not_participant' };
    }

    if (game.currentPlayer !== userId) {
      return { success: false, error: 'not_turn' };
    }

    if (!Number.isInteger(position) || position < 0 || position > 8) {
      return { success: false, error: 'invalid_position' };
    }

    if (game.board[position]) {
      return { success: false, error: 'occupied' };
    }

    const symbol = resolveSymbol(game, userId);
    game.board[position] = symbol;
    game.lastMoveBy = userId;

    const { symbol: winnerSymbol, combination } = evaluateWinner(game.board, symbol);
    if (winnerSymbol) {
      game.status = 'completed';
      game.winner = userId;
      game.result = winnerSymbol;
      game.winningCombo = combination;
      game.currentPlayer = null;
      return { success: true, game };
    }

    if (game.board.every(cell => Boolean(cell))) {
      game.status = 'completed';
      game.winner = null;
      game.result = 'draw';
      game.winningCombo = null;
      game.currentPlayer = null;
      return { success: true, game };
    }

    const opponent = determineOpponent(game, userId);
    game.currentPlayer = opponent;

    return { success: true, game };
  }

  /**
   * Marks game as cancelled (e.g. timeout)
   * @param {string} gameId
   * @param {string} reason
   * @returns {object|null}
   */
  expireGame(gameId, reason = 'timeout') {
    const game = this.games.get(gameId);
    if (!game || game.status !== 'active') {
      return null;
    }

    if (game.timeoutRef) {
      clearTimeout(game.timeoutRef);
      game.timeoutRef = null;
    }

    game.status = 'cancelled';
    game.cancelReason = reason;
    game.currentPlayer = null;
    game.winner = null;
    game.result = null;
    game.winningCombo = null;

    return game;
  }

  /**
   * Finishes a game and removes it from state
   * @param {string} gameId
   * @returns {object|null}
   */
  finishGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) {
      return null;
    }

    if (game.timeoutRef) {
      clearTimeout(game.timeoutRef);
      game.timeoutRef = null;
    }

    this.userGames.delete(game.playerX);
    this.userGames.delete(game.playerO);
    this.games.delete(gameId);

    return game;
  }

  /**
   * Clears all active games
   */
  clear() {
    for (const [, game] of this.games) {
      if (game.timeoutRef) {
        clearTimeout(game.timeoutRef);
      }
    }

    this.games.clear();
    this.userGames.clear();
  }
}

export const ticTacToeState = new TicTacToeStateManager();


