import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import { createCanvas } from "@napi-rs/canvas";
import { act, createElement } from "react";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { ResumeDocument } from "../../document";
import { renderToBuffer } from "../../forme/testing";
import { rasterizePdf } from "../../semantic/test/rasterize-pdf";

const source = createCanvas(100, 100);
const context = source.getContext("2d");
context.fillStyle = "#00aa00";
context.fillRect(0, 0, 100, 100);

async function picturePixels(template: Template, borderWidth: number, shadowWidth = 0) {
	const data = structuredClone(defaultResumeData);
	// Page, accent and type are fixed here so the pixel counts below only move with the template.
	data.metadata.template = template;
	data.metadata.page = { ...data.metadata.page, marginX: 14, marginY: 12 };
	// Blue pixels count as shadow below, so the accent stays red.
	data.metadata.design.colors.primary = "rgba(220, 38, 38, 1)";
	data.metadata.typography.body = {
		fontFamily: "Helvetica",
		fontWeights: ["400", "500"],
		fontSize: 10,
		lineHeight: 1.5,
	};
	data.metadata.typography.heading = { fontFamily: "Helvetica", fontWeights: ["600"], fontSize: 14, lineHeight: 1.5 };
	data.basics.name = "Picture";
	data.metadata.stylesheet = { mode: "semantic", source: { languageVersion: 1, text: "@version 1;" } };
	data.metadata.layout.pages = [{ fullWidth: false, main: [], sidebar: [] }];
	Object.assign(data.picture, {
		url: source.toDataURL("image/png"),
		hidden: false,
		size: 100,
		borderRadius: 0,
		borderColor: "rgba(255, 0, 255, 1)",
		borderWidth,
		shadowWidth,
		shadowColor: "rgba(0, 0, 255, 1)",
	});
	const element = createElement(ResumeDocument, { data, template }) as unknown as Parameters<typeof renderToBuffer>[0];
	let bytes = new Uint8Array();
	await act(async () => {
		bytes = new Uint8Array(await renderToBuffer(element));
	});
	const [page] = await rasterizePdf(bytes);
	if (!page) throw new Error("Missing rendered page");
	let borderPixels = 0;
	let imagePixels = 0;
	let shadowPixels = 0;
	const positions: { x: number; y: number }[] = [];
	for (let index = 0; index < page.data.length; index += 4) {
		if (
			(page.data[index + 2] ?? 0) > (page.data[index] ?? 0) + 5 &&
			(page.data[index + 2] ?? 0) > (page.data[index + 1] ?? 0) + 5
		)
			shadowPixels++;
		if (page.data[index] === 255 && page.data[index + 1] === 0 && page.data[index + 2] === 255) borderPixels++;
		if (
			(page.data[index + 1] ?? 0) > (page.data[index] ?? 0) + 5 &&
			(page.data[index + 1] ?? 0) > (page.data[index + 2] ?? 0) + 5
		)
			imagePixels++;
		if (
			(page.data[index] === 255 && page.data[index + 1] === 0 && page.data[index + 2] === 255) ||
			((page.data[index + 1] ?? 0) > (page.data[index] ?? 0) + 5 &&
				(page.data[index + 1] ?? 0) > (page.data[index + 2] ?? 0) + 5)
		)
			positions.push({ x: (index / 4) % page.width, y: Math.floor(index / 4 / page.width) });
	}
	const bounds = {
		left: Math.min(...positions.map(({ x }) => x)),
		right: Math.max(...positions.map(({ x }) => x)),
		top: Math.min(...positions.map(({ y }) => y)),
		bottom: Math.max(...positions.map(({ y }) => y)),
	};
	return { borderPixels, imagePixels, shadowPixels, bounds };
}

// Meridian is the one-column default; Horizon and Kirana hold the picture in a band and in a sidebar.
describe.each(["meridian", "horizon", "kirana"] as const)("picture border visibility (#3017) in %s", (template) => {
	it("draws a border and a soft centered shadow without moving the photo", { timeout: 60_000 }, async () => {
		const plain = await picturePixels(template, 0);
		const bordered = await picturePixels(template, 10);
		expect(plain.borderPixels).toBe(0);
		expect(bordered.borderPixels).toBeGreaterThan(1000);
		expect(bordered.imagePixels).toBeGreaterThan(1000);
		expect(bordered.imagePixels).toBeLessThan(plain.imagePixels);
		// Rasterized border/image edges can differ by one antialiased pixel.
		for (const edge of ["left", "right", "top", "bottom"] as const)
			expect(Math.abs(bordered.bounds[edge] - plain.bounds[edge])).toBeLessThanOrEqual(1);
		const shadow = await picturePixels(template, 0, 10);
		expect(plain.shadowPixels).toBe(0);
		expect(shadow.shadowPixels).toBeGreaterThan(100);
		expect(shadow.bounds).toEqual(plain.bounds);
		expect(shadow.imagePixels).toBe(plain.imagePixels);
	});
});
