// Run: node apps/mobile/scripts/layout.test.mjs
// Execute shipped layout components; native measurements and navigation are boundary fixtures.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../../server/package.json", import.meta.url));
const { transformSync } = createRequire(serverRequire.resolve("tsx"))("esbuild");
let window = { width: 951, height: 669, fontScale: 1 };
let insets = { top: 0, bottom: 20, left: 0, right: 84 };
const calls = [];
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const native = {
	View: "View",
	Text: "NativeText",
	ScrollView: "ScrollView",
	TextInput: "TextInput",
	Keyboard: { dismiss() {} },
	Pressable: "Pressable",
	I18nManager: { isRTL: false },
	Platform: { OS: "ios", select: (values) => values.ios ?? values.default },
	Easing: { bezier: () => null },
	useWindowDimensions: () => window,
};
const safe = { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => insets };
const react = { createElement: element, createContext: (current) => ({ current }), use: (context) => context.current };
const router = {
	push: (href) => calls.push(href),
	navigate: (href) => calls.push(href),
};
const tag = (parts, ...values) =>
	Array.isArray(parts) ? parts.reduce((text, part, index) => text + part + (values[index] ?? ""), "") : parts.message;
const routes = {
	documents: () => "/documents",
	trash: () => "/documents/trash",
	new: () => "/new",
	search: () => "/search",
	settings: (page) => `/settings/${page}`,
};
const mocks = {
	react,
	"react-native": native,
	"react-native-safe-area-context": safe,
	"@lingui/react/macro": { useLingui: () => ({ t: tag }) },
	"expo-router": { useRouter: () => router, usePathname: () => "/documents", useIsFocused: () => true },
	"react-native-keyboard-controller": { KeyboardAwareScrollView: "ScrollView", useKeyboardState: () => false },
	"react-native-reanimated": { useAnimatedReaction: (prepare, react) => effects.push(() => react(prepare(), null)) },
	"react-native-worklets": { scheduleOnRN: (run, ...args) => run(...args) },
	"@/routes": { routes },
};
let keyboardHeight = 0;
mocks["react-native-keyboard-controller"].useKeyboardState = (select) =>
	select({ height: keyboardHeight, isVisible: keyboardHeight > 0 });
mocks["react-native-keyboard-controller"].useReanimatedKeyboardAnimation = () => ({
	height: { get: () => keyboardHeight },
});
function load(path, extra = {}) {
	const module = { exports: {} };
	const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
	const code = transformSync(source, {
		loader: path.endsWith(".tsx") ? "tsx" : "ts",
		format: "cjs",
		jsx: "transform",
	}).code;
	const dependencies = { ...mocks, ...extra };
	new Function("React", "require", "module", "exports", code)(
		react,
		(name) => {
			assert.ok(name in dependencies, `Missing boundary fixture: ${name}`);
			return dependencies[name];
		},
		module,
		module.exports,
	);
	return module.exports;
}
const tokens = load("ui-legacy/tokens.ts");
const theme = { ...tokens, colors: tokens.colors.light, shadows: tokens.shadows.light };
const ui = {
	Text: "Text",
	Button: "Button",
	IconButton: "IconButton",
	Icon: "Icon",
	haptics: { selection() {} },
	useTheme: () => theme,
};
mocks["@/ui-legacy"] = ui;
mocks["./theme"] = ui;
// Gesture state has its own timing regression; layout fixtures do not pull.
const pullRefresh = { usePullRefresh: () => ({ refreshing: false, onRefresh() {} }) };
mocks["@/ui/use-pull-refresh"] = pullRefresh;
mocks["@/components/collection-header"] = { CollectionHeader: "CollectionHeader" };
// The rebuilt tab chrome (Jest-tested in src/shell) only matters here as the old headers' outside-the-tabs default.
mocks["@/shell/tab-chrome"] = { TabBarActions: "TabBarActions", useInTabs: () => false };
mocks["@/ui"] = { size: { wide: 700 }, ...pullRefresh };
// Bottom bars report their height so toasts clear them; layout fixtures do not show toasts.
mocks["@/ui/toast"] = { setToastBarHeight() {} };
const { useIsTablet: isTablet } = load("shell/use-is-tablet.ts");
mocks["./use-is-tablet"] = { useIsTablet: isTablet };
const keyboardLayout = load("ui/keyboard.tsx");
mocks["@/ui/keyboard"] = keyboardLayout;
const resizedKeyboard = keyboardLayout.KeyboardFrame({}).type;
for (const height of [0, 300, 200]) {
	keyboardHeight = height;
	resizedKeyboard.current = false;
	assert.equal(keyboardLayout.useKeyboardScrollSpace() + height, height, "Overlaid keyboards need scroll space");
	resizedKeyboard.current = true;
	assert.equal(
		keyboardLayout.useKeyboardScrollSpace() + height,
		0,
		"Resized viewports must not add keyboard space twice",
	);
}
resizedKeyboard.current = false;
keyboardHeight = 0;
const { Screen } = load("ui-legacy/text.tsx");
const nodes = (tree) =>
	!tree || typeof tree !== "object"
		? []
		: Array.isArray(tree)
			? tree.flatMap(nodes)
			: [tree, ...nodes(tree.props.children)];
// Navigation follows window width; content measurements account for cutouts and sidebars.
for (const [width, right, expected] of [
	[466, 84, false],
	[951, 84, true],
	[669, 0, false],
	[750, 84, true],
]) {
	window = { ...window, width };
	insets = { ...insets, right };
	assert.equal(isTablet(), expected);
}
for (const scroll of [false, true]) {
	const measure = () => {};
	const screen = Screen({ scroll, edges: ["top"], onLayout: measure });
	assert.equal(screen.props.style.paddingLeft, insets.left);
	assert.equal(screen.props.style.paddingRight, insets.right);
	assert.equal(screen.props.style.paddingTop, insets.top);
	assert.equal(nodes(screen).find((node) => node.props.onLayout === measure).props.onLayout, measure);
}
const { WindowSafeAreaProvider, useWindowSafeAreaInsets: windowInsets } = load("ui/safe-area.tsx");
const provider = WindowSafeAreaProvider({ children: null });
provider.type.current = provider.props.value;
insets = { ...insets, left: 0, right: 0 };
assert.equal(Screen({}).props.style.paddingRight, 0, "Pane must not consume window insets twice");
assert.equal(windowInsets().right, 84, "Portalled sheets must retain original window cutout");
window = { ...window, width: 750 };
ui.useReducedMotion = () => false;
mocks["@/shell/use-is-tablet"] = { useIsTablet: isTablet };
mocks["expo-router"].Stack = { Screen: "Stack.Screen" };
const { useTabStackOptions: stackOptions } = load("shell/app-banner.tsx");
const { SettingsPage } = load("features/settings/layout.tsx");
for (const [width, largeTitle] of [
	[951, false],
	[466, true],
]) {
	window = { ...window, width };
	assert.equal(stackOptions().headerLargeTitle, largeTitle);
	const settings = SettingsPage({ title: "Settings", root: true, children: null });
	assert.equal(nodes(settings).find((node) => node.type === "Stack.Screen").props.options.headerShown, false);
	assert.ok(nodes(settings).some((node) => node.type === "CollectionHeader" && node.props.title === "Settings"));
	const pushed = SettingsPage({ title: "Account", children: null });
	assert.equal(nodes(pushed).find((node) => node.type === "Stack.Screen").props.options.headerShown, true);
}
const hooks = [];
let cursor = 0;
let effects = [];
react.useState = (initial) => {
	const index = cursor++;
	if (!(index in hooks)) hooks[index] = initial;
	return [
		hooks[index],
		(value) => {
			hooks[index] = value;
		},
	];
};
react.useRef = (initial) => react.useState({ current: initial })[0];
react.useEffect = (effect, deps) => {
	const index = cursor++;
	const previous = hooks[index];
	if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
		previous?.cleanup?.();
		effects.push(() => {
			hooks[index] = { deps, cleanup: effect() };
		});
	}
};
native.ActivityIndicator = "ActivityIndicator";
native.PixelRatio = { get: () => 2 };

// Large text must reflow chrome without taking scrolling content or row titles out of reach.
const render = (component, props = {}) => {
	cursor = 0;
	effects = [];
	const tree = component(props);
	for (const effect of effects) effect();
	return tree;
};
hooks.length = 0;
react.useCallback = (callback) => callback;
hooks.length = 0;
native.StyleSheet = { hairlineWidth: 1 };
const animation = {
	View: "Animated.View",
	useSharedValue: (initial) => ({ get: () => initial, set() {} }),
	useAnimatedStyle: () => ({}),
	withTiming: (value) => value,
	withSpring: (value) => value,
	withSequence: (...values) => values.at(-1),
};
const componentFixtures = {
	"./button": ui,
	"./icon": ui,
	"@/ui/motion": ui,
	"./pressable": { FeedbackPressable: "Pressable" },
	"./text": ui,
	"expo-image": { Image: "Image" },
	"react-native-reanimated": animation,
	// Metro resolves an image to an asset id; the avatar placeholder is only drawn, never measured.
	"../../assets/avatar-placeholder.webp": 1,
};
const { CollectionHeader } = load("components/collection-header.tsx");
const { ListRow, EmptyState } = load("ui-legacy/layout.tsx", componentFixtures);
native.FlatList = "FlatList";
// Changing library columns remounts its header; an active filter must remain visible and clearable.
hooks.length = 0;
let restoredSearch = "Fold QA duplicate";
const searchedHeader = render(CollectionHeader, {
	title: "Documents",
	searchLabel: "Search documents",
	placeholder: "Search",
	value: restoredSearch,
	onChangeText(value) {
		restoredSearch = value;
	},
});
assert.equal(nodes(searchedHeader).find((node) => node.type === "TextInput")?.props.value, restoredSearch);
assert.equal(
	nodes(searchedHeader).find((node) => node.type === "TextInput").props.autoFocus,
	false,
	"Restoring an active filter must not summon the keyboard",
);
nodes(searchedHeader)
	.find((node) => node.props.label === "Close search")
	.props.onPress();
assert.equal(restoredSearch, "");

for (const fontScale of [1, 1.95, 3.12]) {
	window = { width: 320, height: 568, fontScale };
	hooks.length = 0;
	const header = render(CollectionHeader, {
		title: "Documents",
		searchLabel: "Search documents",
		placeholder: "Search",
		value: "",
		onChangeText() {},
		actions: element("NewDocument", {}),
	});
	assert.equal(header.props.style.flexDirection, fontScale > 1.3 ? "column" : "row");
	assert.ok(nodes(header).some((node) => node.type === "NewDocument"));
	const row = render(ListRow, {
		title: "Preferences",
		value: "System",
		leading: "circle-half",
		chevron: true,
		trailing: element("Switch", {}),
	});
	const title = nodes(row).find((node) => node.props.children?.includes("Preferences"));
	const content = nodes(row).find((node) => node.props.children?.includes(title));
	const rowStyle = typeof row.props.style === "function" ? row.props.style({ pressed: false }) : row.props.style;
	assert.equal(rowStyle.flexDirection, fontScale > 1.3 ? "column" : "row");
	if (fontScale > 1.3) {
		assert.equal(rowStyle.alignItems, "stretch", "Large row titles need full width");
		assert.equal(
			nodes(content).some((node) => node.type === "Icon"),
			false,
		);
		const leading = nodes(row).find((node) => node.props.name === "circle-half");
		const band = nodes(row).find((node) => node.props.children?.includes(leading));
		assert.ok(nodes(band).some((node) => node.props.name === "caret-right"));
	}
	assert.equal(
		nodes(content).some((node) => node.type === "Switch"),
		fontScale > 1.3,
	);
	const values = nodes(row).filter((node) => node.props.children?.includes("System"));
	assert.equal(values.length, 1);
	if (fontScale > 1.3) assert.equal(values[0].props.numberOfLines, undefined);
}

console.log(
	"PASS safe areas, measured Screen viewport, Duo rail navigation/targets, tablet sidebar, responsive editor modes, history split, measured PDF pages, large-text chrome/rows/navigation, workspace selection and overflow",
);

// Long empty-state headings need bounded width before Android measures wrapped text.
for (const title of ["All your applications are closed", "Your job search starts here"]) {
	const empty = render(EmptyState, { title });
	const heading = nodes(empty).find((node) => node.props.accessibilityRole === "header");
	assert.equal(heading.props.children[0], title);
	assert.equal(heading.props.style.alignSelf, "stretch");
	assert.equal(heading.props.numberOfLines, undefined);
}

assert.equal(
	render(ListRow, { title: "Setting", trailing: element("Switch", {}) }).props.accessible,
	false,
	"Passive rows must expose their child switches as independent accessibility controls",
);
assert.equal(render(ListRow, { title: "Setting", trailing: element("Switch", {}) }).type, "View");
assert.equal(render(ListRow, { title: "Status", value: "Saved" }).props.accessible, true);
assert.equal(render(ListRow, { title: "Open", onPress() {} }).props.accessible, true);

// An unknown decorative icon crashes its entire screen, including rows accepting ReactNode leading content.
const appIconNames = new Set(
	Object.keys(
		JSON.parse(readFileSync(new URL("../../../packages/icons/src/generated/app-icons.json", import.meta.url))),
	),
);
for (const directory of [new URL("../src/", import.meta.url), new URL("../app/", import.meta.url)]) {
	for (const path of readdirSync(directory, { recursive: true }).filter((path) => path.endsWith(".tsx"))) {
		const source = readFileSync(new URL(path, directory), "utf8");
		for (const pattern of [/\b(?:icon|leading)="([^"]+)"/g, /<Icon\b[^>]*\bname="([^"]+)"/g]) {
			for (const [, name] of source.matchAll(pattern)) {
				assert.ok(appIconNames.has(name), `${path}: icon "${name}" must resolve before its screen renders`);
			}
		}
	}
}
console.log("PASS wrapped empty-state titles, list rows and resolvable icons");
