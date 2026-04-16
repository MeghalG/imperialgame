import React from 'react';

const TurnControlContext = React.createContext({
	submitHandler: null,
	submitLabel: 'Submit',
	submitEnabled: false,
	submitting: false,
	previewText: '',
	registerSubmit: () => {},
	clearSubmit: () => {},
});

export default TurnControlContext;
