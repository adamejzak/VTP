/**
 * Rock Paper Scissors Game State Management
 * Handles the state of active RPS games
 */

/**
 * RPS Game State Manager
 */
class RPSStateManager {
  constructor() {
    this.activeGames = new Map(); // gameId -> gameState
    this.userGames = new Map();   // userId -> gameId
  }

  /**
   * Adds a new game pair
   * @param {string} user1Id - First user ID
   * @param {string} user2Id - Second user ID
   * @param {string} gameId - Game ID
   */
  addPair(user1Id, user2Id, gameId) {
    this.activeGames.set(gameId, {
      user1: user1Id,
      user2: user2Id,
      user1Choice: null,
      user2Choice: null,
      status: 'waiting'
    });
    this.userGames.set(user1Id, gameId);
    this.userGames.set(user2Id, gameId);
  }

  /**
   * Checks if user has an active game
   * @param {string} userId - User ID
   * @returns {boolean} True if user has active game
   */
  hasUserActive(userId) {
    return this.userGames.has(userId);
  }

  /**
   * Gets game state by game ID
   * @param {string} gameId - Game ID
   * @returns {Object|null} Game state or null
   */
  getState(gameId) {
    return this.activeGames.get(gameId) || null;
  }

  /**
   * Gets game state by user ID
   * @param {string} userId - User ID
   * @returns {Object|null} Game state or null
   */
  getUserGame(userId) {
    const gameId = this.userGames.get(userId);
    return gameId ? this.activeGames.get(gameId) : null;
  }

  /**
   * Updates user choice in a game
   * @param {string} gameId - Game ID
   * @param {string} userId - User ID
   * @param {string} choice - User's choice
   * @returns {Object} Updated game state
   */
  updateChoice(gameId, userId, choice) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;

    if (game.user1 === userId) {
      game.user1Choice = choice;
    } else if (game.user2 === userId) {
      game.user2Choice = choice;
    }

    // Check if both players have made their choices
    if (game.user1Choice && game.user2Choice) {
      game.status = 'completed';
    }

    return game;
  }

  /**
   * Removes a game by game ID
   * @param {string} gameId - Game ID
   */
  removeByGame(gameId) {
    const game = this.activeGames.get(gameId);
    if (game) {
      this.userGames.delete(game.user1);
      this.userGames.delete(game.user2);
      this.activeGames.delete(gameId);
    }
  }

  /**
   * Removes a game by user ID
   * @param {string} userId - User ID
   */
  removeByUser(userId) {
    const gameId = this.userGames.get(userId);
    if (gameId) {
      this.removeByGame(gameId);
    }
  }

  /**
   * Clears all games
   */
  clear() {
    this.activeGames.clear();
    this.userGames.clear();
  }
}

// Export singleton instance
export const rpsState = new RPSStateManager();
