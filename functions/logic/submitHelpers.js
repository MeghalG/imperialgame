/**
 * submitHelpers.js — Server-side shared helpers extracted from submitAPI.js.
 *
 * Pure game-logic functions (no Firebase I/O). State is mutated in place;
 * the caller is responsible for reading from / writing to the database.
 */

const { MODES, GOV_TYPES } = require('../shared/gameConstants');
const helper = require('../shared/helper');

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

/**
 * Chess-clock adjustment for a single player.
 *
 * Calculates remaining banked time after a move. If the player has gone
 * negative, applies a score penalty and resets their bank to 60 seconds.
 *
 * @param {string}  player      - Player name.
 * @param {object}  gameState   - Full game state (mutated in place).
 * @param {number}  serverTime  - Server-authoritative timestamp (ms).
 */
function adjustTime(player, gameState, serverTime) {
  let time = gameState.timer.pause;
  if (time === 0) {
    time = serverTime;
  }

  let ti =
    gameState.playerInfo[player].banked * 1000 -
    time +
    gameState.timer.increment * 1000 +
    gameState.timer.lastMove;

  if (ti < 0) {
    gameState.playerInfo[player].scoreModifier -= 1;
    gameState.playerInfo[player].banked = 60;
  } else {
    gameState.playerInfo[player].banked = Math.min(
      Math.floor(
        gameState.playerInfo[player].banked -
          time / 1000 +
          gameState.timer.lastMove / 1000
      ) + gameState.timer.increment,
      gameState.playerInfo[player].banked
    );
  }
}

/**
 * Top-level timer handler called once per submit.
 *
 * If the game is timed and this is NOT a same-turn action, debits time from
 * the player whose turn just ended. For same-turn actions the submitter is
 * debited instead. Resets the pause flag afterwards.
 *
 * @param {object}  gameState      - Current game state (mutated).
 * @param {object}  oldState       - Snapshot of state before the submit.
 * @param {number}  serverTime     - Server-authoritative timestamp (ms).
 * @param {string}  submitterName  - Name of the player who submitted.
 */
function handleTimer(gameState, oldState, serverTime, submitterName) {
  let timer = gameState.timer;
  if (!timer.timed) return;

  if (!gameState.sameTurn) {
    for (let key in oldState.playerInfo) {
      if (oldState.playerInfo[key].myTurn) {
        adjustTime(key, gameState, serverTime);
      }
    }
    timer.lastMove = serverTime;
  } else {
    adjustTime(submitterName, gameState, serverTime);
  }

  timer.pause = 0;
}

// ---------------------------------------------------------------------------
// Turn progression
// ---------------------------------------------------------------------------

/**
 * Advance to the next country's turn.
 *
 * Sets `countryUp`, increments the round counter when wrapping, activates
 * the new country's leader, and sets mode to PROPOSAL.  If the next country
 * has no leadership (no stock holders), it is recursively skipped.
 *
 * @param {object}   gameState  - Full game state (mutated in place).
 * @param {string[]} countries  - Ordered array of country names (pre-resolved).
 */
function incrementCountry(gameState, countries) {
  let country = gameState.countryUp;
  let index = countries.indexOf(country);
  let newCountry = countries[(index + 1) % countries.length];
  let leadership = gameState.countryInfo[newCountry].leadership;

  gameState.countryUp = newCountry;

  if (index === countries.length - 1) {
    gameState.round += 1;
  }

  let playerUp = '';
  if (leadership && leadership[0]) {
    playerUp = leadership[0];
  }

  if (!playerUp) {
    incrementCountry(gameState, countries);
    return;
  }

  for (let key in gameState.playerInfo) {
    gameState.playerInfo[key].myTurn = false;
  }
  gameState.playerInfo[leadership[0]].myTurn = true;
  gameState.mode = MODES.PROPOSAL;
}

// ---------------------------------------------------------------------------
// Stock operations
// ---------------------------------------------------------------------------

/**
 * Execute a stock purchase.
 *
 * Moves the stock from the country's available pool into the player's
 * portfolio, transfers money from the player to the country treasury,
 * and re-sorts the player's stock list.
 *
 * @param {object}   gameState  - Full game state (mutated in place).
 * @param {string}   player     - Player name.
 * @param {object}   stock      - Stock object `{ country, stock }`.
 * @param {number}   price      - Purchase price.
 * @param {string[]} countries  - Ordered array of country names (for sort).
 */
function buyStock(gameState, player, stock, price, countries) {
  if (!gameState.playerInfo[player].stock) {
    gameState.playerInfo[player].stock = [];
  }

  let availStock = gameState.countryInfo[stock.country].availStock;
  let idx = availStock.indexOf(stock.stock);
  if (idx === -1) {
    console.error(
      `buyStock: stock ${stock.stock} not found in ${stock.country} availStock`
    );
    return;
  }

  gameState.playerInfo[player].stock.push(stock);
  availStock.splice(idx, 1);
  gameState.playerInfo[player].money -= price;
  gameState.countryInfo[stock.country].money += price;

  helper.sortStock(gameState.playerInfo[player].stock, countries);
}

/**
 * Return a stock from a player's portfolio to the country's available pool.
 *
 * Uses `findIndex` for a safe splice (avoids the for-in + splice bug in the
 * original client code).  Bond-0 stocks (free bonds) are removed from the
 * player but NOT returned to the available pool and no money changes hands.
 *
 * @param {object} gameState - Full game state (mutated in place).
 * @param {string} player    - Player name.
 * @param {object} stock     - Stock object `{ country, stock }`.
 * @param {number} price     - Refund price.
 */
function returnStock(gameState, player, stock, price) {
  let owned = gameState.playerInfo[player].stock;
  let idx = owned.findIndex(
    (s) => s.country === stock.country && s.stock === stock.stock
  );
  if (idx !== -1) owned.splice(idx, 1);

  if (stock.stock !== 0) {
    let availStock = gameState.countryInfo[stock.country].availStock;
    availStock.push(stock.stock);
    availStock.sort();
    gameState.playerInfo[player].money += price;
    gameState.countryInfo[stock.country].money -= price;
  }
}

// ---------------------------------------------------------------------------
// Leadership / governance
// ---------------------------------------------------------------------------

/**
 * Recalculate leadership order and government type for a country.
 *
 * Tallies each stakeholder's total stock value, sorts by descending value,
 * and sets governance to DICTATORSHIP if the top holder owns >= 50 % of all
 * outstanding stock, otherwise DEMOCRACY.
 *
 * @param {object} gameState - Full game state (mutated in place).
 * @param {string} country   - Country name.
 * @param {string} player    - Player who triggered the recalculation.
 */
function changeLeadership(gameState, country, player) {
  let stockOwned = [];
  let leadership = gameState.countryInfo[country].leadership;
  if (!leadership) {
    leadership = [];
  }

  let total = 0;
  if (!leadership.includes(player)) {
    leadership.push(player);
  }

  for (let i in leadership) {
    let t = [leadership[i], 0];
    for (let j in gameState.playerInfo[leadership[i]].stock) {
      if (
        gameState.playerInfo[leadership[i]]['stock'][j]['country'] === country
      ) {
        t[1] += gameState.playerInfo[leadership[i]]['stock'][j]['stock'];
        total += gameState.playerInfo[leadership[i]]['stock'][j]['stock'];
      }
    }
    stockOwned.push(t);
  }

  stockOwned.sort((a, b) => b[1] - a[1]);
  gameState.countryInfo[country].leadership = stockOwned.map((x) => x[0]);

  if (2 * stockOwned[0][1] >= total) {
    gameState.countryInfo[country].gov = GOV_TYPES.DICTATORSHIP;
  } else {
    gameState.countryInfo[country].gov = GOV_TYPES.DEMOCRACY;
  }
}

// ---------------------------------------------------------------------------
// Money rounding
// ---------------------------------------------------------------------------

/**
 * Round all player and country money values to 2 decimal places.
 *
 * Prevents floating-point drift from accumulating across many transactions.
 *
 * @param {object} gameState - Full game state (mutated in place).
 */
function roundMoney(gameState) {
  for (let player in gameState.playerInfo) {
    gameState.playerInfo[player].money = parseFloat(
      gameState.playerInfo[player].money.toFixed(2)
    );
  }
  for (let country in gameState.countryInfo) {
    gameState.countryInfo[country].money = parseFloat(
      gameState.countryInfo[country].money.toFixed(2)
    );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  adjustTime,
  handleTimer,
  incrementCountry,
  buyStock,
  returnStock,
  changeLeadership,
  roundMoney,
};
