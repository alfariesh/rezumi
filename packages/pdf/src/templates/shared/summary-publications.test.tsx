import type { HostElement, HostNode } from "../../forme/reconciler";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { describe, expect, it } from "vite-plus/test";
import { createElement } from "react";
import { entryHeaderOf } from "@rezumi/schema/resume/data";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import { ResumeDocument } from "../../document";
import { renderHostTree } from "../../forme/reconciler";
import { flattenStyle } from "../../forme/style";

/** Two opt-in looks of the shared sections: Aksara's standfirst summary and Cendekia's numbered publications. */

const isElement = (node: HostNode): node is HostElement => !("text" in node);
const textOf = (node: HostNode): string => (isElement(node) ? node.children.map(textOf).join("") : node.text);
const elements = (nodes: HostNode[]): HostElement[] =>
	nodes.filter(isElement).flatMap((node) => [node, ...elements(node.children)]);
const styleOf = (node: HostElement | undefined) =>
	flattenStyle(node?.props.style as Parameters<typeof flattenStyle>[0]) as Record<string, unknown>;

const render = (template: Template, change?: (data: ResumeData) => void) => {
	const data = structuredClone(sampleResumeData);
	data.metadata.template = template;
	change?.(data);
	return { data, nodes: elements(renderHostTree(createElement(ResumeDocument, { data, template }))) };
};

/** The innermost element that holds the whole of `text` and sets its size: the paragraph, not a run inside it. */
const holding = (nodes: HostElement[], text: string) =>
	nodes.filter((node) => textOf(node).includes(text) && styleOf(node).fontSize !== undefined).at(-1);

describe("Aksara's summary", () => {
	const lead = "creating engaging gameplay systems";

	it("reads as a standfirst: larger than the body and in the muted ink", () => {
		const { data, nodes } = render("aksara");
		const summary = styleOf(holding(nodes, lead));
		const body = styleOf(holding(nodes, "Concentration in Game Development"));

		expect(summary.fontSize).toBeCloseTo(data.metadata.typography.body.fontSize * 1.15);
		expect(summary.color).not.toBe(body.color);
	});

	it("leaves other templates' summary at the body size", () => {
		const { data, nodes } = render("meridian");

		expect(styleOf(holding(nodes, lead)).fontSize).toBe(data.metadata.typography.body.fontSize);
	});
});

describe("Cendekia's publications", () => {
	const numbers = (nodes: HostElement[]) =>
		nodes.filter((node) => /^\d+\.$/.test(textOf(node)) && node.children.every((child) => !isElement(child)));
	const titles = sampleResumeData.sections.publications.items.map((item) => item.title);

	it("are numbered, each number read before its title", () => {
		const { nodes } = render("cendekia");
		const found = numbers(nodes);

		expect(found.map(textOf)).toEqual(["1.", "2."]);
		const order = nodes.map(textOf);
		for (const [index, title] of titles.entries()) {
			const number = order.findIndex((text) => text === `${index + 1}.`);
			expect(number).toBeGreaterThan(-1);
			expect(number).toBeLessThan(order.findIndex((text) => text === title));
		}
	});

	it("hang from their number whatever the entry layout", () => {
		const { nodes } = render("cendekia", (data) => {
			data.metadata.design.entry = { ...entryHeaderOf(data.metadata.design), layout: "stacked" };
		});

		expect(numbers(nodes).map(textOf)).toEqual(["1.", "2."]);
	});

	it("stay unnumbered in other templates", () => {
		expect(numbers(render("meridian").nodes)).toEqual([]);
	});
});
