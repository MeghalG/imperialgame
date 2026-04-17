import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import TurnControlContext from './TurnControlContext.js';
import UserContext from './UserContext.js';
import FloatingSubmit from './FloatingSubmit.js';

// Mock useGameState to control mode
let mockGameState = { mode: 'bid' };
jest.mock('./useGameState.js', () => ({
	__esModule: true,
	default: () => ({ gameState: mockGameState, loading: false }),
}));

// Mock SoundManager so submit-play doesn't error
jest.mock('./SoundManager.js', () => ({
	__esModule: true,
	default: {
		playSubmit: jest.fn(),
		playShuffle: jest.fn(),
	},
}));

// Mock countryColors for predictable palette
jest.mock('./countryColors.js', () => ({
	getCountryColorPalette: () => ({
		mid: {},
		dark: {},
		bright: {},
	}),
}));

// Mock ActionPreview so we control its render (by default renders some preview text)
let mockPreviewReturn = null;
jest.mock('./ActionPreview.js', () => ({
	__esModule: true,
	default: () => mockPreviewReturn,
}));

function renderFab(turnControl, userValue = {}) {
	return render(
		<UserContext.Provider value={{ country: '', colorblindMode: false, ...userValue }}>
			<TurnControlContext.Provider value={turnControl}>
				<FloatingSubmit />
			</TurnControlContext.Provider>
		</UserContext.Provider>
	);
}

beforeEach(() => {
	mockGameState = { mode: 'bid' };
	mockPreviewReturn = null;
});

describe('FloatingSubmit', () => {
	it('renders the FAB button with class imp-submit-fab when a handler is registered', () => {
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		expect(container.querySelector('.imp-submit-fab')).not.toBeNull();
	});

	it('returns null when there is no submit handler', () => {
		const { container } = renderFab({
			submitHandler: null,
			submitEnabled: false,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		expect(container.querySelector('.imp-submit-fab')).toBeNull();
		expect(container.querySelector('.imp-floating-submit')).toBeNull();
	});

	it('returns null when mode === game-over', () => {
		mockGameState = { mode: 'game-over' };
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		expect(container.querySelector('.imp-submit-fab')).toBeNull();
		expect(container.querySelector('.imp-floating-submit')).toBeNull();
	});

	it('renders FAB as disabled when submitEnabled is false (form incomplete)', () => {
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: false,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		const btn = container.querySelector('.imp-submit-fab');
		expect(btn).not.toBeNull();
		// Debug: print what the actual button looks like
		// console.log('DISABLED BUTTON HTML:', btn.outerHTML);
		// Button's disabled property as a DOM attribute — use .outerHTML as fallback signal
		expect(btn.outerHTML).toMatch(/disabled/);
	});

	it('stays mounted with spinner (not unmounted) when submitting', () => {
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: true,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		const btn = container.querySelector('.imp-submit-fab');
		expect(btn).not.toBeNull();
		expect(btn.outerHTML).toMatch(/disabled/);
		// Loading spinner from antd renders with anticon-loading class
		expect(btn.querySelector('.anticon-loading')).not.toBeNull();
	});

	it('preview pill wrapper stays mounted across empty ActionPreview (aria-live requirement)', () => {
		mockPreviewReturn = null; // ActionPreview returns null when empty
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		const slot = container.querySelector('.imp-floating-submit__preview-slot');
		expect(slot).not.toBeNull();
		expect(slot.getAttribute('role')).toBe('status');
		expect(slot.getAttribute('aria-live')).toBe('polite');
	});

	it('preview pill wrapper renders content when ActionPreview returns content', () => {
		mockPreviewReturn = <span data-testid="preview-text">Produce factories</span>;
		const { container, getByTestId } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting: jest.fn(),
		});
		expect(getByTestId('preview-text')).toBeInTheDocument();
		const slot = container.querySelector('.imp-floating-submit__preview-slot');
		expect(slot.textContent).toContain('Produce factories');
	});

	it('clicking the FAB fires the submit handler', async () => {
		const submitHandler = jest.fn().mockResolvedValue(undefined);
		const setSubmitting = jest.fn();
		const { container } = renderFab({
			submitHandler,
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Submit',
			setSubmitting,
		});
		const btn = container.querySelector('.imp-submit-fab');
		await act(async () => {
			fireEvent.click(btn);
		});
		expect(submitHandler).toHaveBeenCalledTimes(1);
		expect(setSubmitting).toHaveBeenCalledWith(true);
		expect(setSubmitting).toHaveBeenCalledWith(false);
	});

	it('button has aria-label reflecting the submit action', () => {
		const { container } = renderFab({
			submitHandler: jest.fn(),
			submitEnabled: true,
			submitting: false,
			submitLabel: 'Bid $12',
			setSubmitting: jest.fn(),
		});
		const btn = container.querySelector('.imp-submit-fab');
		expect(btn.getAttribute('aria-label')).toContain('Bid $12');
	});
});
