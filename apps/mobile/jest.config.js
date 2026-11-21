// Component tests: jest-expo renders through the real React Native host components (React Native Testing Library).
// Plain logic belongs in workspace packages with Vitest (plans/mobile 02-teknis 9.1).
module.exports = {
	preset: "jest-expo",
	roots: ["<rootDir>/src", "<rootDir>/app"],
	testMatch: ["**/*.test.{ts,tsx}"],
	// Some dependencies (oRPC) ship only `.mjs`; the preset transforms `.js`/`.ts` alone.
	transform: { "\\.mjs$": "babel-jest" },
	moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
	// pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>; transform the React Native ones.
	transformIgnorePatterns: [
		"node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@rezumi/.*|@orpc/.*|heroui-native.*|@tanstack/.*))",
	],
};
