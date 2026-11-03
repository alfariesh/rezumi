/**
 * Renders resume templates with the sample resume to PDF files, for checking template designs by eye.
 *
 *   pnpm --filter @rezumi/tooling templates:preview --out <dir> [templates…]
 *
 * Each template gets its preset look (`templatePresets`) unless `--no-preset` is passed. Options: `--photo` adds the
 * sample picture, `--locale id-ID` prints Indonesian section titles, `--set path=json`
 * overrides one value of the resume (`--set metadata.design.colors.primary='"rgba(0,0,0,1)"'`), and `--overrides file.json`
 * applies a JSON object of such paths and values.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createResumePdfFile } from "@rezumi/pdf/server";
import { createSampleResumeData } from "@rezumi/schema/resume/sample";
import { templateSchema } from "@rezumi/schema/templates";
import { applyTemplatePreset } from "./presets";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: "string", default: "." },
		photo: { type: "boolean", default: false },
		locale: { type: "string" },
		set: { type: "string", multiple: true, default: [] },
		overrides: { type: "string" },
		suffix: { type: "string", default: "" },
		"no-preset": { type: "boolean", default: false },
	},
});

const templates = positionals.length > 0 ? positionals.map((id) => templateSchema.parse(id)) : templateSchema.options;
const picture = values.photo
	? `data:image/jpeg;base64,${(await readFile(resolve(import.meta.dirname, "../../apps/web/public/photos/sample-picture.jpg"))).toString("base64")}`
	: "";

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
	const keys = path.split(".");
	const last = keys.pop();
	if (!last) return;
	let node: Record<string, unknown> = target;
	for (const key of keys) node = node[key] as Record<string, unknown>;
	node[last] = value;
}

for (const template of templates) {
	const data = structuredClone(createSampleResumeData());
	data.metadata.template = template;
	data.picture.url = picture;
	data.picture.hidden = !values.photo;
	if (values.locale) data.metadata.page.locale = values.locale;
	if (!values["no-preset"]) applyTemplatePreset(data, template);
	if (values.overrides) {
		const overrides = JSON.parse(await readFile(values.overrides, "utf8")) as Record<string, unknown>;
		for (const [path, value] of Object.entries(overrides))
			setPath(data as unknown as Record<string, unknown>, path, value);
	}
	for (const assignment of values.set) {
		const [path = "", ...rest] = assignment.split("=");
		setPath(data as unknown as Record<string, unknown>, path, JSON.parse(rest.join("=")));
	}

	const started = performance.now();
	const file = await createResumePdfFile({ data, filename: `${template}.pdf` });
	const target = join(values.out, `${template}${values.suffix}.pdf`);
	await writeFile(target, Buffer.from(await file.arrayBuffer()));
	console.log(`${target} (${Math.round(performance.now() - started)} ms)`);
}
