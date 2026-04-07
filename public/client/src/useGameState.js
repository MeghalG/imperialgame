import { useState, useEffect, useCallback } from 'react';
import { subscribe, getCachedState } from './backendFiles/stateCache.js';

/**
 * React hook that subscribes to the stateCache and re-renders when game state changes.
 *
 * Returns { gameState, loading } where:
 * - gameState is the current cached game state (or null during initial load)
 * - loading is true until the first state arrives
 *
 * Components using this hook do NOT need their own Firebase turnID listener.
 * The single listener in GameApp drives stateCache, which notifies all subscribers.
 */
function useGameState() {
	const [gameState, setGameState] = useState(() => getCachedState());
	const [loading, setLoading] = useState(() => getCachedState() === null);

	const handleStateChange = useCallback((newState) => {
		setGameState(newState);
		setLoading(false);
	}, []);

	useEffect(() => {
		// Check if cache already has state (e.g. Firebase .on() fired before this mount)
		let current = getCachedState();
		if (current) {
			setGameState(current);
			setLoading(false);
		}

		let unsubscribe = subscribe(handleStateChange);
		return unsubscribe;
	}, [handleStateChange]);

	return { gameState, loading };
}

export default useGameState;
