const fetch = require('node-fetch');

/**
 * Sends turn notification emails via EmailJS REST API.
 * Best-effort: logs errors but does not throw (email failure shouldn't block game).
 *
 * @param {Object} gameState - The game state (reads playerInfo for email + myTurn)
 */
async function sendTurnEmails(gameState) {
	const serviceID = process.env.EMAILJS_SERVICE_ID;
	const templateID = process.env.EMAILJS_TEMPLATE_ID;
	const userID = process.env.EMAILJS_USER_ID;

	if (!serviceID || !templateID || !userID) {
		console.warn('EmailJS not configured — skipping email notifications');
		return;
	}

	const emailPromises = [];
	for (const playerName in gameState.playerInfo) {
		const player = gameState.playerInfo[playerName];
		if (player.email && player.myTurn) {
			const p = fetch('https://api.emailjs.com/api/v1.0/email/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					service_id: serviceID,
					template_id: templateID,
					user_id: userID,
					template_params: {
						to_name: playerName,
						to_email: player.email,
					},
				}),
			}).catch((err) => {
				console.error(`Failed to send email to ${playerName}:`, err.message);
			});
			emailPromises.push(p);
		}
	}
	await Promise.all(emailPromises);
}

module.exports = { sendTurnEmails };
