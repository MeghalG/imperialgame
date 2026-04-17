import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Tooltip } from 'antd';
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
 * the left and an elevated background (paired with aria-current="true").
 *
 * Tooltips:
 *   All Tooltip wrappers use mouseEnterDelay={0} + mouseLeaveDelay={0} +
 *   destroyTooltipOnHide. In a dense icon cluster, any enter-delay queues
 *   up multiple tooltip animations when the cursor sweeps across adjacent
 *   targets — zero delay means sweeping instantly swaps visible tooltips
 *   rather than stacking them. destroyTooltipOnHide removes the hidden
 *   tooltip from the DOM so there's no half-animated remnant.
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

// Shared tooltip props for the entire Players column.
// Zero delays + destroy-on-hide + overlayClassName that disables antd's
// fade animation prevents the "stacking on cursor sweep" issue. Without
// the animation kill, antd's ~100ms hide transition leaves the outgoing
// tooltip visible while the new one is already showing. See feedback
// memory `tooltips` and the CSS rule `.imp-insta-tip`.
const TIP = {
	mouseEnterDelay: 0,
	mouseLeaveDelay: 0,
	destroyTooltipOnHide: true,
	overlayClassName: 'imp-insta-tip',
};

function PlayerRow({ player, info, isUser, isAbsent, countryInfo, palette }) {
	const rowClass =
		'imp-players-col__row' +
		(isUser ? ' imp-players-col__row--user' : '') +
		(isAbsent ? ' imp-players-col__row--absent' : '');

	const scoreTitle = isAbsent
		? player
		: player + ' — score ' + helper.computeScore(info || {}, countryInfo || {}).toFixed(2);

	return (
		<li className={rowClass} aria-current={isUser ? 'true' : undefined}>
			<div className="imp-players-col__row-top">
				<Tooltip title={scoreTitle} placement="top" {...TIP}>
					<span className="imp-players-col__name">{player}</span>
				</Tooltip>
				<Leaderships player={player} countryInfo={countryInfo} palette={palette} />
				<InvestorSwiss info={info} />
				<span className="imp-players-col__money">{isAbsent ? '—' : '$' + (twoDec(info.money) ?? '0.00')}</span>
			</div>
			{!isAbsent && (
				<div className="imp-players-col__row-bottom">
					<StockBadges stock={info.stock} palette={palette} />
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
				<Tooltip key={'lead-' + c} title={c + ' Leader'} placement="top" {...TIP}>
					<FlagFilled className="imp-players-col__flag" style={{ color: bright[c] }} />
				</Tooltip>
			);
		}
		if (info.gov === 'democracy' && leadership[1] === player) {
			chips.push(
				<Tooltip key={'opp-' + c} title={c + ' Opposition'} placement="top" {...TIP}>
					<FlagOutlined className="imp-players-col__flag" style={{ color: bright[c] }} />
				</Tooltip>
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
			<Tooltip key="investor" title="Investor Card" placement="top" {...TIP}>
				<DollarCircleFilled className="imp-players-col__icon imp-players-col__icon--investor" />
			</Tooltip>
		);
	}
	if (info.swiss) {
		badges.push(
			<Tooltip key="swiss" title="Swiss Banking" placement="top" {...TIP}>
				<DollarCircleOutlined className="imp-players-col__icon imp-players-col__icon--swiss" />
			</Tooltip>
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
				<Tooltip key={entry.country + '-' + i} title={entry.country} placement="top" {...TIP}>
					<span
						className="imp-sidebar__stock-badge"
						style={{ backgroundColor: dark[entry.country], cursor: 'default' }}
					>
						{entry.stock}
					</span>
				</Tooltip>
			))}
		</span>
	);
}

export default PlayersColumn;
