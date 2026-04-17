import React from 'react';
import { render } from '@testing-library/react';

// jsdom doesn't implement ResizeObserver; MapViewport uses it to re-center on resize.
// Stub it before importing MapViewport.
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// eslint-disable-next-line import/first
import MapViewport from './MapViewport.js';

describe('MapViewport overlay prop', () => {
	it('renders overlay content as a sibling of the transformed canvas', () => {
		const { container } = render(
			<MapViewport overlay={<button data-testid="fab">Submit</button>}>
				<div data-testid="map-content">MAP</div>
			</MapViewport>
		);
		const viewport = container.querySelector('.imp-viewport');
		const canvas = viewport.querySelector('.imp-canvas');
		const overlay = viewport.querySelector('.imp-viewport__overlay');
		expect(canvas).not.toBeNull();
		expect(overlay).not.toBeNull();
		// Canvas and overlay are direct children of the viewport (siblings)
		expect(canvas.parentElement).toBe(viewport);
		expect(overlay.parentElement).toBe(viewport);
	});

	it('does NOT apply the pan/zoom transform to overlay content', () => {
		const { container } = render(
			<MapViewport overlay={<button data-testid="fab">Submit</button>}>
				<div data-testid="map-content">MAP</div>
			</MapViewport>
		);
		const canvas = container.querySelector('.imp-canvas');
		const overlay = container.querySelector('.imp-viewport__overlay');
		// Canvas has inline transform style
		expect(canvas.style.transform).toMatch(/translate.*scale/);
		// Overlay has no inline transform — positioning comes from CSS
		expect(overlay.style.transform).toBe('');
		// The fab is inside the overlay, not the canvas
		const fab = overlay.querySelector('[data-testid="fab"]');
		expect(fab).not.toBeNull();
		expect(canvas.querySelector('[data-testid="fab"]')).toBeNull();
	});

	it('renders without an overlay when prop is not provided (no overlay div)', () => {
		const { container } = render(
			<MapViewport>
				<div data-testid="map-content">MAP</div>
			</MapViewport>
		);
		expect(container.querySelector('.imp-viewport__overlay')).toBeNull();
		expect(container.querySelector('.imp-canvas [data-testid="map-content"]')).not.toBeNull();
	});
});
