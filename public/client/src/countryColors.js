const NORMAL_COLORS = {
	bright: {
		Austria: '#d8bd14',
		Italy: '#49aa19',
		France: '#177ddc',
		England: '#d32029',
		Germany: '#000000',
		Russia: '#CC79A7',
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
// Kept bright to preserve the luminance contrast the palette relies on.
const COLORBLIND_COLORS = {
	bright: {
		Austria: '#F0E442',
		Italy: '#009E73',
		France: '#0072B2',
		England: '#D55E00',
		Germany: '#000000',
		Russia: '#CC79A7',
	},
	mid: {
		Austria: '#D4C93B',
		Italy: '#008C66',
		France: '#00669E',
		England: '#BE5300',
		Germany: '#292929',
		Russia: '#B0688F',
	},
	dark: {
		Austria: '#C4B232',
		Italy: '#007A59',
		France: '#005A8C',
		England: '#A84900',
		Germany: '#292929',
		Russia: '#995B7D',
	},
	map: {
		Austria: '#F0E442',
		Italy: '#009E73',
		France: '#0072B2',
		England: '#D55E00',
		Germany: '#101010',
		Russia: '#CC79A7',
	},
};

export function getCountryColorPalette(colorblindMode) {
	return colorblindMode ? COLORBLIND_COLORS : NORMAL_COLORS;
}
