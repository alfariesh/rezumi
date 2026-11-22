// Shipped component actions run against native/export/network boundaries; no real account or outbound sharing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const serverRequire = createRequire(new URL("../../server/package.json", import.meta.url));
const { transformSync } = createRequire(serverRequire.resolve("tsx"))("esbuild");
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const tag = (parts, ...values) => parts.reduce((text, part, index) => text + part + (values[index] ?? ""), "");
let hooks = [];
let cursor = 0;
const react = {
	createElement: element,
	useState(initial) {
		const index = cursor++;
		if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
		return [hooks[index], (value) => (hooks[index] = typeof value === "function" ? value(hooks[index]) : value)];
	},
	useRef(initial) {
		const [value] = react.useState(() => ({ current: initial }));
		return value;
	},
};
const calls = [];
const routes = {
	builder: (id, tab) => `/builder/${id}/${tab}`,
	application: (id, tab) => `/applications/${id}/${tab}`,
};
const router = { push: (href) => calls.push(href), back() {} };
const theme = {
	space: { s0: 2, s1: 4, s2: 8, s3: 12, s4: 16, s12: 48 },
	size: { sheetShare: 440 },
	radius: { rLg: 4 },
	colors: { ink: "#111", ink3: "#777", line: "#ddd" },
};
const ui = Object.fromEntries(
	[
		"Banner",
		"Button",
		"Card",
		"ChipInput",
		"ConfirmDialog",
		"Icon",
		"IconButton",
		"ListGroup",
		"ListRow",
		"SelectSheet",
		"Switch",
		"Text",
		"TextArea",
		"TextField",
		"Segmented",
		"Skeleton",
	].map((name) => [name, name]),
);
ui.useTheme = () => theme;
ui.showToast = (value) => calls.push(value);
ui.listItemMotion = () => ({});
ui.listLayout = {};
ui.useFirstAppearance = () => false;
ui.usePullRefresh = () => ({ refreshing: false, onRefresh: () => undefined });
const mocks = {
	react,
	"react-native": { View: "View", Pressable: "Pressable", ScrollView: "ScrollView" },
	"expo-router": { useRouter: () => router, Stack: { Screen: "StackScreen" } },
	"@lingui/react/macro": { useLingui: () => ({ t: tag }) },
	"@lingui/core/macro": { t: tag, plural: (value, forms) => forms.other.replace("#", String(value)) },
	"@/routes": { routes },
	"@/ui-legacy": ui,
	"@/ui": ui,
	"react-native-reanimated": {
		View: "Animated.View",
		useSharedValue: (initial) => ({ get: () => initial, set() {} }),
		useAnimatedStyle: () => ({}),
		withTiming: (value) => value,
		withSpring: (value) => value,
	},
};
function load(path, extra = {}) {
	const module = { exports: {} };
	const code = transformSync(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), {
		loader: path.endsWith(".tsx") ? "tsx" : "ts",
		format: "cjs",
		jsx: "transform",
	}).code;
	const dependencies = { ...mocks, ...extra };
	new Function("React", "require", "module", "exports", code)(
		react,
		(name) => {
			assert.ok(name in dependencies, `Missing boundary: ${name}`);
			return dependencies[name];
		},
		module,
		module.exports,
	);
	return module.exports;
}
const { safeFileName } = load("features/share/model.ts");
const exportedBytes = new Uint8Array([1, 2, 3]);
const translatedLetterWords = {
	greeting: (name) => `Liebe ${name},`,
	teamGreeting: "Liebes Team & Personal,",
	hiringTeam: "Personal + Team",
	signOff: "Mit freundlichen Grüßen",
};
let exportPath;
const { exportFile } = load("features/share/files.ts", {
	"expo-file-system": {
		Directory: class {},
		File: class {
			async write(bytes) {
				assert.deepEqual(bytes, exportedBytes);
			}
		},
		Paths: {},
	},
	"expo-print": {},
	"expo-sharing": {},
	"@rezumi/resume/export-sections": {},
	"./letter": { letterWords: async () => translatedLetterWords },
	"./messages": {},
	"./model": { safeFileName },
	"@/preview/pipeline": {},
	"@/api/client": {
		client: { coverLetters: { getById: async () => ({ style: { metadata: { page: { locale: "de-DE" } } } }) } },
		rest: async (path) => {
			exportPath = new URL(path, "https://example.test");
			return { ok: true, arrayBuffer: async () => exportedBytes.buffer };
		},
	},
});
for (const format of ["docx", "odt", "md", "json"]) {
	await exportFile({ directory: {}, id: "letter-a", name: "Letter", format, letter: true });
	assert.equal(exportPath.pathname, `/cover-letters/letter-a/exports/${format}`);
	assert.deepEqual(
		Object.fromEntries(exportPath.searchParams),
		format === "json"
			? {}
			: {
					"words[greeting]": "Liebe {name},",
					"words[teamGreeting]": translatedLetterWords.teamGreeting,
					"words[hiringTeam]": translatedLetterWords.hiringTeam,
					"words[signOff]": translatedLetterWords.signOff,
				},
		"Localized letter exports must use OpenAPI object query parameters",
	);
}
// Download and Export are rebuilt on src/ui and tested with Jest (src/features/share/download.test.tsx).
// Applications (list, detail, workspace) are rebuilt on src/ui and tested with Jest (src/features/applications, src/features/workspace).
