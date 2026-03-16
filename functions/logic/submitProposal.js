/**
 * submitProposal.js — Server-side pure game logic for proposals, voting,
 * and proposal execution, extracted from submitAPI.js.
 *
 * All functions are pure: gameState in -> mutated gameState out, no Firebase I/O.
 * Setup data (wheel, territories, stockCosts, countries) must be pre-resolved
 * by the caller.
 *
 * @module functions/logic/submitProposal
 */

const helper = require('../shared/helper');
const {
  MODES,
  WHEEL_ACTIONS,
  GOV_TYPES,
  MANEUVER_ACTIONS,
  WIN_POINTS,
  FACTORY_COST,
  INVESTOR_BONUS,
  FREE_RONDEL_STEPS,
  RONDEL_STEP_COST,
  WHEEL_CENTER,
} = require('../shared/gameConstants');
const { incrementCountry } = require('./submitHelpers');
const { enterManeuverLogic } = require('./submitManeuver');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Helper for maneuver history strings. Returns ' with ' when the action
 * string is non-empty, otherwise returns the empty string.
 *
 * @param {string} x - Maneuver action suffix (e.g. 'peace', 'war France army', or '')
 * @returns {string} ' with ' or ''
 */
function w(x) {
  if (x) {
    return ' with ';
  } else {
    return '';
  }
}

/**
 * Checks whether the Investor slot on the rondel was passed (but not landed on)
 * when moving from oldSpot to newSpot clockwise.
 *
 * This is a pure reimplementation of helper.investorPassed that does not
 * require Firebase access — the wheel array is passed directly.
 *
 * @param {string} oldSpot  - The wheel position before the move (or 'center').
 * @param {string} newSpot  - The wheel position after the move.
 * @param {string[]} wheel  - The ordered rondel wheel array from setup.
 * @returns {boolean} True if the Investor position was crossed.
 */
function investorPassedCheck(oldSpot, newSpot, wheel) {
  if (oldSpot === WHEEL_CENTER) {
    return newSpot === 'Investor';
  }
  let inv = wheel.indexOf('Investor');
  let o = wheel.indexOf(oldSpot);
  let n = wheel.indexOf(newSpot);

  // Matches the original logic: investor is passed if the clockwise distance
  // from old to investor is <= the clockwise distance from old to new, and
  // we did not start ON investor.
  return (
    (n - o + wheel.length) % wheel.length >=
      (inv - o + wheel.length) % wheel.length && inv !== o
  );
}

// ---------------------------------------------------------------------------
// makeHistory
// ---------------------------------------------------------------------------

/**
 * Builds a human-readable history string for a wheel action.
 *
 * Adapted from the client-side submitAPI.js makeHistory (lines 1267-1334).
 * On the server side, helper.getTaxInfo may return a Promise (the original is
 * declared async), so this function is async to accommodate that.
 *
 * @param {object} gameState - Current game state.
 * @param {object} context   - Proposal context with wheelSpot and action fields.
 * @returns {Promise<string>} History string describing the executed action.
 */
async function makeHistory(gameState, context) {
  let country = gameState.countryUp;

  switch (context.wheelSpot) {
    case WHEEL_ACTIONS.INVESTOR: {
      let amt = helper.getInvestorPayout(gameState, country, context.name);
      let msgs = amt.map((x) => '$' + x[1] + ' to ' + x[0]);
      return country + ' investors, paying ' + msgs.join(', ') + '.';
    }
    case WHEEL_ACTIONS.L_PRODUCE:
    case WHEEL_ACTIONS.R_PRODUCE: {
      let produceParts = [];
      if ((context.armyProduce || []).length > 0) {
        produceParts.push('armies in ' + context.armyProduce.join(', '));
      }
      if ((context.fleetProduce || []).length > 0) {
        produceParts.push('fleets in ' + context.fleetProduce.join(', '));
      }
      return (
        country +
        ' ' +
        context.wheelSpot +
        's ' +
        produceParts.join(' and ') +
        '.'
      );
    }
    case WHEEL_ACTIONS.TAXATION: {
      let taxInfo = await helper.getTaxInfo(
        gameState.countryInfo,
        gameState.playerInfo,
        country
      );
      let s =
        country +
        ' taxes for ' +
        taxInfo.points +
        ' points, and $' +
        taxInfo.money +
        ' into its treasury. Greatness is distributed ';
      let splits = taxInfo['tax split']
        .map((x) => '$' + x[1] + ' to ' + x[0])
        .join(', ');
      if (splits === '') {
        splits = 'to no one';
      }
      s += splits + '.';
      return s;
    }
    case WHEEL_ACTIONS.FACTORY:
      return country + ' builds a factory in ' + context.factoryLoc + '.';
    case WHEEL_ACTIONS.IMPORT: {
      let importFleets = [];
      let importArmies = [];
      for (let i in context.import.types) {
        if (context.import.types[i] === 'fleet') {
          importFleets.push(context.import.territories[i]);
        }
        if (context.import.types[i] === 'army') {
          importArmies.push(context.import.territories[i]);
        }
      }
      let importParts = [];
      if (importFleets.length > 0)
        importParts.push('fleets in ' + importFleets.join(', '));
      if (importArmies.length > 0)
        importParts.push('armies in ' + importArmies.join(', '));
      return country + ' imports ' + importParts.join(' and ') + '.';
    }
    case WHEEL_ACTIONS.L_MANEUVER:
    case WHEEL_ACTIONS.R_MANEUVER: {
      let sortedF = [...(context.fleetMan || [])].sort(
        (a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1)
      );
      let f = sortedF.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);

      let sortedA = [...(context.armyMan || [])].sort(
        (a, b) => b[2].charCodeAt(0) - a[2].charCodeAt(1)
      );
      let a = sortedA.map((x) => x[0] + ' to ' + x[1] + w(x[2]) + x[2]);

      let parts = [];
      if (f.length > 0) parts.push('fleets from ' + f.join(', '));
      if (a.length > 0) parts.push('armies from ' + a.join(', '));
      return (
        country +
        ' ' +
        context.wheelSpot +
        's ' +
        parts.join('. It moves ') +
        '.'
      );
    }
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// executeProposalLogic
// ---------------------------------------------------------------------------

/**
 * Executes a wheel action proposal, mutating the game state accordingly.
 *
 * This is the core game engine function. Each wheel action is a case in a
 * switch statement that modifies countryInfo/playerInfo:
 *
 * - **Investor**: Pays out money from country treasury to stockholders.
 * - **L-Produce / R-Produce**: Creates new fleet/army units at factory locations.
 * - **Taxation**: Awards victory points, adds money to treasury, distributes
 *   greatness. If points reach WIN_POINTS, sets mode to GAME_OVER.
 * - **Factory**: Builds a factory in a territory. Costs $5 (shortfall from player).
 * - **Import**: Places up to 3 new units. Costs $1 each (shortfall from player).
 * - **L-Maneuver / R-Maneuver**: Moves all fleets/armies, resolving wars,
 *   placing tax chips, handling peaceful/hostile entry, destroying factories.
 *
 * After executing the action:
 * - Checks if the Investor slot was passed on the rondel (triggers buy mode)
 * - Otherwise advances to next country (proposal mode)
 * - Clears proposals, pays rondel spin cost, updates wheelSpot
 *
 * Adapted from client-side submitAPI.js executeProposal (lines 1359-1619).
 * All Firebase reads have been replaced with pre-resolved setup parameters.
 *
 * @param {object}   gameState  - Game state (mutated in place).
 * @param {object}   context    - Proposal context with wheelSpot and action fields.
 * @param {object}   setup      - Pre-resolved setup data.
 * @param {string[]} setup.wheel       - Rondel wheel array.
 * @param {object}   setup.territories - Territory setup map (territory name -> config).
 * @param {string[]} countries  - Ordered array of country names (for incrementCountry).
 */
async function executeProposalLogic(gameState, context, setup, countries) {
  let country = gameState.countryUp;
  let wheel = setup.wheel;
  let territorySetup = setup.territories;
  let history = await makeHistory(gameState, context);
  gameState.history.push(context.name + "'s proposal occurs: " + history);

  switch (context.wheelSpot) {
    case WHEEL_ACTIONS.INVESTOR: {
      let amt = helper.getInvestorPayout(gameState, country, context.name);
      let total = 0;
      for (let i in amt) {
        total += amt[i][1];
        gameState.playerInfo[amt[i][0]].money += amt[i][1];
      }
      gameState.countryInfo[country].money -= total;
      break;
    }
    case WHEEL_ACTIONS.L_PRODUCE:
    case WHEEL_ACTIONS.R_PRODUCE: {
      if (!context.fleetProduce) {
        context.fleetProduce = [];
      }
      if (!context.armyProduce) {
        context.armyProduce = [];
      }
      for (let fleet of context.fleetProduce) {
        if (!gameState.countryInfo[country].fleets) {
          gameState.countryInfo[country].fleets = [];
        }
        gameState.countryInfo[country].fleets.push({
          territory: fleet,
          hostile: true,
        });
      }
      for (let army of context.armyProduce) {
        if (!gameState.countryInfo[country].armies) {
          gameState.countryInfo[country].armies = [];
        }
        gameState.countryInfo[country].armies.push({
          territory: army,
          hostile: true,
        });
      }
      break;
    }
    case WHEEL_ACTIONS.TAXATION: {
      let taxInfo = await helper.getTaxInfo(
        gameState.countryInfo,
        gameState.playerInfo,
        country
      );
      gameState.countryInfo[country].points = Math.min(
        gameState.countryInfo[country].points + taxInfo.points,
        WIN_POINTS
      );
      gameState.countryInfo[country].money += taxInfo.money;
      gameState.countryInfo[country].lastTax = Math.min(
        taxInfo.points + 5,
        15
      );
      for (let tax of taxInfo['tax split']) {
        gameState.playerInfo[tax[0]].money += tax[1];
      }
      if (gameState.countryInfo[country].points === WIN_POINTS) {
        gameState.mode = MODES.GAME_OVER;
        // Early return so incrementCountry does not overwrite game-over mode.
        // Still clean up proposals, pay spin cost, and update wheelSpot.
        gameState['proposal 1'] = null;
        gameState['proposal 2'] = null;
        let winDiff = 0;
        if (gameState.countryInfo[country].wheelSpot !== WHEEL_CENTER) {
          winDiff =
            (wheel.indexOf(context.wheelSpot) -
              wheel.indexOf(gameState.countryInfo[country].wheelSpot) +
              wheel.length) %
            wheel.length;
        }
        if (winDiff > FREE_RONDEL_STEPS) {
          gameState.playerInfo[context.name].money -=
            RONDEL_STEP_COST * (winDiff - FREE_RONDEL_STEPS);
        }
        gameState.countryInfo[country].wheelSpot = context.wheelSpot;
        gameState.currentManeuver = null;
        return;
      }
      break;
    }
    case WHEEL_ACTIONS.FACTORY: {
      gameState.countryInfo[country].factories.push(context.factoryLoc);
      gameState.countryInfo[country].money -= FACTORY_COST;
      if (gameState.countryInfo[country].money < 0) {
        gameState.playerInfo[context.name].money +=
          gameState.countryInfo[country].money;
        gameState.countryInfo[country].money = 0;
      }
      break;
    }
    case WHEEL_ACTIONS.IMPORT: {
      for (let i in context.import.types) {
        if (!context.import.types) {
          context.import.types = [];
        }
        if (!context.import.territories) {
          context.import.territories = [];
        }
        if (context.import.types[i] === 'fleet') {
          if (!gameState.countryInfo[country].fleets) {
            gameState.countryInfo[country].fleets = [];
          }
          gameState.countryInfo[country].fleets.push({
            territory: context.import.territories[i],
            hostile: true,
          });
        }
        if (context.import.types[i] === 'army') {
          if (!gameState.countryInfo[country].armies) {
            gameState.countryInfo[country].armies = [];
          }
          gameState.countryInfo[country].armies.push({
            territory: context.import.territories[i],
            hostile: true,
          });
        }
        if (
          context.import.types[i] === 'army' ||
          context.import.types[i] === 'fleet'
        ) {
          if (gameState.countryInfo[country].money >= 1) {
            gameState.countryInfo[country].money -= 1;
          } else {
            gameState.playerInfo[context.name].money -= 1;
          }
        }
      }
      break;
    }
    case WHEEL_ACTIONS.L_MANEUVER:
    case WHEEL_ACTIONS.R_MANEUVER: {
      // --- Fleet maneuvers ---
      let fleets = [];
      for (let fleet of context.fleetMan || []) {
        let split = fleet[2].split(' ');
        if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
          // War: destroy the enemy unit
          if (split[2] === 'fleet') {
            for (let i in gameState.countryInfo[split[1]].fleets) {
              if (
                gameState.countryInfo[split[1]].fleets[i].territory ===
                fleet[1]
              ) {
                gameState.countryInfo[split[1]].fleets.splice(i, 1);
                break;
              }
            }
          } else {
            for (let i in gameState.countryInfo[split[1]].armies) {
              if (
                gameState.countryInfo[split[1]].armies[i].territory ===
                fleet[1]
              ) {
                gameState.countryInfo[split[1]].armies.splice(i, 1);
                break;
              }
            }
          }
          continue;
        }
        if (!fleet[2]) {
          // Normal move: remove other country's tax chip, place own
          for (let c in gameState.countryInfo) {
            let taxChips = gameState.countryInfo[c].taxChips || [];
            while (taxChips.includes(fleet[1])) {
              taxChips.splice(taxChips.indexOf(fleet[1]), 1);
            }
          }
          if (!gameState.countryInfo[country].taxChips) {
            gameState.countryInfo[country].taxChips = [];
          }
          if (
            !gameState.countryInfo[country].taxChips.includes(fleet[1]) &&
            !territorySetup[fleet[1]].country
          ) {
            gameState.countryInfo[country].taxChips.push(fleet[1]);
          }
        }
        fleets.push({ territory: fleet[1], hostile: true });
      }
      gameState.countryInfo[country].fleets = fleets;

      // --- Army maneuvers ---
      let armies = [];
      let blowUpConsumed = {};
      let sortedArmyMan = [...(context.armyMan || [])].sort((a, b) => {
        // Sort order: war > blow up > peace > hostile > normal move
        // War actions ('w') need to execute first so destroyed units are
        // removed before peace/hostile units are placed.
        let aCode = a[2] ? a[2].charCodeAt(0) : 0;
        let bCode = b[2] ? b[2].charCodeAt(0) : 0;
        return bCode - aCode;
      });
      for (let army of sortedArmyMan) {
        // Check if this army is consumed by a previous blow-up at this territory
        if (blowUpConsumed[army[1]] && blowUpConsumed[army[1]] > 0) {
          blowUpConsumed[army[1]]--;
          continue;
        }
        let hostile = true;
        let split = army[2].split(' ');
        if (split[0] === MANEUVER_ACTIONS.WAR_PREFIX) {
          // War: destroy the enemy unit
          if (split[2] === 'fleet') {
            for (let i in gameState.countryInfo[split[1]].fleets) {
              if (
                gameState.countryInfo[split[1]].fleets[i].territory ===
                army[1]
              ) {
                gameState.countryInfo[split[1]].fleets.splice(i, 1);
                break;
              }
            }
          } else {
            for (let i in gameState.countryInfo[split[1]].armies) {
              if (
                gameState.countryInfo[split[1]].armies[i].territory ===
                army[1]
              ) {
                gameState.countryInfo[split[1]].armies.splice(i, 1);
                break;
              }
            }
          }
          continue;
        }
        if (!army[2]) {
          // Normal move: remove other country's tax chip, place own
          for (let c in gameState.countryInfo) {
            let taxChips = gameState.countryInfo[c].taxChips || [];
            while (taxChips.includes(army[1])) {
              taxChips.splice(taxChips.indexOf(army[1]), 1);
            }
          }
          if (!gameState.countryInfo[country].taxChips) {
            gameState.countryInfo[country].taxChips = [];
          }
          if (
            !gameState.countryInfo[country].taxChips.includes(army[1]) &&
            !territorySetup[army[1]].country
          ) {
            gameState.countryInfo[country].taxChips.push(army[1]);
          }
        }
        if (split[0] === MANEUVER_ACTIONS.PEACE) {
          if (
            territorySetup[army[1]].country &&
            territorySetup[army[1]].country !== country
          ) {
            hostile = false;
          }
        }
        if (split[0] === 'blow') {
          // Blow up enemy factory and consume 3 armies total (this one + 2 more)
          if (gameState.countryInfo[split[2]].factories.includes(army[1])) {
            gameState.countryInfo[split[2]].factories.splice(
              gameState.countryInfo[split[2]].factories.indexOf(army[1]),
              1
            );
          }
          // Mark 2 more armies at this territory for consumption (3 total destroyed)
          blowUpConsumed[army[1]] = (blowUpConsumed[army[1]] || 0) + 2;
          continue;
        }
        armies.push({ territory: army[1], hostile: hostile });
      }
      gameState.countryInfo[country].armies = armies;

      break;
    }
    default:
      break;
  }

  // Check if the Investor slot was passed on the rondel
  let passed = investorPassedCheck(
    gameState.countryInfo[country].wheelSpot,
    context.wheelSpot,
    wheel
  );
  if (passed) {
    // Investor was passed: pay investor bonus and enter BUY mode
    for (let key in gameState.playerInfo) {
      gameState.playerInfo[key].myTurn = false;
      if (gameState.playerInfo[key].investor) {
        gameState.playerInfo[key].money += INVESTOR_BONUS;
        gameState.playerInfo[key].myTurn = true;
      }
    }
    gameState.mode = MODES.BUY;
  } else {
    incrementCountry(gameState, countries);
  }

  // Clear proposals
  gameState['proposal 1'] = null;
  gameState['proposal 2'] = null;

  // Pay rondel spin cost ($2 per step beyond the 3 free steps)
  let diff = 0;
  if (gameState.countryInfo[country].wheelSpot !== WHEEL_CENTER) {
    diff =
      (wheel.indexOf(context.wheelSpot) -
        wheel.indexOf(gameState.countryInfo[country].wheelSpot) +
        wheel.length) %
      wheel.length;
  }
  if (diff > FREE_RONDEL_STEPS) {
    gameState.playerInfo[context.name].money -=
      RONDEL_STEP_COST * (diff - FREE_RONDEL_STEPS);
  }

  gameState.countryInfo[country].wheelSpot = context.wheelSpot;
  gameState.currentManeuver = null;
}

// ---------------------------------------------------------------------------
// submitVoteLogic
// ---------------------------------------------------------------------------

/**
 * Submits a vote on leader vs opposition proposal.
 *
 * Each voter's stock count is added to the chosen proposal's vote tally.
 * If a proposal crosses the majority threshold, it is executed immediately
 * via executeProposalLogic. Otherwise the vote is recorded and play continues.
 *
 * Adapted from client-side submitAPI.js submitVote (lines 379-441).
 *
 * @param {object}   gameState  - Game state (mutated in place).
 * @param {object}   params     - Vote parameters.
 * @param {string}   params.playerName - Name of the voting player.
 * @param {number}   params.vote       - 1 for leader's proposal, 2 for opposition's.
 * @param {object}   setup      - Pre-resolved setup data ({ wheel, territories }).
 * @param {string[]} countries  - Ordered country name array.
 */
async function submitVoteLogic(gameState, params, setup, countries) {
  let proposal = null;
  if (params.vote === 1) {
    proposal = 'proposal 1';
  } else {
    proposal = 'proposal 2';
  }

  gameState.sameTurn = false;
  let country = gameState.voting.country;

  if (!gameState.voting['proposal 1'].voters) {
    gameState.voting['proposal 1'].voters = [];
  }
  if (!gameState.voting['proposal 2'].voters) {
    gameState.voting['proposal 2'].voters = [];
  }

  gameState.sameTurn = true;

  // Not my turn anymore
  gameState.playerInfo[params.playerName].myTurn = false;

  // Calculate threshold
  let stock = helper.getOwnedStock(
    gameState.countryInfo[country].leadership,
    gameState.playerInfo,
    country
  );
  let total = 0;
  for (let i in stock) {
    if (stock[i][0] === params.playerName) {
      gameState.voting[proposal].votes += stock[i][1];
      gameState.voting[proposal].voters.push(params.playerName);
      if (i === '0') {
        gameState.voting[proposal].votes += 0.1;
      }
    }
    total += stock[i][1];
  }
  let threshold = (total + 0.01) / 2.0;

  if (gameState.voting[proposal].votes > threshold) {
    gameState.history.push(
      '[' +
        country +
        '] ' +
        params.playerName +
        ' has voted. ' +
        gameState.voting['proposal 1'].voters.join(', ') +
        " voted for the leader's proposal and " +
        gameState.voting['proposal 2'].voters.join(', ') +
        ' voted against.'
    );
    let propContext = helper.unstringifyFunctions(gameState[proposal]);
    await executeProposalLogic(gameState, propContext, setup, countries);
    gameState.sameTurn = false;
    gameState.voting = null;
  } else {
    // Record vote in history
    gameState.history.push(
      '[' + country + '] ' + params.playerName + ' has voted.'
    );
  }

  gameState.undo = params.playerName;
}

// ---------------------------------------------------------------------------
// submitNoCounterLogic
// ---------------------------------------------------------------------------

/**
 * Opposition agrees with the leader's proposal (no counter-proposal).
 *
 * Skips the vote phase entirely and executes the leader's proposal directly.
 * Adapted from client-side submitAPI.js submitNoCounter (lines 455-469).
 *
 * @param {object}   gameState  - Game state (mutated in place).
 * @param {object}   params     - Parameters.
 * @param {string}   params.playerName - Name of the opposition player agreeing.
 * @param {object}   setup      - Pre-resolved setup data ({ wheel, territories }).
 * @param {string[]} countries  - Ordered country name array.
 */
async function submitNoCounterLogic(gameState, params, setup, countries) {
  gameState.sameTurn = false;
  let country = gameState.countryUp;

  gameState.history.push(
    params.playerName +
      " agreed with the leader's proposal for " +
      country +
      '.'
  );
  let propContext = helper.unstringifyFunctions(gameState['proposal 1']);
  await executeProposalLogic(gameState, propContext, setup, countries);

  gameState.undo = params.playerName;
}

// ---------------------------------------------------------------------------
// submitProposalLogic
// ---------------------------------------------------------------------------

/**
 * Submits a player's proposal for a wheel action.
 *
 * Flow depends on government type and which player is submitting:
 *
 * - **Dictatorship** (leader only): Executes the proposal immediately.
 * - **Democracy — Leader** (leadership[0]): Stores proposal in gameState['proposal 1'],
 *   sets mode to PROPOSAL_OPP, switches turn to opposition.
 * - **Democracy — Opposition** (leadership[1]): Stores counter-proposal in
 *   gameState['proposal 2'], sets mode to VOTE, creates voting state.
 *
 * For maneuver actions (L-Maneuver / R-Maneuver), enters step-by-step maneuver
 * mode instead of the normal flow. Returns a flag so the caller can handle
 * immediate maneuver completion if no units exist.
 *
 * Adapted from client-side submitAPI.js submitProposal (lines 1642-1707).
 *
 * @param {object}   gameState  - Game state (mutated in place).
 * @param {object}   context    - Proposal context with wheelSpot and action fields.
 *                                Must include { name, wheelSpot } at minimum.
 * @param {object}   setup      - Pre-resolved setup data ({ wheel, territories }).
 * @param {string[]} countries  - Ordered country name array.
 * @returns {Promise<{maneuverNeedsCompletion: boolean}>} Result object. If
 *   maneuverNeedsCompletion is true, the caller must handle immediate
 *   maneuver completion (no units to move).
 */
async function submitProposalLogic(gameState, context, setup, countries) {
  let country = gameState.countryUp;
  let leadership = gameState.countryInfo[country].leadership;
  gameState.sameTurn = false;

  gameState.playerInfo[context.name].myTurn = false;

  // For maneuver actions, enter step-by-step mode instead of the normal flow.
  // NOTE: We do NOT update wheelSpot or charge spin cost here. That happens
  // later in executeProposalLogic (called from completeManeuver) so that the
  // investor-passed check sees the correct old->new wheel transition.
  if (
    context.wheelSpot === WHEEL_ACTIONS.L_MANEUVER ||
    context.wheelSpot === WHEEL_ACTIONS.R_MANEUVER
  ) {
    let result = enterManeuverLogic(gameState, { playerName: context.name, wheelSpot: context.wheelSpot });
    gameState.undo = context.name;
    return { maneuverNeedsCompletion: result.needsCompletion };
  }

  let history = await makeHistory(gameState, context);
  if (gameState.countryInfo[country].gov === GOV_TYPES.DICTATORSHIP) {
    await executeProposalLogic(gameState, context, setup, countries);
  } else {
    if (context.name === leadership[0]) {
      // Leader proposal: store and hand off to opposition
      gameState.playerInfo[leadership[1]].myTurn = true;
      gameState['proposal 1'] = helper.stringifyFunctions(context);
      gameState.history.push(
        context.name + ' proposes as the leader: ' + history
      );
      gameState.mode = MODES.PROPOSAL_OPP;
    } else {
      // Opposition counter-proposal: store and set up vote
      gameState['proposal 2'] = helper.stringifyFunctions(context);
      for (let player of leadership) {
        gameState.playerInfo[player].myTurn = true;
      }
      gameState.history.push(
        context.name + ' proposes as the opposition: ' + history
      );
      gameState.mode = MODES.VOTE;
      let l = gameState.history.length;
      gameState.voting = {
        country: country,
        'proposal 1': {
          proposal: gameState.history[l - 2],
          votes: 0,
          voters: [],
        },
        'proposal 2': {
          proposal: gameState.history[l - 1],
          votes: 0,
          voters: [],
        },
      };
    }
  }

  gameState.undo = context.name;
  return { maneuverNeedsCompletion: false };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  w,
  makeHistory,
  executeProposalLogic,
  submitVoteLogic,
  submitNoCounterLogic,
  submitProposalLogic,
  investorPassedCheck,
};
