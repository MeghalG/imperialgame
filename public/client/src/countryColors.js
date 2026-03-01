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
};

const COLORBLIND_COLORS = {
	bright: {
		Austria: '#FFB000',
		Italy: '#00B4D8',
		France: '#648FFF',
		England: '#FE6100',
		Germany: '#CCCCCC',
		Russia: '#DC267F',
	},
	mid: {
		Austria: '#CC8D00',
		Italy: '#008DA8',
		France: '#4C6FC0',
		England: '#C94D00',
		Germany: '#888888',
		Russia: '#A81D60',
	},
	dark: {
		Austria: '#996A00',
		Italy: '#006878',
		France: '#365090',
		England: '#943800',
		Germany: '#555555',
		Russia: '#781545',
	},
};

export function getCountryColorPalette(colorblindMode) {
	return colorblindMode ? COLORBLIND_COLORS : NORMAL_COLORS;
}
