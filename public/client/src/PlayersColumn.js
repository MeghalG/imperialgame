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
 * the left and an elevated background (paired with aria-current="true").
 *
 * Tooltips: single shared custom tooltip (no antd Tooltip here). One <div>,
 * one position, controlled by React state. Every hoverable target calls the
 * same `showTip`/`scheduleHide` pair, so at most ONE tooltip is ever rendered
 * at any point. No stacking, no ghosting — tested cases:
 *   - Moving from icon A to icon B: showTip immediately replaces the content
 *     in place (no flicker because scheduleHide is debounced 50ms).
 *   - Leaving the column entirely: scheduleHide's timer fires, tooltip clears.
 *   - Mounting/unmounting: useEffect cleanup clears any pending timer.
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

	// Single shared tooltip state. {text, rect} or null.
	const [tip, setTip] = useState(null);
	const hideTimerRef = useRef(null);

	const showTip = useCallback((text, el) => {
		if (hideTimerRef.current) {
			clearTimeout(hideTimerRef.current);
			hideTimerRef.current = null;
		}
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setTip({ text, rect });
	}, []);

	const scheduleHide = useCallback(() => {
		if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		hideTimerRef.current = setTimeout(() => {
			setTip(null);
			hideTimerRef.current = null;
		}, 50);
	}, []);

	// Cleanup any pending hide timer on unmount
	useEffect(() => {
		return () => {
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		};
	}, []);

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
							showTip={showTip}
							scheduleHide={scheduleHide}
						/>
					);
				})}
			</ul>
			{tip && <SharedTip text={tip.text} rect={tip.rect} />}
		</aside>
	);
}

/**
 * The one and only tooltip rendered while anything in the Players column is
 * hovered. Position is fixed to the viewport so overflow:auto on the column
 * doesn't clip it. Centered horizontally above the target element.
 */
function SharedTip({ text, rect }) {
	return (
		<div
			className="imp-players-col__tip"
			role="tooltip"
			aria-hidden="true"
			style={{
				position: 'fixed',
				top: Math.max(4, rect.top - 6),
				left: rect.left + rect.width / 2,
			}}
		>
			{text}
		</div>
	);
}

function twoDec(money) {
	if (money === undefined || money === null) return null;
	return parseFloat(money).toFixed(2);
}

function PlayerRow({ player, info, isUser, isAbsent, countryInfo, palette, showTip, scheduleHide }) {
	const rowClass =
		'imp-players-col__row' +
		(isUser ? ' imp-players-col__row--user' : '') +
		(isAbsent ? ' imp-players-col__row--absent' : '');

	const scoreTitle = isAbsent
		? player
		: player + ' — score ' + helper.computeScore(info || {}, countryInfo || {}).toFixed(2);

	// Factory: one call produces {onMouseEnter, onMouseLeave} bound to a
	// specific tooltip text. Reuse for every hoverable child.
	const tipOn = (text) => ({
		onMouseEnter: (e) => showTip(text, e.currentTarget),
		onMouseLeave: scheduleHide,
	});

	return (
		<li className={rowClass} aria-current={isUser ? 'true' : undefined}>
			<div className="imp-players-col__row-top">
				<span className="imp-players-col__name" {...tipOn(scoreTitle)}>
					{player}
				</span>
				<Leaderships player={player} countryInfo={countryInfo} palette={palette} tipOn={tipOn} />
				<InvestorSwiss info={info} tipOn={tipOn} />
				<span className="imp-players-col__money">{isAbsent ? '—' : '$' + (twoDec(info.money) ?? '0.00')}</span>
			</div>
			{!isAbsent && (
				<div className="imp-players-col__row-bottom">
					<StockBadges stock={info.stock} palette={palette} tipOn={tipOn} />
				</div>
			)}
		</li>
	);
}

function Leaderships({ player, countryInfo, palette, tipOn }) {
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
					aria-label={c + ' Leader'}
					style={{ color: bright[c] }}
					{...tipOn(c + ' Leader')}
				/>
			);
		}
		if (info.gov === 'democracy' && leadership[1] === player) {
			chips.push(
				<FlagOutlined
					key={'opp-' + c}
					className="imp-players-col__flag"
					aria-label={c + ' Opposition'}
					style={{ color: bright[c] }}
					{...tipOn(c + ' Opposition')}
				/>
			);
		}
	}
	if (chips.length === 0) return null;
	return <span className="imp-players-col__flags">{chips}</span>;
}

function InvestorSwiss({ info, tipOn }) {
	const badges = [];
	if (info.investor) {
		badges.push(
			<DollarCircleFilled
				key="investor"
				className="imp-players-col__icon imp-players-col__icon--investor"
				aria-label="Investor Card"
				{...tipOn('Investor Card')}
			/>
		);
	}
	if (info.swiss) {
		badges.push(
			<DollarCircleOutlined
				key="swiss"
				className="imp-players-col__icon imp-players-col__icon--swiss"
				aria-label="Swiss Banking"
				{...tipOn('Swiss Banking')}
			/>
		);
	}
	if (badges.length === 0) return null;
	return <span className="imp-players-col__icons">{badges}</span>;
}

function StockBadges({ stock, palette, tipOn }) {
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
					{...tipOn(entry.country)}
				>
					{entry.stock}
				</span>
			))}
		</span>
	);
}

export default PlayersColumn;
