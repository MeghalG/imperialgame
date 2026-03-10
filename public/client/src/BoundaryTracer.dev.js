import React, { useState, useRef, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'imp-boundary-tracer-data';

const COLORS = [
	'#e6194b',
	'#3cb44b',
	'#ffe119',
	'#4363d8',
	'#f58231',
	'#911eb4',
	'#42d4f4',
	'#f032e6',
	'#bfef45',
	'#fabed4',
	'#469990',
	'#dcbeff',
	'#9a6324',
	'#fffac8',
	'#800000',
	'#aaffc3',
	'#808000',
	'#ffd8b1',
	'#000075',
	'#a9a9a9',
];

const styles = {
	toggleBtn: {
		position: 'fixed',
		top: 8,
		left: 8,
		zIndex: 9999,
		background: 'rgba(20, 21, 24, 0.9)',
		color: '#c9a84c',
		border: '1px solid rgba(201, 168, 76, 0.4)',
		borderRadius: 4,
		padding: '4px 10px',
		fontSize: 11,
		fontWeight: 600,
		cursor: 'pointer',
		fontFamily: 'monospace',
		letterSpacing: 0.5,
	},
	toggleBtnActive: {
		background: '#c9a84c',
		color: '#141518',
	},
	overlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		zIndex: 9998,
		pointerEvents: 'none',
	},
	svg: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		pointerEvents: 'auto',
		cursor: 'crosshair',
	},
	panel: {
		position: 'fixed',
		top: 44,
		left: 8,
		zIndex: 9999,
		background: 'rgba(20, 21, 24, 0.94)',
		border: '1px solid rgba(255, 255, 255, 0.1)',
		borderRadius: 6,
		padding: 10,
		color: 'rgba(255, 255, 255, 0.88)',
		fontSize: 12,
		fontFamily: 'monospace',
		maxHeight: 'calc(100vh - 60px)',
		overflowY: 'auto',
		width: 220,
		boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
	},
	panelTitle: {
		fontSize: 13,
		fontWeight: 700,
		marginBottom: 8,
		color: '#c9a84c',
		borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
		paddingBottom: 6,
	},
	coordDisplay: {
		position: 'fixed',
		bottom: 52,
		left: 8,
		zIndex: 9999,
		background: 'rgba(20, 21, 24, 0.9)',
		color: 'rgba(255, 255, 255, 0.7)',
		border: '1px solid rgba(255, 255, 255, 0.08)',
		borderRadius: 4,
		padding: '3px 8px',
		fontSize: 11,
		fontFamily: 'monospace',
	},
	statusBar: {
		position: 'fixed',
		bottom: 8,
		left: 8,
		zIndex: 9999,
		background: 'rgba(20, 21, 24, 0.9)',
		color: 'rgba(255, 255, 255, 0.6)',
		border: '1px solid rgba(255, 255, 255, 0.08)',
		borderRadius: 4,
		padding: '3px 8px',
		fontSize: 10,
		fontFamily: 'monospace',
		maxWidth: 350,
	},
	button: {
		background: 'rgba(255, 255, 255, 0.08)',
		color: 'rgba(255, 255, 255, 0.8)',
		border: '1px solid rgba(255, 255, 255, 0.15)',
		borderRadius: 3,
		padding: '3px 8px',
		fontSize: 11,
		cursor: 'pointer',
		fontFamily: 'monospace',
		marginRight: 4,
		marginBottom: 4,
	},
	buttonDanger: {
		background: 'rgba(211, 32, 41, 0.2)',
		color: '#ff4d4f',
		border: '1px solid rgba(211, 32, 41, 0.3)',
		borderRadius: 3,
		padding: '2px 6px',
		fontSize: 10,
		cursor: 'pointer',
		fontFamily: 'monospace',
	},
	territoryItem: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '3px 0',
		borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
		cursor: 'pointer',
	},
	territoryName: {
		fontSize: 11,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		flex: 1,
	},
	vertexCount: {
		fontSize: 10,
		color: 'rgba(255, 255, 255, 0.4)',
		marginLeft: 6,
		marginRight: 6,
		flexShrink: 0,
	},
	colorDot: {
		display: 'inline-block',
		width: 8,
		height: 8,
		borderRadius: '50%',
		marginRight: 6,
		flexShrink: 0,
	},
};

function BoundaryTracer() {
	const [active, setActive] = useState(false);
	const [territories, setTerritories] = useState({});
	const [currentVertices, setCurrentVertices] = useState([]);
	const [editingName, setEditingName] = useState(null);
	const [mousePos, setMousePos] = useState(null);
	const svgRef = useRef(null);

	// Load from localStorage on mount
	useEffect(() => {
		try {
			let saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				let parsed = JSON.parse(saved);
				if (parsed && typeof parsed === 'object') {
					setTerritories(parsed);
				}
			}
		} catch (e) {
			// Ignore parse errors
		}
	}, []);

	// Auto-save to localStorage on every change
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(territories));
		} catch (e) {
			// Ignore storage errors
		}
	}, [territories]);

	const getViewBoxCoords = useCallback((event) => {
		let svg = svgRef.current;
		if (!svg) return null;
		let x = (event.nativeEvent.offsetX / svg.clientWidth) * 100;
		let y = (event.nativeEvent.offsetY / svg.clientHeight) * 100;
		return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
	}, []);

	const handleSvgClick = useCallback(
		(event) => {
			if (event.button !== 0) return;
			let coords = getViewBoxCoords(event);
			if (!coords) return;
			setCurrentVertices((prev) => [...prev, coords]);
		},
		[getViewBoxCoords]
	);

	const handleContextMenu = useCallback((event) => {
		event.preventDefault();
		setCurrentVertices((prev) => prev.slice(0, -1));
	}, []);

	const handleMouseMove = useCallback(
		(event) => {
			let coords = getViewBoxCoords(event);
			if (coords) {
				setMousePos(coords);
			}
		},
		[getViewBoxCoords]
	);

	const handleMouseLeave = useCallback(() => {
		setMousePos(null);
	}, []);

	const finalizeCurrent = useCallback(() => {
		if (currentVertices.length < 3) {
			return;
		}
		let defaultName = editingName || '';
		let name = prompt('Territory name:', defaultName);
		if (!name || !name.trim()) return;
		name = name.trim();
		setTerritories((prev) => ({
			...prev,
			[name]: currentVertices.slice(),
		}));
		setCurrentVertices([]);
		setEditingName(null);
	}, [currentVertices, editingName]);

	const cancelCurrent = useCallback(() => {
		setCurrentVertices([]);
		setEditingName(null);
	}, []);

	const undoVertex = useCallback(() => {
		setCurrentVertices((prev) => prev.slice(0, -1));
	}, []);

	const editTerritory = useCallback(
		(name) => {
			let verts = territories[name];
			if (!verts) return;
			setCurrentVertices(verts.slice());
			setEditingName(name);
			// Remove from saved while editing
			setTerritories((prev) => {
				let next = { ...prev };
				delete next[name];
				return next;
			});
		},
		[territories]
	);

	const deleteTerritory = useCallback((name, event) => {
		event.stopPropagation();
		if (!window.confirm('Delete territory "' + name + '"?')) return;
		setTerritories((prev) => {
			let next = { ...prev };
			delete next[name];
			return next;
		});
	}, []);

	const exportData = useCallback(() => {
		let lines = ['const TERRITORY_BOUNDARIES = {'];
		let names = Object.keys(territories).sort();
		for (let i = 0; i < names.length; i++) {
			let name = names[i];
			let verts = territories[name];
			let vertStr = verts.map((v) => '[' + v[0] + ', ' + v[1] + ']').join(', ');
			let comma = i < names.length - 1 ? ',' : '';
			lines.push('  "' + name + '": [' + vertStr + ']' + comma);
		}
		lines.push('};');
		lines.push('export default TERRITORY_BOUNDARIES;');
		let output = lines.join('\n');
		console.log(output);
		try {
			navigator.clipboard.writeText(output);
			alert('Exported ' + names.length + ' territories to console and clipboard.');
		} catch (e) {
			alert('Exported ' + names.length + ' territories to console. Clipboard write failed.');
		}
	}, [territories]);

	const importData = useCallback(() => {
		let input = prompt('Paste JSON data (e.g. {"Vienna": [[x1,y1], ...], ...}):');
		if (!input || !input.trim()) return;
		try {
			let parsed = JSON.parse(input.trim());
			if (!parsed || typeof parsed !== 'object') {
				alert('Invalid data: expected a JSON object.');
				return;
			}
			// Validate structure
			let count = 0;
			for (let name in parsed) {
				let verts = parsed[name];
				if (!Array.isArray(verts)) {
					alert('Invalid data for "' + name + '": expected an array of vertices.');
					return;
				}
				for (let j = 0; j < verts.length; j++) {
					if (!Array.isArray(verts[j]) || verts[j].length !== 2) {
						alert('Invalid vertex at "' + name + '"[' + j + ']: expected [x, y].');
						return;
					}
				}
				count++;
			}
			setTerritories((prev) => ({ ...prev, ...parsed }));
			alert('Imported ' + count + ' territories.');
		} catch (e) {
			alert('JSON parse error: ' + e.message);
		}
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		if (!active) return;

		function handleKeyDown(event) {
			let tag = event.target.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

			if (event.key === 'Enter') {
				event.preventDefault();
				finalizeCurrent();
			} else if (event.key === 'Escape') {
				event.preventDefault();
				cancelCurrent();
			} else if (event.key === 'z' || event.key === 'Z') {
				if (!event.ctrlKey && !event.metaKey) {
					event.preventDefault();
					undoVertex();
				}
			} else if (event.key === 's' || event.key === 'S') {
				if (!event.ctrlKey && !event.metaKey) {
					event.preventDefault();
					exportData();
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [active, finalizeCurrent, cancelCurrent, undoVertex, exportData]);

	let toggleStyle = { ...styles.toggleBtn };
	if (active) {
		Object.assign(toggleStyle, styles.toggleBtnActive);
	}

	let territoryNames = Object.keys(territories);

	// Build the polygon points string for current vertices
	let currentPointsStr = currentVertices.map((v) => v[0] + ',' + v[1]).join(' ');

	// Generate a color for the current polygon
	let currentColorIndex = territoryNames.length % COLORS.length;
	let currentColor = COLORS[currentColorIndex];

	return (
		<React.Fragment>
			{/* Toggle button - always visible */}
			<button style={toggleStyle} onClick={() => setActive((a) => !a)} title="Toggle Boundary Tracer (dev tool)">
				{active ? '[X] Tracer' : '[+] Tracer'}
			</button>

			{active && (
				<React.Fragment>
					{/* SVG Overlay - positioned relative to the map container.
					    We use a portal-like approach: this div needs to sit inside
					    the map's relative container. Since this is a dev tool,
					    we render it fixed and the user positions it over the map. */}
					<div style={styles.overlay} id="boundary-tracer-overlay">
						<svg
							ref={svgRef}
							style={styles.svg}
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							onClick={handleSvgClick}
							onContextMenu={handleContextMenu}
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
						>
							{/* Completed territories */}
							{territoryNames.map((name, idx) => {
								let verts = territories[name];
								let pointsStr = verts.map((v) => v[0] + ',' + v[1]).join(' ');
								let color = COLORS[idx % COLORS.length];
								// Compute centroid for label
								let cx = 0;
								let cy = 0;
								for (let i = 0; i < verts.length; i++) {
									cx += verts[i][0];
									cy += verts[i][1];
								}
								cx /= verts.length;
								cy /= verts.length;

								return (
									<g key={'t-' + name}>
										<polygon
											points={pointsStr}
											fill={color}
											fillOpacity={0.15}
											stroke={color}
											strokeOpacity={0.4}
											strokeWidth={0.2}
										/>
										<text
											x={cx}
											y={cy}
											fill="white"
											fontSize={1.4}
											textAnchor="middle"
											dominantBaseline="central"
											style={{ pointerEvents: 'none', userSelect: 'none' }}
										>
											{name}
										</text>
									</g>
								);
							})}

							{/* Current polygon in progress */}
							{currentVertices.length >= 3 && (
								<polygon
									points={currentPointsStr}
									fill={currentColor}
									fillOpacity={0.25}
									stroke={currentColor}
									strokeOpacity={0.8}
									strokeWidth={0.3}
								/>
							)}
							{currentVertices.length === 2 && (
								<line
									x1={currentVertices[0][0]}
									y1={currentVertices[0][1]}
									x2={currentVertices[1][0]}
									y2={currentVertices[1][1]}
									stroke={currentColor}
									strokeOpacity={0.8}
									strokeWidth={0.2}
								/>
							)}

							{/* Vertex dots for current polygon */}
							{currentVertices.map((v, i) => (
								<circle
									key={'v-' + i}
									cx={v[0]}
									cy={v[1]}
									r={0.4}
									fill={currentColor}
									stroke="white"
									strokeWidth={0.1}
								/>
							))}

							{/* Line from last vertex to mouse position (preview) */}
							{currentVertices.length > 0 && mousePos && (
								<line
									x1={currentVertices[currentVertices.length - 1][0]}
									y1={currentVertices[currentVertices.length - 1][1]}
									x2={mousePos[0]}
									y2={mousePos[1]}
									stroke={currentColor}
									strokeOpacity={0.5}
									strokeWidth={0.15}
									strokeDasharray="0.5 0.3"
								/>
							)}

							{/* Closing line preview (from mouse back to first vertex) */}
							{currentVertices.length >= 2 && mousePos && (
								<line
									x1={mousePos[0]}
									y1={mousePos[1]}
									x2={currentVertices[0][0]}
									y2={currentVertices[0][1]}
									stroke={currentColor}
									strokeOpacity={0.25}
									strokeWidth={0.1}
									strokeDasharray="0.3 0.3"
								/>
							)}
						</svg>
					</div>

					{/* Control Panel */}
					<div style={styles.panel}>
						<div style={styles.panelTitle}>Boundary Tracer</div>

						{/* Current polygon status */}
						<div style={{ marginBottom: 8 }}>
							<span style={{ color: currentColor, fontWeight: 700 }}>
								{editingName ? 'Editing: ' + editingName : 'New polygon'}
							</span>
							<span style={styles.vertexCount}>{currentVertices.length} vertices</span>
						</div>

						{/* Action buttons */}
						<div style={{ marginBottom: 10 }}>
							<button
								style={styles.button}
								onClick={finalizeCurrent}
								disabled={currentVertices.length < 3}
								title="Enter"
							>
								Finalize [Enter]
							</button>
							<button style={styles.button} onClick={cancelCurrent} title="Escape">
								Cancel [Esc]
							</button>
							<button style={styles.button} onClick={undoVertex} disabled={currentVertices.length === 0} title="Z">
								Undo [Z]
							</button>
						</div>

						{/* Export / Import */}
						<div style={{ marginBottom: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
							<button style={styles.button} onClick={exportData} title="S">
								Export [S]
							</button>
							<button style={styles.button} onClick={importData}>
								Import JSON
							</button>
						</div>

						{/* Territory list */}
						<div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
							<div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
								Territories ({territoryNames.length})
							</div>
							{territoryNames.length === 0 && (
								<div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
									None yet. Click on the map to trace.
								</div>
							)}
							{territoryNames.map((name, idx) => {
								let color = COLORS[idx % COLORS.length];
								let verts = territories[name];
								return (
									<div
										key={name}
										style={styles.territoryItem}
										onClick={() => editTerritory(name)}
										title={'Click to edit "' + name + '"'}
									>
										<span style={{ ...styles.colorDot, background: color }} />
										<span style={styles.territoryName}>{name}</span>
										<span style={styles.vertexCount}>{verts.length}v</span>
										<button
											style={styles.buttonDanger}
											onClick={(e) => deleteTerritory(name, e)}
											title={'Delete "' + name + '"'}
										>
											Del
										</button>
									</div>
								);
							})}
						</div>
					</div>

					{/* Mouse coordinate display */}
					{mousePos && (
						<div style={styles.coordDisplay}>
							x: {mousePos[0].toFixed(1)} y: {mousePos[1].toFixed(1)}
						</div>
					)}

					{/* Status bar with keyboard shortcuts */}
					<div style={styles.statusBar}>
						L-click: add vertex | R-click: undo | Enter: finalize | Esc: cancel | Z: undo | S: export
					</div>
				</React.Fragment>
			)}
		</React.Fragment>
	);
}

export default BoundaryTracer;
