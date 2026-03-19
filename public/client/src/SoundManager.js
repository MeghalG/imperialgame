/* Sound Manager — Web Audio API synthesized effects
   No external audio files needed; all sounds are generated procedurally. */

let audioCtx = null;
let muted = false;

function getContext() {
	if (!audioCtx) {
		let Ctor = window.AudioContext || window.webkitAudioContext;
		if (!Ctor) {
			muted = true;
			return null;
		}
		audioCtx = new Ctor();
	}
	return audioCtx;
}

function isMuted() {
	return muted;
}

function setMuted(val) {
	muted = val;
}

function toggleMute() {
	muted = !muted;
	return muted;
}

/* Soft "thump" — unit placement, general confirmation */
function playPlace() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(120, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12);
	gain.gain.setValueAtTime(0.15, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.15);
}

/* Coin clink — buying/selling stocks */
function playCoin() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(2400, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);
	gain.gain.setValueAtTime(0.08, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.12);
}

/* Brass horn — turn announcement (debounced to prevent multiple plays from concurrent listeners) */
let lastHornTime = 0;
function playTurnHorn() {
	if (muted) return;
	let now = Date.now();
	if (now - lastHornTime < 500) return;
	lastHornTime = now;
	const ctx = getContext();
	if (!ctx) return;
	const notes = [220, 330, 440];
	notes.forEach((freq, i) => {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sawtooth';
		const t = ctx.currentTime + i * 0.08;
		osc.frequency.setValueAtTime(freq, t);
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(0.06, t + 0.04);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(t);
		osc.stop(t + 0.3);
	});
}

/* Paper shuffle — mode change */
function playShuffle() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	const bufferSize = ctx.sampleRate * 0.08;
	const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		data[i] = (Math.random() * 2 - 1) * 0.03;
	}
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const filter = ctx.createBiquadFilter();
	filter.type = 'bandpass';
	filter.frequency.value = 3000;
	filter.Q.value = 0.5;
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.1, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
	source.connect(filter);
	filter.connect(gain);
	gain.connect(ctx.destination);
	source.start(ctx.currentTime);
}

/* Submit click — satisfying button press */
function playSubmit() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(600, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);
	gain.gain.setValueAtTime(0.08, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.1);
}

/* Unit select — short rising blip */
function playSelect() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(400, ctx.currentTime);
	osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
	gain.gain.setValueAtTime(0.07, ctx.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(ctx.currentTime);
	osc.stop(ctx.currentTime + 0.08);
}

/* Destination chosen — two-note confirm chirp */
function playDestination() {
	if (muted) return;
	const ctx = getContext();
	if (!ctx) return;
	[520, 700].forEach((freq, i) => {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		const t = ctx.currentTime + i * 0.06;
		osc.frequency.setValueAtTime(freq, t);
		gain.gain.setValueAtTime(0.06, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(t);
		osc.stop(t + 0.08);
	});
}

const SoundManager = {
	isMuted,
	setMuted,
	toggleMute,
	playPlace,
	playCoin,
	playTurnHorn,
	playShuffle,
	playSubmit,
	playSelect,
	playDestination,
};

export default SoundManager;
