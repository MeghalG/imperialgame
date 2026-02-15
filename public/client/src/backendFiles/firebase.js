import firebase from 'firebase';

const config = {
	apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
	authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
	storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
};
firebase.initializeApp(config);
const database = firebase.database();

async function fix() {
	// await database.ref('game histories/').remove();
	return;
}
fix();

export { database, fix };
