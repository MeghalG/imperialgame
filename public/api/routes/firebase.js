const firebase = require('firebase');

var config = {
	apiKey: "AIzaSyACA3o0NyzICYS4gFol3Emm9FGmpx-x7kA",
	authDomain: "imperialgame-e8a12.firebaseapp.com",
	databaseURL: "https://imperialgame-e8a12.firebaseio.com/",
	storageBucket: "gs://imperialgame-e8a12.appspot.com",
};
firebase.initializeApp(config);
var database = firebase.database();

async function fix() {
	return;
}
fix();

module.exports = database;