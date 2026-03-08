import { initializeApp } from 'firebase/app';
import {
	getDatabase,
	ref,
	get,
	set,
	onValue,
	onChildAdded,
	onChildRemoved,
	onChildChanged,
	off,
	remove,
} from 'firebase/database';

const config = {
	apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
	authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
	storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
};

const app = initializeApp(config);
const db = getDatabase(app);

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
			once: (eventType, callback) => {
				const promise = get(dbRef);
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

export { database, fix };
