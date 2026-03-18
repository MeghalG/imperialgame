import { initializeApp } from 'firebase/app';
import {
	getDatabase,
	connectDatabaseEmulator,
	ref,
	set,
	onValue,
	onChildAdded,
	onChildRemoved,
	onChildChanged,
	off,
	remove,
} from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';

const config = {
	apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
	authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
	storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
	projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
};

const app = initializeApp(config);
const db = getDatabase(app);
const functions = getFunctions(app);

// Connect to Firebase emulator if REACT_APP_FIREBASE_EMULATOR is set
console.log('[firebase] REACT_APP_FIREBASE_EMULATOR =', process.env.REACT_APP_FIREBASE_EMULATOR);
if (process.env.REACT_APP_FIREBASE_EMULATOR === 'true') {
	connectDatabaseEmulator(db, 'localhost', 9000);
	console.log('[firebase] Connected to Database Emulator on localhost:9000');
}

// Map v8 event names to v10 listener functions
const listenerFns = {
	value: onValue,
	child_added: onChildAdded,
	child_removed: onChildRemoved,
	child_changed: onChildChanged,
};

// v8-compatible wrapper: exports a `database` object with .ref(path) that
// returns an object with .once(), .on(), .off(), .set(), .remove().
// This lets all existing call sites and test mocks keep working unchanged.
const database = {
	ref: (path) => {
		const dbRef = ref(db, path);
		return {
			// .once('value') -> get(dbRef) (returns Promise<DataSnapshot>)
			// .once('value', callback) -> get(dbRef).then(callback) (v8 callback style)
			// Special case: .info paths (e.g. /.info/serverTimeOffset) are client-only
			// and don't work with get() in Firebase v10+ (server rejects them).
			// Use a one-shot onValue listener instead.
			once: (eventType, callback) => {
				// Use a one-shot onValue listener for ALL paths instead of get().
				// Firebase v10's get() can fail with "Permission denied" when an
				// active WebSocket connection exists with stale auth state, even
				// when rules allow public reads. onValue uses the persistent
				// connection and works reliably.
				// NOTE: onValue may fire the callback synchronously when data is
				// cached, so we use `let detach` (not `const`) to avoid a
				// temporal dead zone ReferenceError.
				let promise = new Promise((resolve, reject) => {
					let detach = null;
					detach = onValue(
						dbRef,
						(snapshot) => {
							resolve(snapshot);
							if (detach) {
								detach();
							} else {
								Promise.resolve().then(() => {
									if (detach) detach();
								});
							}
						},
						(error) => {
							reject(error);
						}
					);
				});
				if (callback) {
					promise.then(callback);
					return promise;
				}
				return promise;
			},
			// .on('value'|'child_added'|'child_removed'|'child_changed', callback)
			on: (eventType, callback) => {
				const fn = listenerFns[eventType];
				if (fn) {
					return fn(dbRef, callback);
				}
				console.warn('firebase.js wrapper: unknown event type', eventType);
			},
			// .off() - detach all listeners on this ref
			off: () => {
				off(dbRef);
			},
			// .set(data) or .set(data, callback)
			set: (data, callback) => {
				const promise = set(dbRef, data);
				if (callback) {
					promise.then(() => callback(null)).catch((error) => callback(error));
					return promise;
				}
				return promise;
			},
			// .remove()
			remove: () => {
				return remove(dbRef);
			},
		};
	},
};

async function fix() {
	// await database.ref('game histories/').remove();
	return;
}
fix();

/**
 * Creates a callable reference to a Cloud Function.
 * @param {string} name - Cloud Function name (e.g. 'submitTurn')
 * @returns {Function} Callable function that accepts data and returns a promise
 */
function callFunction(name) {
	return httpsCallable(functions, name);
}

export { database, fix, callFunction };
