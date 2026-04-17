import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { FlagFilled, FlagOutlined, DollarCircleFilled, DollarCircleOutlined } from '@ant-design/icons';
import UserContext from './UserContext.js';
import * as stateAPI from './backendFiles/stateAPI.js';
import * as helper from './backendFiles/helper.js';
import useGameState from './useGameState.js';
import { getCountryColorPalette } from './countryColors.js';

/**
 * Always-on Players column.
 *
 * Reading order per row (committed in design review): name → leadership flags →
 * stock badges → right-aligned money. User's row gets a 3px gold accent bar on
 * the left and an elevated background (semantic ownership marker, paired with
 * aria-current="true").
 *
 * No tooltips anywhere (deliberate — the user dislikes them: too persistent,
 * overlap content, stack when the cursor sweeps across adjacent icons). Country
 * identity is conveyed by color alone (stock badges, leadership flags). Score
 * reveals inline on row hover (CSS transition, respects prefers-reduced-motion).
 *
 * Edge cases:
 *   - Initial loading (no cached state): render 6 skeleton rows at same height.
 *   - Spectator (context.name doesn't match a player): all 6 rows unhighlighted.
 *   - Eliminated / absent player: 40% opacity, no stock badges, "—" for money.
 *   - Fewer than 6 players: render only what getPlayersInOrder() returns.
 */
function PlayersColumn() {
	const context = useContext(UserContext);
	const contextRef = useRef(context);
	contextRef.current = context;

	const [countryInfo, setCountryInfo] = useState({});
	const [playerInfo, setPlayerInfo] = useState({});
	const [playersOrdered, setPlayersOrdered] = useState(null); // null = loading, [] = loaded empty

	const { gameState, loading } = useGameState();

	const reinitialize = useCallback(async () => {
		try {
			const [country, player, order] = await Promise.all([
				stateAPI.getCountryInfo(contextRef.current),
				stateAPI.getPlayerInfo(contextRef.current),
				helper.getPlayersInOrder(contextRef.current),
			]);
			setCountryInfo(country || {});
			setPlayerInfo(player || {});
			setPlayersOrdered(order || []);
		} catch (e) {
			console.warn('PlayersColumn: failed to load game info', e);
			setCountryInfo({});
			setPlayerInfo({});
			setPlayersOrdered([]);
		}
	}, []);

	useEffect(() => {
		reinitialize();
	}, [gameState, reinitialize]);

	const palette = getCountryColorPalette(context.colorblindMode);

	// Loading skeleton: 6 placeholder rows at same height, keeps layout stable
	if (loading && playersOrdered === null) {
		return (
			<aside className="imp-players-col" aria-label="Players (loading)">
				<header className="imp-players-col__header">PLAYERS</header>
				<ul className="imp-players-col__list" aria-busy="true">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<li key={'skel-' + i} className="imp-players-col__row imp-players-col__row--skeleton" aria-hidden="true" />
					))}
				</ul>
			</aside>
		);
	}

	const rows = (playersOrdered || []).filter(Boolean);

	return (
		<aside className="imp-players-col" aria-label="Players">
			<header className="imp-players-col__header">PLAYERS</header>
			<ul className="imp-players-col__list">
				{rows.map((player) => {
					const info = playerInfo[player] || {};
					const isUser = context.name && player === context.name;
					const isAbsent = !info || info.money === undefined;
					return (
						<PlayerRow
							key={player}
							player={player}
							info={info}
							isUser={isUser}
							isAbsent={isAbsent}
							countryInfo={countryInfo}
							palette={palette}
						/>
					);
				})}
			</ul>
		</aside>
	);
}

function twoDec(money) {
	if (money === undefined || money === null) return null;
	return parseFloat(money).toFixed(2);
}

function PlayerRow({ player, info, isUser, isAbsent, countryInfo, palette }) {
	const rowClass =
		'imp-players-col__row' +
		(isUser ? ' imp-players-col__row--user' : '') +
		(isAbsent ? ' imp-players-col__row--absent' : '');

	const score = isAbsent ? null : helper.computeScore(info || {}, countryInfo || {});

	return (
		<li className={rowClass} aria-current={isUser ? 'true' : undefined}>
			<div className="imp-players-col__row-top">
				<span className="imp-players-col__name">{player}</span>
				<Leaderships player={player} countryInfo={countryInfo} palette={palette} />
				<InvestorSwiss info={info} />
				<span className="imp-players-col__money">{isAbsent ? '—' : '$' + (twoDec(info.money) ?? '0.00')}</span>
			</div>
			{!isAbsent && (
				<div className="imp-players-col__row-bottom">
					<StockBadges stock={info.stock} palette={palette} />
					{score !== null && <span className="imp-players-col__score">{score.toFixed(2)} pts</span>}
				</div>
			)}
		</li>
	);
}

function Leaderships({ player, countryInfo, palette }) {
	const bright = palette.bright;
	const chips = [];
	for (const c in countryInfo) {
		const info = countryInfo[c] || {};
		const leadership = info.leadership || [];
		if (leadership[0] === player) {
			chips.push(
				<FlagFilled
					key={'lead-' + c}
					className="imp-players-col__flag"
					aria-label={c + ' leader'}
					style={{ color: bright[c] }}
				/>
			);
		}
		if (info.gov === 'democracy' && leadership[1] === player) {
			chips.push(
				<FlagOutlined
					key={'opp-' + c}
					className="imp-players-col__flag"
					aria-label={c + ' opposition'}
					style={{ color: bright[c] }}
				/>
			);
		}
	}
	if (chips.length === 0) return null;
	return <span className="imp-players-col__flags">{chips}</span>;
}

function InvestorSwiss({ info }) {
	const badges = [];
	if (info.investor) {
		badges.push(
			<DollarCircleFilled
				key="investor"
				className="imp-players-col__icon imp-players-col__icon--investor"
				aria-label="Investor card"
			/>
		);
	}
	if (info.swiss) {
		badges.push(
			<DollarCircleOutlined
				key="swiss"
				className="imp-players-col__icon imp-players-col__icon--swiss"
				aria-label="Swiss banking"
			/>
		);
	}
	if (badges.length === 0) return null;
	return <span className="imp-players-col__icons">{badges}</span>;
}

function StockBadges({ stock, palette }) {
	if (!stock || stock.length === 0) return <span className="imp-players-col__stock" />;
	const dark = palette.dark;
	return (
		<span className="imp-players-col__stock">
			{stock.map((entry, i) => (
				<span
					key={entry.country + '-' + i}
					className="imp-sidebar__stock-badge"
					aria-label={entry.country + ' stock ' + entry.stock}
					style={{ backgroundColor: dark[entry.country], cursor: 'default' }}
				>
					{entry.stock}
				</span>
			))}
		</span>
	);
}

export default PlayersColumn;
