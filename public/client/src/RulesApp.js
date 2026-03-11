import React from 'react';
import './App.css';
import './MapOverlay.css';

function RulesApp() {
	return (
		<div className="imp-rules">
			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-scroll" />
					<span>Official Rules</span>
				</div>
				<div className="imp-rules__section-body">
					<p>
						This ruleset is a variant on the{' '}
						<a href="https://www.ultraboardgames.com/imperial/game-rules.php" target="_blank" rel="noopener noreferrer">
							official rules
						</a>
						. Read this first, then read the list of modifications to learn how to play this version of Imperial.
					</p>
				</div>
			</div>

			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-landmark" />
					<span>Democratic</span>
				</div>
				<div className="imp-rules__section-body">
					<p>
						The most important change is that countries are ruled <b>democratically</b> rather than dictatorially. After
						a country makes their move (but before any investor purchase takes place), if the owner has &lt; 50% of the
						outstanding stock, then the person with the second-most stock makes an alternative proposal for a turn.
						Players vote with the stock that they hold, deciding between the two proposals. Voting is open at once to
						everyone with shares. If the alternative gets &gt; 50%, it happens immediately. If the original gets 50%, it
						happens immediately. You cannot send in your vote if the result has already been decided, but you can send
						in your vote even if it provably cannot affect the outcome. Votes are revealed once a result has been
						decided. Proposals to end the game automatically pass, without any vote taking place.
					</p>
					<p>
						Greatness bonuses are distributed according to the{' '}
						<a href="https://en.wikipedia.org/wiki/D%27Hondt_method" target="_blank" rel="noopener noreferrer">
							Jefferson method
						</a>{' '}
						based on total stock of each player in the country. If there is a shortfall in an Investor action, extra
						spinning along the wheel, or a shortfall in paying for the Factory or Import actions, the proposer of the
						action takes full responsibility for paying the shortfall. At any number of intermediate points during your
						maneuver, you may pause to resolve peace offers to other countries. You must resolve fleet peace offers
						before you may move any armies. If you propose a maneuver with peace in a location, all players with votes
						in the other country should vote at once on accepting the peace offer. If both the leader and the opposition
						agree, or a majority agrees, or the leader and 50% total agree, then the voting immediately concludes.
					</p>
				</div>
			</div>

			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-university" />
					<span>Investor / Swiss Bank</span>
				</div>
				<div className="imp-rules__section-body">
					<p>
						Normally, whenever a country lands on or skips over investor, after the action has been resolved, an
						investor phase occurs. The person with the investor card receives $2, can purchase or upgrade a bond, and
						then passes the investor card to the next player (even if they didn't purchase). Anyone who did not hold
						leadership of any country at the start of the turn may then also purchase or upgrade a bond.
					</p>
					<p>
						In this variant, to get Swiss status, the player must also not hold opposition in any country. Players may
						also <b>punt buys</b>. Any player who punts a buy receives Swiss status for future investor actions. Making
						any buy or upgrade causes them to lose this temporary Swiss Bank status, unless they still qualify by virtue
						of not holding government positions. All swiss bank buys are resolved in counterclockwise order from the
						person who took the first investor action. Players without countries do not receive an automatic veto on
						skipping investor. No one may buy or upgrade in a country which has already been bought/upgraded as part of
						the same investor action.
					</p>
				</div>
			</div>

			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-gavel" />
					<span>Opening Auction</span>
				</div>
				<div className="imp-rules__section-body">
					<p>
						Instead of the listed starting amounts, distribute $61 evenly between the players. Fractional money can be
						spent in the opening auction (but can only be bid in intervals of cents) and is otherwise only useful as a
						tiebreaker. For each country, in turn order beginning with Austria, each player simultaneously chooses a
						real amount of money to bid. Arrange the bids in descending order, breaking all ties randomly. In descending
						order, each player may choose to pay their entire bid to buy one bond for which they have bid at least the
						normal cost. After the opening auction for the last nation has concluded, the player with the most cash
						remaining receives the investor card. The seating order continues in descending order of remaining cash. All
						ties are broken randomly.
					</p>
				</div>
			</div>

			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-cogs" />
					<span>Misc Modifications</span>
				</div>
				<div className="imp-rules__section-body">
					<ol>
						<li>There is a mountain range between Berlin and Prague (they are not adjacent).</li>
						<li>
							Countries can place an unlimited number of tax chips (but only tax up to $15). Also, tax chips are only
							placed when the active country maneuvers into sole control of a region.
						</li>
						<li>
							There are 8 initial stocks per country instead of 9. They are priced the same as the first 8 stocks in the
							normal game:
							<br />
							<span className="imp-rules__stock-table">
								<span className="imp-rules__stock-item">1 &rarr; $2</span>
								<span className="imp-rules__stock-item">2 &rarr; $4</span>
								<span className="imp-rules__stock-item">3 &rarr; $6</span>
								<span className="imp-rules__stock-item">4 &rarr; $9</span>
								<span className="imp-rules__stock-item">5 &rarr; $12</span>
								<span className="imp-rules__stock-item">6 &rarr; $16</span>
								<span className="imp-rules__stock-item">7 &rarr; $20</span>
								<span className="imp-rules__stock-item">8 &rarr; $25</span>
							</span>
						</li>
					</ol>
				</div>
			</div>

			<div className="imp-rules__section">
				<div className="imp-rules__section-header">
					<div className="imp-rules__section-header-accent" />
					<i className="fas fa-chess" />
					<span>Strategy Tips</span>
				</div>
				<div className="imp-rules__section-body">
					<p>All that matters is buy efficiency.</p>
				</div>
			</div>
		</div>
	);
}

export default RulesApp;
