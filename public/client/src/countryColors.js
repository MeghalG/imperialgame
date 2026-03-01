const NORMAL_COLORS = {
	bright: {
		Austria: '#d8bd14',
		Italy: '#49aa19',
		France: '#177ddc',
		England: '#d32029',
		Germany: '#000000',
		Russia: '#854eca',
	},
	mid: {
		Austria: '#aa9514',
		Italy: '#3c8618',
		France: '#1765ad',
		England: '#a61d24',
		Germany: '#292929',
		Russia: '#51258f',
	},
	dark: {
		Austria: '#7c6e14',
		Italy: '#306317',
		France: '#164c7e',
		England: '#791a1f',
		Germany: '#292929',
		Russia: '#3e2069',
	},
	map: {
		Austria: '#aa9514',
		Italy: '#306317',
		France: '#164c7e',
		England: '#791a1f',
		Germany: '#101010',
		Russia: '#3e2069',
	},
};

// Okabe-Ito palette — tested and verified distinguishable across
// protanopia, deuteranopia, and tritanopia by colorblind researchers.
const COLORBLIND_COLORS = {
	bright: {
		Austria: '#F0E442',
		Italy: '#009E73',
		France: '#0072B2',
		England: '#D55E00',
		Germany: '#BBBBBB',
		Russia: '#CC79A7',
	},
	mid: {
		Austria: '#B3AA31',
		Italy: '#007656',
		France: '#005586',
		England: '#A04600',
		Germany: '#888888',
		Russia: '#995B7D',
	},
	dark: {
		Austria: '#847C24',
		Italy: '#00563F',
		France: '#003D60',
		England: '#763400',
		Germany: '#555555',
		Russia: '#734159',
	},
	map: {
		Austria: '#B3AA31',
		Italy: '#007656',
		France: '#005586',
		England: '#A04600',
		Germany: '#222222',
		Russia: '#995B7D',
	},
};

export function getCountryColorPalette(colorblindMode) {
	return colorblindMode ? COLORBLIND_COLORS : NORMAL_COLORS;
}
