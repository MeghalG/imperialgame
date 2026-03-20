// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
	testDir: './e2e',
	timeout: 90000,
	retries: 0,
	use: {
		baseURL: 'http://localhost:3000',
		headless: true,
		screenshot: 'only-on-failure',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'npm start',
		port: 3000,
		timeout: 60000,
		reuseExistingServer: false, // Always start fresh to pick up code changes
		env: {
			// Connect the React app to the Firebase emulator
			REACT_APP_FIREBASE_EMULATOR: 'true',
		},
	},
});
