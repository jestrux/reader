module.exports = {
	env: {
		es6: true,
		node: true,
	},
	parserOptions: {
		ecmaVersion: 2020,
	},
	extends: ["eslint:recommended", "google"],
	rules: {
		"require-jsdoc": "off",
		"comma-dangle": "off",
		"object-curly-spacing": "off",
		"quote-props": "off",
		indent: "off",
		"no-tabs": "off",
		"no-restricted-globals": ["error", "name", "length"],
		"prefer-arrow-callback": "error",
		quotes: ["error", "double", { allowTemplateLiterals: true }],
	},
	overrides: [
		{
			files: ["**/*.spec.*"],
			env: {
				mocha: true,
			},
			rules: {},
		},
	],
	globals: {},
};
