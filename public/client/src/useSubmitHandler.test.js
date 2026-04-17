import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import TurnControlContext from './TurnControlContext.js';
import UserContext from './UserContext.js';
import useSubmitHandler from './useSubmitHandler.js';

// Mock SoundManager so tests don't depend on audio
jest.mock('./SoundManager.js', () => ({
	__esModule: true,
	default: {
		playSubmit: jest.fn(),
		playShuffle: jest.fn(),
	},
}));

// Mock countryColors so we get a predictable palette without importing real CSS assets
jest.mock('./countryColors.js', () => ({
	getCountryColorPalette: () => ({
		mid: { Austria: '#ffaa00' },
		dark: {},
		bright: {},
	}),
}));

// Test harness: renders hook output into the DOM and exposes handleClick
function Harness({ onResult }) {
	const result = useSubmitHandler();
	onResult(result);
	return (
		<div>
			<span data-testid="canSubmit">{String(result.canSubmit)}</span>
			<span data-testid="hasHandler">{String(result.hasHandler)}</span>
			<span data-testid="submitting">{String(result.submitting)}</span>
			<span data-testid="label">{result.submitLabel}</span>
			<span data-testid="bg">{result.bgColor}</span>
			<button data-testid="clicker" onClick={result.handleClick}>
				click
			</button>
		</div>
	);
}

function renderWithCtx(turnControl, user = {}) {
	let captured;
	const onResult = (r) => {
		captured = r;
	};
	const userValue = { country: '', colorblindMode: false, ...user };
	const utils = render(
		<UserContext.Provider value={userValue}>
			<TurnControlContext.Provider value={turnControl}>
				<Harness onResult={onResult} />
			</TurnControlContext.Provider>
		</UserContext.Provider>
	);
	return { ...utils, getResult: () => captured };
}

describe('useSubmitHandler', () => {
	describe('canSubmit predicate', () => {
		it('is false when submitHandler is null', () => {
			const { getByTestId } = renderWithCtx({
				submitHandler: null,
				submitEnabled: true,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting: jest.fn(),
			});
			expect(getByTestId('canSubmit').textContent).toBe('false');
			expect(getByTestId('hasHandler').textContent).toBe('false');
		});

		it('is false when submitEnabled is false', () => {
			const { getByTestId } = renderWithCtx({
				submitHandler: jest.fn(),
				submitEnabled: false,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting: jest.fn(),
			});
			expect(getByTestId('canSubmit').textContent).toBe('false');
			expect(getByTestId('hasHandler').textContent).toBe('true');
		});

		it('is false when submitting is true', () => {
			const { getByTestId } = renderWithCtx({
				submitHandler: jest.fn(),
				submitEnabled: true,
				submitting: true,
				submitLabel: 'Submit',
				setSubmitting: jest.fn(),
			});
			expect(getByTestId('canSubmit').textContent).toBe('false');
		});

		it('is true when handler exists, enabled, and not submitting', () => {
			const { getByTestId } = renderWithCtx({
				submitHandler: jest.fn(),
				submitEnabled: true,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting: jest.fn(),
			});
			expect(getByTestId('canSubmit').textContent).toBe('true');
		});
	});

	describe('handleClick', () => {
		it('calls submitHandler and toggles submitting via setSubmitting', async () => {
			const submitHandler = jest.fn().mockResolvedValue(undefined);
			const setSubmitting = jest.fn();
			const { getByTestId } = renderWithCtx({
				submitHandler,
				submitEnabled: true,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting,
			});
			await act(async () => {
				fireEvent.click(getByTestId('clicker'));
			});
			expect(setSubmitting).toHaveBeenCalledWith(true);
			expect(submitHandler).toHaveBeenCalledTimes(1);
			expect(setSubmitting).toHaveBeenCalledWith(false);
		});

		it('clears submitting via finally when handler rejects', async () => {
			const submitHandler = jest.fn().mockRejectedValue(new Error('boom'));
			const setSubmitting = jest.fn();
			const { getResult } = renderWithCtx({
				submitHandler,
				submitEnabled: true,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting,
			});
			// Call handleClick directly so we can await its rejection without an
			// unhandled promise chain through the DOM event system.
			await act(async () => {
				await expect(getResult().handleClick()).rejects.toThrow('boom');
			});
			expect(setSubmitting).toHaveBeenCalledWith(true);
			expect(setSubmitting).toHaveBeenCalledWith(false);
		});

		it('no-ops when disabled (double-click guard: !submitEnabled)', async () => {
			const submitHandler = jest.fn();
			const setSubmitting = jest.fn();
			const { getByTestId } = renderWithCtx({
				submitHandler,
				submitEnabled: false,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting,
			});
			await act(async () => {
				fireEvent.click(getByTestId('clicker'));
			});
			expect(submitHandler).not.toHaveBeenCalled();
			expect(setSubmitting).not.toHaveBeenCalled();
		});

		it('no-ops when already submitting (double-click guard)', async () => {
			const submitHandler = jest.fn();
			const setSubmitting = jest.fn();
			const { getByTestId } = renderWithCtx({
				submitHandler,
				submitEnabled: true,
				submitting: true,
				submitLabel: 'Submit',
				setSubmitting,
			});
			await act(async () => {
				fireEvent.click(getByTestId('clicker'));
			});
			expect(submitHandler).not.toHaveBeenCalled();
			expect(setSubmitting).not.toHaveBeenCalled();
		});
	});

	describe('bgColor', () => {
		it('defaults to teal when no country is set', () => {
			const { getByTestId } = renderWithCtx({
				submitHandler: null,
				submitEnabled: false,
				submitting: false,
				submitLabel: 'Submit',
				setSubmitting: jest.fn(),
			});
			expect(getByTestId('bg').textContent).toBe('#13a8a8');
		});

		it('uses country mid color when country is in the palette', () => {
			const { getByTestId } = renderWithCtx(
				{
					submitHandler: null,
					submitEnabled: false,
					submitting: false,
					submitLabel: 'Submit',
					setSubmitting: jest.fn(),
				},
				{ country: 'Austria' }
			);
			expect(getByTestId('bg').textContent).toBe('#ffaa00');
		});
	});
});
