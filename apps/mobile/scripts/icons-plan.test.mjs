// Design → Icons and the plan: tool logos need `brandLogos` to be switched on. Android shows the switch locked,
// iOS leaves it out, and a resume that already shows logos keeps its switch on every platform.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const mobile = fileURLToPath(new URL("../", import.meta.url));
const server = createRequire(new URL("../../server/package.json", import.meta.url));
const { build } = createRequire(server.resolve("tsx"))("esbuild");

const env = { os: "android", plan: undefined, alerts: [] };
globalThis.__iconsPlanCheck = env;

const tag = `(parts,...values)=>parts.reduce((text,part,index)=>text+part+(values[index]??''),'')`;
const mocks = {
	react: `export const useState=(initial)=>[typeof initial==="function"?initial():initial,()=>{}];`,
	"react/jsx-runtime": `export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
	"react-native": `export const View='View',Pressable='Pressable',TextInput='TextInput';`,
	"react-native-reanimated": `export default {View:'Animated.View'};`,
	"@lingui/core/macro": `export const msg=(parts)=>({id:parts.join('')});`,
	"@lingui/react/macro": `export const useLingui=()=>({t:${tag}});`,
	"./controls": `export const Field='Field',Slider='Slider',SwitchRow='SwitchRow';`,
	"./presets": `export const ACCENTS=[],FONT_PAIRINGS=[],MIN_CONTRAST=0,TEXT_SIZE={};export const applyDensity=()=>{},applyFontPairing=()=>{},applyMargins=()=>{},applyTextSize=()=>{},contrastOver=()=>0,darkenForWhite=(c)=>c,hexToRgba=(c)=>c,isValidHex=()=>true,matchDensity=()=>null,matchFontPairing=()=>null,matchMargins=()=>null,rgbaToHex=(c)=>c;`,
	"@/features/billing/plan": `const e=globalThis.__iconsPlanCheck;export const canShowPlans=()=>e.os==="android";export const usePlan=()=>e.plan;export const hasPlanFeature=(plan,feature)=>!plan?.enabled||plan.features[feature];export const showPlanAlert=(problem)=>e.alerts.push(problem);`,
	"@/features/settings/locale-names": `export const localeMap={};`,
	"@/ui": `export const Button='Button',Icon='Icon',IconButton='IconButton',Segmented='Segmented',Text='Text';export const haptics={selection:()=>{}};export const listLayout={};export const useTheme=()=>({space:{s0:2,s1:4,s2:8,s3:12,s4:16}});`,
};

const result = await build({
	entryPoints: [`${mobile}src/features/design/style-groups.tsx`],
	absWorkingDir: mobile,
	jsx: "automatic",
	bundle: true,
	platform: "node",
	format: "esm",
	write: false,
	logLevel: "silent",
	plugins: [
		{
			name: "native-boundaries",
			setup(build) {
				build.onResolve({ filter: /.*/ }, ({ path }) => (path in mocks ? { path, namespace: "mock" } : undefined));
				build.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
			},
		},
	],
});
const temporary = await mkdtemp(join(tmpdir(), "rr-icons-plan-"));
const bundle = join(temporary, "check.mjs");
await writeFile(bundle, result.outputFiles[0].text);
const { IconsGroup } = await import(pathToFileURL(bundle).href);
await rm(temporary, { recursive: true });

const summary = (brandLogos) => ({ enabled: true, features: { brandLogos } });

/** The switch rows Design → Icons draws for a resume whose logos are `logos`, and what each one wrote. */
function render({ os, plan, logos }) {
	env.os = os;
	env.plan = plan;
	env.alerts = [];
	const writes = [];
	const data = { metadata: { design: { icons: { logos } } } };
	const tree = IconsGroup({ data, write: (key) => writes.push(key), disabled: false, pick: () => {} });
	const rows = [];
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		if (node.type === "SwitchRow") rows.push(node.props);
		for (const child of [node.props?.children].flat(Infinity)) walk(child);
	};
	walk(tree);
	return { rows, writes, logosRow: rows.find((row) => row.label.startsWith("Tool logos")) };
}

test("Android shows tool logos locked and labelled on a plan without them, and explains instead of switching", () => {
	const { logosRow, writes } = render({ os: "android", plan: summary(false), logos: false });
	assert.ok(logosRow);
	assert.equal(logosRow.locked, true);
	assert.equal(logosRow.label, "Tool logos in skills · Plus");
	assert.equal(logosRow.value, false);
	logosRow.onChange(true);
	assert.deepEqual(env.alerts, [{ kind: "feature", feature: "brandLogos" }]);
	assert.deepEqual(writes, []);
});

test("iOS leaves the locked switch out and names no plan", () => {
	const { rows, logosRow } = render({ os: "ios", plan: summary(false), logos: false });
	assert.equal(logosRow, undefined);
	assert.equal(rows.length, 4);
	for (const row of rows) assert.doesNotMatch(row.label, /Plus|Pro AI|plan/i);
});

test("a resume that already shows tool logos keeps an open switch to turn them off", () => {
	for (const os of ["android", "ios"]) {
		const { logosRow, writes } = render({ os, plan: summary(false), logos: true });
		assert.ok(logosRow, os);
		assert.equal(logosRow.locked, false);
		assert.equal(logosRow.label, "Tool logos in skills");
		logosRow.onChange(false);
		assert.deepEqual(writes, ["icons.logos"]);
		assert.deepEqual(env.alerts, []);
	}
});

test("plans with tool logos, or no plans at all, open the switch", () => {
	for (const plan of [summary(true), undefined, { enabled: false, features: { brandLogos: false } }]) {
		for (const os of ["android", "ios"]) {
			const { logosRow, writes } = render({ os, plan, logos: false });
			assert.equal(logosRow?.locked, false);
			logosRow.onChange(true);
			assert.deepEqual(writes, ["icons.logos"]);
		}
	}
});
