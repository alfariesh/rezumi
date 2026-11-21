// Native modules without a JavaScript fallback, replaced by their published mocks for component tests.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => {
	const mock = require("react-native-reanimated/mock");
	// The published mock's shared values lack `modify`, which HeroUI's toast uses.
	const useSharedValue = (initial) => {
		const shared = mock.useSharedValue(initial);
		return new Proxy(shared, {
			get: (target, key) =>
				key === "modify" ? (update) => target.set((value) => update(value)) : Reflect.get(target, key),
		});
	};
	return { ...mock, useSharedValue, default: { ...mock.default, useSharedValue } };
});
// jest-expo resolves Reanimated's `.native` sources, whose start-up registers CSS animation handlers that the
// JavaScript implementation used under Jest does not have. Component tests need no CSS animations.
jest.mock(require.resolve("react-native-reanimated/src/css/native/proxy"), () => {
	const actual = jest.requireActual(require.resolve("react-native-reanimated/src/css/native/proxy"));
	return Object.fromEntries(Object.keys(actual).map((name) => [name, () => undefined]));
});
require("react-native-gesture-handler/jestSetup");
jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));

// Uniwind reads theme variables from the compiled global.css, which Jest does not build: its "variable not found"
// warnings are expected here and hide real ones.
const warn = console.warn;
console.warn = (...args) => {
	if (typeof args[0] === "string" && args[0].startsWith("Uniwind - ")) return;
	warn(...args);
};

// expo-sqlite's key-value store needs the native database; the theme, haptics and motion settings read it on import.
jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map();
	return {
		__esModule: true,
		default: {
			getItemSync: (key) => store.get(key) ?? null,
			setItemSync: (key, value) => void store.set(key, value),
			removeItemSync: (key) => void store.delete(key),
		},
	};
});

// HeroUI's color helpers log when they cannot read the compiled theme (Jest has none).
const error = console.error;
console.error = (...args) => {
	if (typeof args[0] === "string" && args[0].startsWith("[colorKit")) return;
	error(...args);
};
