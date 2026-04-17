import React from 'react';
import { render } from '@testing-library/react';

// Stub ResizeObserver for MapViewport
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Mock the heavy children so we only assert the layout structure
jest.mock('./MapApp.js', () => () => <div data-testid="map-stub">MAP</div>);
jest.mock('./PlayersColumn.js', () => () => <div data-testid="players-stub">PLAYERS</div>);
jest.mock('./Sidebar.js', () => () => <div data-testid="sidebar-stub">SIDEBAR</div>);
jest.mock('./FloatingSubmit.js', () => () => <div data-testid="fab-stub">FAB</div>);
jest.mock('./ManeuverPlanProvider.js', () => {
	return ({ children }) => <div data-testid="man-provider">{children}</div>;
});

// eslint-disable-next-line import/first
import MainApp from './MainApp.js';

describe('MainApp layout (3-column)', () => {
	it('renders without crashing', () => {
		render(<MainApp />);
	});

	it('mounts Map, Players, and Sidebar as siblings of the layout container', () => {
		const { getByTestId, container } = render(<MainApp />);
		expect(getByTestId('map-stub')).toBeInTheDocument();
		expect(getByTestId('players-stub')).toBeInTheDocument();
		expect(getByTestId('sidebar-stub')).toBeInTheDocument();
		const layout = container.querySelector('.imp-game-layout');
		expect(layout).not.toBeNull();
	});

	it('renders Players BETWEEN Map and Sidebar (order matters for the layout)', () => {
		const { container } = render(<MainApp />);
		const layout = container.querySelector('.imp-game-layout');
		const children = Array.from(layout.children);
		// Find the index of the element containing each stub
		const mapIdx = children.findIndex((c) => c.querySelector('[data-testid="map-stub"]'));
		const playersIdx = children.findIndex(
			(c) => c.querySelector('[data-testid="players-stub"]') || c.matches('[data-testid="players-stub"]')
		);
		const sidebarIdx = children.findIndex(
			(c) => c.querySelector('[data-testid="sidebar-stub"]') || c.matches('[data-testid="sidebar-stub"]')
		);
		expect(mapIdx).toBeGreaterThanOrEqual(0);
		expect(playersIdx).toBeGreaterThanOrEqual(0);
		expect(sidebarIdx).toBeGreaterThanOrEqual(0);
		expect(mapIdx).toBeLessThan(playersIdx);
		expect(playersIdx).toBeLessThan(sidebarIdx);
	});

	it('mounts FloatingSubmit inside MapViewport via the overlay prop (not as a sibling of Players/Sidebar)', () => {
		const { getByTestId, container } = render(<MainApp />);
		const viewport = container.querySelector('.imp-viewport');
		expect(viewport).not.toBeNull();
		const fab = getByTestId('fab-stub');
		// FAB is a descendant of viewport (via overlay prop), not a sibling of Sidebar
		expect(viewport.contains(fab)).toBe(true);
	});
});
