/**
 * submitBuy.js — Server-side pure game logic for stock buying (BUY mode).
 *
 * Extracted from the client-side submitAPI.js `submitBuy()` function.
 * Pure function: gameState in -> gameState out, no Firebase I/O.
 *
 * @module functions/logic/submitBuy
 */

const { PUNT_BUY } = require('../shared/gameConstants');
const helper = require('../shared/helper');
const {
  buyStock,
  returnStock,
  changeLeadership,
  incrementCountry,
} = require('./submitHelpers');

/**
 * Handles the BUY mode submission — a player either buys a stock (optionally
 * returning one) or punts their buy opportunity.
 *
 * After the individual buy:
 * 1. Marks the buying country as offLimits (cannot be bought again this round).
 * 2. Recalculates leadership for that country.
 * 3. Finds the next swiss-banking player who still needs to buy.
 * 4. If no more buyers: moves the investor card to the next player, activates
 *    swiss-banking players (both temporary and permanent), resets offLimits on
 *    all countries, and advances to the next country (proposal mode).
 *
 * Mutates gameState in place and returns it.
 *
 * @param {object}   gameState      - Full game state (mutated in place).
 * @param {object}   setup          - Setup object containing stockCosts, etc.
 * @param {object}   params         - Submission parameters.
 * @param {string}   params.playerName   - Name of the player submitting.
 * @param {string}   params.buyCountry   - Country to buy from, or 'Punt Buy'.
 * @param {string|number} params.buyStock     - Stock denomination to buy.
 * @param {string|number|null} params.returnStock - Stock denomination to return, or 'None'/0/null.
 * @param {string[]} countries      - Ordered array of country names (pre-resolved).
 * @param {string[]} playersInOrder - Players in seating order (pre-resolved).
 * @returns {object} The mutated gameState.
 */
function submitBuyLogic(gameState, setup, params, countries, playersInOrder) {
  const { playerName, buyCountry, buyStock: buyStockName, returnStock: returnStockName } = params;

  gameState.sameTurn = false;

  if (buyCountry === PUNT_BUY) {
    // Player declines to buy — add them to the swiss banking set for a
    // later buy opportunity.
    if (!gameState.swissSet) {
      gameState.swissSet = [];
    }
    gameState.swissSet.push(playerName);
  } else {
    // Look up prices from setup's stock costs table.
    let costs = setup.stockCosts;
    let price = costs[buyStockName];

    let effectiveReturn = returnStockName;
    if (!effectiveReturn || effectiveReturn === 'None') {
      effectiveReturn = 0;
    }
    let returnPrice = costs[effectiveReturn];

    buyStock(
      gameState,
      playerName,
      { country: buyCountry, stock: buyStockName },
      price,
      countries
    );
    returnStock(
      gameState,
      playerName,
      { country: buyCountry, stock: effectiveReturn },
      returnPrice
    );

    gameState.countryInfo[buyCountry].offLimits = true;
    changeLeadership(gameState, buyCountry, playerName);
  }

  // Current player's turn is done.
  gameState.playerInfo[playerName].myTurn = false;
  gameState.playerInfo[playerName].swiss = false;

  // Check for the next swiss-banking player who still needs to buy.
  // Walk backwards from the current player through seating order.
  let lastBuy = true;
  let numPlayers = Object.keys(gameState.playerInfo).length;

  for (let i = 0; i < numPlayers - 1; i++) {
    let index =
      (playersInOrder.indexOf(playerName) - 1 - i + numPlayers) % numPlayers;
    if (gameState.playerInfo[playersInOrder[index]].swiss) {
      gameState.playerInfo[playersInOrder[index]].myTurn = true;
      lastBuy = false;
      break;
    }
  }

  if (lastBuy) {
    // All buys are done — advance the investor card.
    let investor = '';
    for (let key in gameState.playerInfo) {
      if (gameState.playerInfo[key].investor) {
        investor = key;
      }
    }

    let order = gameState.playerInfo[investor].order;
    gameState.playerInfo[investor].investor = false;

    for (let key in gameState.playerInfo) {
      if (
        gameState.playerInfo[key].order % numPlayers ===
        (order + 1) % numPlayers
      ) {
        gameState.playerInfo[key].investor = true;
      }
    }

    // Activate swiss-banking players (temporary set + permanent eligibles).
    let swissSet = gameState.swissSet || [];
    let permSwiss = helper.getPermSwiss(gameState) || [];

    for (let player of swissSet) {
      gameState.playerInfo[player].swiss = true;
    }
    for (let player of permSwiss) {
      gameState.playerInfo[player].swiss = true;
    }

    // Reset offLimits on all countries.
    for (let key in gameState.countryInfo) {
      gameState.countryInfo[key].offLimits = false;
    }

    gameState.swissSet = null;

    // Advance to the next country's proposal turn.
    incrementCountry(gameState, countries);
  }

  // Build history entry.
  if (!gameState.history) {
    gameState.history = [];
  }

  let buyMsg = playerName + ' bought the ' + buyCountry + ' ' + buyStockName;
  if (
    returnStockName &&
    returnStockName !== 0 &&
    returnStockName !== 'None'
  ) {
    buyMsg += ' returning the ' + buyCountry + ' ' + returnStockName;
  }
  gameState.history.push(buyMsg + '.');

  // Record who can undo this action.
  gameState.undo = playerName;

  return gameState;
}

module.exports = { submitBuyLogic };
