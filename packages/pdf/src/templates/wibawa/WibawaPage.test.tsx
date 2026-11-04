import type { HostElement, HostNode } from "../../forme/reconciler";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import { createElement } from "react";
import { iconDesignOf } from "@rezumi/schema/resume/data";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { ResumeDocument } from "../../document";
import { loadRequestedIcons } from "../../forme/icons";
import { HOST } from "../../forme/primitives";
import { renderHostTree } from "../../forme/reconciler";
import { flattenStyle } from "../../forme/style";

const isElement = (node: HostNode): node is HostElement => !("text" in node);
const textOf = (node: HostNode): string => (isElement(node) ? node.children.map(textOf).join("") : node.text);
const elements = (nodes: HostNode[]): HostElement[] =>
	nodes.filter(isElement).flatMap((node) => [node, ...elements(node.children)]);

/** The header line of a personal detail: the row whose children include the detail's label. */
async function detailRow(template: Template, label: string, change?: (data: ResumeData) => void) {
	const data = structuredClone(sampleResumeData);
	data.metadata.template = template;
	data.basics.customFields = [
		{ id: "birth", icon: "calendar-03", label: "Date of birth", text: "1 May 1990", link: "" },
		{ id: "status", icon: "", label: "Marital status", text: "Single", link: "" },
	];
	change?.(data);
	const element = createElement(ResumeDocument, { data, template });
	// Icons load on first use: the tree is drawn again once they arrive, as the web page does.
	let tree = renderHostTree(element);
	if (await loadRequestedIcons()) tree = renderHostTree(element);
	const row = elements(tree).find((node) => node.children.some((child) => textOf(child) === `${label}:`));
	if (!row) throw new Error(`No row for ${label}.`);
	return row.children.filter(isElement);
}

const sizeOf = (node: HostElement | undefined) => {
	if (node?.type === HOST.svg) return node.props.width;
	const style = flattenStyle(node?.props.style as Parameters<typeof flattenStyle>[0]) as Record<string, unknown>;
	return style.width;
};

describe("Wibawa personal details", () => {
	it("keeps the icon's room on a detail without an icon, so its label lines up with the others", async () => {
		const [withIcon] = await detailRow("wibawa", "Date of birth");
		const [room, label] = await detailRow("wibawa", "Marital status");

		expect(withIcon?.type).toBe(HOST.svg);
		expect(room?.type).toBe(HOST.view);
		expect(room?.children).toHaveLength(0);
		expect(sizeOf(room)).toBe(sizeOf(withIcon));
		expect(textOf(label ?? { type: "#text", text: "" })).toBe("Marital status:");
	});

	it("keeps no room when contact icons are off", async () => {
		const [first] = await detailRow("wibawa", "Marital status", (data) => {
			data.metadata.design.icons = { ...iconDesignOf(data.metadata.design), contact: false };
		});

		expect(first?.type).toBe(HOST.text);
	});

	it("leaves templates without the flag as they were", async () => {
		const [first] = await detailRow("meridian", "Marital status");

		expect(first?.type).toBe(HOST.text);
	});
});
