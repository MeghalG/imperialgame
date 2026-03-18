/**
 * ManeuverPlanList
 *
 * Renders the plan list inside the turn panel for the maneuver redesign.
 * Reads from ManeuverPlanContext — all state and actions come from the provider.
 *
 * Displays:
 * - Prior completed moves (dimmed card at top)
 * - Fleet section with assigned and unassigned rows
 * - Hard divider between fleet and army sections
 * - Army section
 * - Lock visualization (rows above lockLine are dimmed + locked icon, bold divider)
 * - Progress indicator (N/M units assigned)
 * - Submit button (disabled if peace moves are unresolved)
 */

import React, { useContext } from 'react';
import { Button, Tag, Tooltip, Card } from 'antd';
import {
	ArrowUpOutlined,
	ArrowDownOutlined,
	CheckCircleOutlined,
	LockOutlined,
	CloseOutlined,
} from '@ant-design/icons';
import ManeuverPlanContext from './ManeuverPlanContext.js';
import { normalizeAction, formatCompletedAction, actionColor, hasPeaceInAction } from './maneuverActionUtils.js';
import { getCountryColorPalette } from './countryColors.js';
import UserContext from './UserContext.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a short display label for an action in an assigned row.
 * If the action is a compound array, labels are joined.
 *
 * @param {Array<{country: string|null, action: string}>|null} compound
 * @returns {string}
 */
function buildActionBadgeLabel(compound) {
	if (!compound || compound.length === 0) return '';
	return compound
		.map((entry) => formatCompletedAction(entry.action))
		.filter(Boolean)
		.join(' + ');
}

/**
 * Returns the dominant CSS color for a compound action array.
 * Uses the first entry's action color if available.
 *
 * @param {Array<{country: string|null, action: string}>|null} compound
 * @returns {string|undefined}
 */
function buildActionBadgeColor(compound) {
	if (!compound || compound.length === 0) return undefined;
	// Use actionColor from maneuverActionUtils which handles peace/hostile/war/blow-up
	return actionColor(compound[0].action) || undefined;
}

/**
 * Extracts the target country for a peace action in a compound array.
 * Returns null if no peace action is found or no country is present.
 *
 * @param {Array<{country: string|null, action: string}>|null} compound
 * @returns {string|null}
 */
function peaceTargetCountry(compound) {
	if (!compound) return null;
	let peaceEntry = compound.find((e) => e.action === 'peace' && e.country);
	return peaceEntry ? peaceEntry.country : null;
}

// ---------------------------------------------------------------------------
// PriorCompleted
// ---------------------------------------------------------------------------

function PriorCompleted({ priorCompleted }) {
	if (!priorCompleted || priorCompleted.length === 0) return null;
	return (
		<Card title="Committed Moves" size="small" style={{ marginBottom: 8 }}>
			{priorCompleted.map((desc, i) => (
				<div key={i} style={{ padding: '2px 0', color: 'rgba(255,255,255,0.65)' }}>
					{desc}
				</div>
			))}
		</Card>
	);
}

// ---------------------------------------------------------------------------
// ProgressIndicator
// ---------------------------------------------------------------------------

function ProgressIndicator({ fleetPlans, armyPlans }) {
	let total = fleetPlans.length + armyPlans.length;
	if (total === 0) return null;
	let assigned = fleetPlans.filter((p) => p.dest).length + armyPlans.filter((p) => p.dest).length;
	return (
		<div
			style={{
				fontSize: 11,
				color: 'rgba(255,255,255,0.45)',
				marginBottom: 8,
				letterSpacing: 0.5,
			}}
		>
			{assigned}/{total} units assigned
		</div>
	);
}

// ---------------------------------------------------------------------------
// AssignedUnitRow
// ---------------------------------------------------------------------------

function AssignedUnitRow({ phase, index, plan, isLocked, isActive, colorPalette, context }) {
	const { reorderMove, removeMove, setActiveUnit, requestPeace, submitting } = context;
	let plans = phase === 'fleet' ? context.fleetPlans : context.armyPlans;
	let totalUnits = plans.length;
	let unitLabel = phase === 'fleet' ? 'Fleet' : 'Army';
	let unitNum = index + 1;

	// plan.action is a string (raw code or JSON); normalize to compound array for display
	let actionCompound = plan.action ? normalizeAction(plan.action) : [];
	let badgeLabel = buildActionBadgeLabel(actionCompound);
	let badgeColor = buildActionBadgeColor(actionCompound);

	// Determine peace actions (for inline peace button)
	let hasPeace = hasPeaceInAction(actionCompound);
	let peaceCountry = peaceTargetCountry(actionCompound);
	let peaceColor = peaceCountry ? colorPalette.bright[peaceCountry] || '#52c41a' : '#52c41a';

	// Row border color: orange for peace rows, green for planned, gray for unplanned
	let borderColor = hasPeace ? '#fa8c16' : '#52c41a';

	let rowStyle = {
		borderLeft: '3px solid ' + (isLocked ? 'rgba(255,255,255,0.12)' : borderColor),
		padding: '8px 12px',
		marginBottom: 4,
		borderRadius: '0 4px 4px 0',
		background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
		opacity: isLocked ? 0.4 : 1,
		cursor: isLocked ? 'default' : 'pointer',
		transition: 'opacity 0.15s',
		position: 'relative',
	};

	function handleRowClick() {
		if (isLocked) return;
		setActiveUnit({ phase, index });
	}

	return (
		<div style={rowStyle} onClick={handleRowClick}>
			{/* Lock icon overlay for locked rows */}
			{isLocked && (
				<LockOutlined
					style={{
						position: 'absolute',
						right: 8,
						top: 8,
						color: 'rgba(255,255,255,0.25)',
						fontSize: 11,
					}}
				/>
			)}

			<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
				{/* Reorder buttons */}
				{!isLocked && (
					<span style={{ display: 'flex', flexDirection: 'column', gap: 0, marginRight: 4 }}>
						<Tooltip title="Move up" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowUpOutlined />}
								disabled={index === 0}
								onClick={(e) => {
									e.stopPropagation();
									reorderMove(phase, index, index - 1);
								}}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
						<Tooltip title="Move down" mouseLeaveDelay={0} mouseEnterDelay={0.15} destroyTooltipOnHide>
							<Button
								type="text"
								size="small"
								icon={<ArrowDownOutlined />}
								disabled={index === totalUnits - 1}
								onClick={(e) => {
									e.stopPropagation();
									reorderMove(phase, index, index + 1);
								}}
								style={{ padding: '0 4px', height: 18, fontSize: 10 }}
							/>
						</Tooltip>
					</span>
				)}

				{/* Unit label and move */}
				<span style={{ flex: 1, fontSize: 13 }}>
					<strong>
						{unitLabel} {unitNum}:
					</strong>{' '}
					{plan.origin}
					{plan.dest && plan.dest !== plan.origin && (
						<span style={{ color: 'rgba(255,255,255,0.65)' }}>
							{' '}
							→ <strong>{plan.dest}</strong>
						</span>
					)}
					{plan.dest && plan.dest === plan.origin && (
						<span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}> (stay)</span>
					)}
				</span>

				{/* Checkmark for fully planned */}
				<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />

				{/* Action badge */}
				{badgeLabel && (
					<Tag
						style={{
							marginLeft: 4,
							fontSize: 11,
							lineHeight: '18px',
							color: badgeColor ? '#fff' : undefined,
							background: badgeColor ? badgeColor + '33' : undefined,
							borderColor: badgeColor || undefined,
						}}
					>
						{badgeLabel}
					</Tag>
				)}

				{/* Remove button */}
				{!isLocked && (
					<Tooltip title="Remove move" mouseLeaveDelay={0} mouseEnterDelay={0.2} destroyTooltipOnHide>
						<Button
							type="text"
							size="small"
							icon={<CloseOutlined />}
							onClick={(e) => {
								e.stopPropagation();
								removeMove(phase, index);
							}}
							style={{ padding: '0 4px', height: 18, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}
						/>
					</Tooltip>
				)}
			</div>

			{/* Inline peace button */}
			{hasPeace && !isLocked && (
				<div style={{ marginTop: 6 }}>
					<Button
						size="small"
						loading={submitting}
						onClick={(e) => {
							e.stopPropagation();
							requestPeace(phase, index);
						}}
						style={{
							background: peaceColor,
							borderColor: peaceColor,
							color: '#fff',
							fontSize: 11,
						}}
					>
						Request Peace{peaceCountry ? ': ' + peaceCountry : ''}
					</Button>
				</div>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// UnassignedUnitRow
// ---------------------------------------------------------------------------

function UnassignedUnitRow({ phase, index, unit, isActive, context }) {
	const { setActiveUnit } = context;
	let unitLabel = phase === 'fleet' ? 'Fleet' : 'Army';
	let unitNum = index + 1;

	let rowStyle = {
		borderLeft: '3px solid #434343',
		padding: '8px 12px',
		marginBottom: 4,
		borderRadius: '0 4px 4px 0',
		opacity: isActive ? 0.7 : 0.4,
		background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
		cursor: 'pointer',
		transition: 'opacity 0.15s',
	};

	function handleRowClick() {
		setActiveUnit({ phase, index });
	}

	return (
		<div style={rowStyle} onClick={handleRowClick}>
			<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
				<strong>
					{unitLabel} {unitNum}:
				</strong>{' '}
				{unit.origin}{' '}
				<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>(unassigned)</span>
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// LockDivider
// ---------------------------------------------------------------------------

function LockDivider() {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				margin: '8px 0',
				gap: 8,
			}}
		>
			<div
				style={{
					flex: 1,
					height: 2,
					background: 'rgba(255,255,255,0.15)',
					borderRadius: 1,
				}}
			/>
			<LockOutlined style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
			<div
				style={{
					flex: 1,
					height: 2,
					background: 'rgba(255,255,255,0.15)',
					borderRadius: 1,
				}}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// PhaseSection
// ---------------------------------------------------------------------------

function PhaseSection({ phase, colorPalette, planContext }) {
	let { fleetPlans, armyPlans, activeUnit } = planContext;

	let plans = phase === 'fleet' ? fleetPlans : armyPlans;
	let label = phase === 'fleet' ? 'FLEET MOVES' : 'ARMY MOVES';

	// Nothing to show for this phase
	if (plans.length === 0) return null;

	// Use plan.locked directly — the provider sets it correctly for
	// both same-phase and cross-phase locking (army peace locks all fleets)
	function isRowLocked(idx) {
		return !!plans[idx] && !!plans[idx].locked;
	}

	// Find the last locked row to insert a LockDivider after it
	let lastLockedIndex = -1;
	for (let i = plans.length - 1; i >= 0; i--) {
		if (plans[i] && plans[i].locked) {
			lastLockedIndex = i;
			break;
		}
	}

	function isUnitActive(idx) {
		return activeUnit && activeUnit.phase === phase && activeUnit.index === idx;
	}

	return (
		<div style={{ marginBottom: 16 }}>
			{/* Section header */}
			<div
				style={{
					fontWeight: 600,
					marginBottom: 8,
					textTransform: 'uppercase',
					fontSize: 12,
					letterSpacing: 1,
					color: 'rgba(255,255,255,0.45)',
				}}
			>
				{label}
			</div>

			{/* All rows — assigned rendered as AssignedUnitRow, unassigned as UnassignedUnitRow */}
			{plans.map((plan, idx) => {
				let locked = isRowLocked(idx);
				let isAssigned = !!plan.dest;
				return (
					<React.Fragment key={phase + '-' + idx}>
						{isAssigned ? (
							<AssignedUnitRow
								phase={phase}
								index={idx}
								plan={plan}
								isLocked={locked}
								isActive={isUnitActive(idx)}
								colorPalette={colorPalette}
								context={planContext}
							/>
						) : (
							<UnassignedUnitRow
								phase={phase}
								index={idx}
								unit={plan}
								isActive={isUnitActive(idx)}
								context={planContext}
							/>
						)}
						{/* Insert lock divider after the last locked row */}
						{idx === lastLockedIndex && plans.length > idx + 1 && <LockDivider />}
					</React.Fragment>
				);
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// SectionDivider — hard divider between fleet and army
// ---------------------------------------------------------------------------

function SectionDivider() {
	return (
		<div
			style={{
				height: 1,
				background: 'rgba(255,255,255,0.1)',
				margin: '8px 0 16px',
			}}
		/>
	);
}

// ---------------------------------------------------------------------------
// SubmitButton
// ---------------------------------------------------------------------------

function SubmitButton({ planContext }) {
	let { fleetPlans, armyPlans, unassignedFleets, unassignedArmies, canSubmit, submitManeuver, submitting, lockLine } =
		planContext;

	// Don't show if there are still unresolved peace votes (lockLine present)
	if (lockLine) return null;

	// Don't show if nothing to submit
	let hasAnyPlans = fleetPlans.length > 0 || armyPlans.length > 0;
	if (!hasAnyPlans) return null;

	// Disabled if not all units are assigned
	let allAssigned = unassignedFleets.length === 0 && unassignedArmies.length === 0;
	let isDisabled = !canSubmit || !allAssigned;

	let tooltipTitle = '';
	if (!allAssigned) {
		let remaining = unassignedFleets.length + unassignedArmies.length;
		tooltipTitle = remaining + ' unit(s) still unassigned';
	} else if (!canSubmit) {
		tooltipTitle = 'No moves to submit';
	}

	let button = (
		<Button type="primary" loading={submitting} disabled={isDisabled} onClick={() => submitManeuver()}>
			Submit Maneuver
		</Button>
	);

	return (
		<div style={{ marginTop: 12 }}>
			{tooltipTitle ? (
				<Tooltip title={tooltipTitle}>
					<span>{button}</span>
				</Tooltip>
			) : (
				button
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// ManeuverPlanList
// ---------------------------------------------------------------------------

/**
 * ManeuverPlanList
 *
 * Main exported component. Reads ManeuverPlanContext and renders:
 * - Prior completed moves card
 * - Fleet section (assigned + unassigned rows)
 * - Divider
 * - Army section (assigned + unassigned rows)
 * - Progress indicator
 * - Submit button
 */
function ManeuverPlanList() {
	const planContext = useContext(ManeuverPlanContext);
	const userContext = useContext(UserContext);

	let { loaded, fleetPlans, armyPlans, priorCompleted } = planContext;
	let colorPalette = getCountryColorPalette(userContext.colorblindMode);

	if (!loaded) {
		return <div style={{ textAlign: 'center', padding: 40 }}>Loading maneuver...</div>;
	}

	let hasFleets = fleetPlans.length > 0;
	let hasArmies = armyPlans.length > 0;

	return (
		<div>
			{/* Prior completed moves from previous peace rounds */}
			<PriorCompleted priorCompleted={priorCompleted} />

			{/* Progress indicator */}
			<ProgressIndicator fleetPlans={fleetPlans} armyPlans={armyPlans} />

			{/* Fleet section */}
			{hasFleets && <PhaseSection phase="fleet" colorPalette={colorPalette} planContext={planContext} />}

			{/* Hard divider between fleet and army */}
			{hasFleets && hasArmies && <SectionDivider />}

			{/* Army section */}
			{hasArmies && <PhaseSection phase="army" colorPalette={colorPalette} planContext={planContext} />}

			{/* Submit button */}
			<SubmitButton planContext={planContext} />
		</div>
	);
}

export default ManeuverPlanList;
