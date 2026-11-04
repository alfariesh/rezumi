import type { TemplateSemanticManifest } from "./template-manifest";
import type { SemanticNode } from "@rezumi/resume/stylesheet/types";
import type { ResumeData } from "@rezumi/schema/resume/data";
import type { Template } from "@rezumi/schema/templates";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { templateSchema } from "@rezumi/schema/templates";
import { baseManifest } from "./shared-parts";
import { getTemplateSemanticManifest } from "./template-manifest";
import { buildSemanticTree } from "./tree";

// No template in the lineup draws its summary in a featured region or in the header, or keeps its contacts in
// owner-specific hosts. The tree still builds all three for Semantic CSS (`region[region="featured"]`, the
// `featured-summary` role, `contact-item` parts), so these tests give one lineup ID a manifest that does.
let manifestStandIn: TemplateSemanticManifest | undefined;

vi.mock("./template-manifest", async (importOriginal) => {
	const original = await importOriginal<typeof import("./template-manifest")>();
	return {
		...original,
		getTemplateSemanticManifest: (template: Template) =>
			manifestStandIn?.template === template ? manifestStandIn : original.getTemplateSemanticManifest(template),
	};
});

afterEach(() => {
	manifestStandIn = undefined;
});

const view = { type: "primitive", primitive: "View", source: "existing" } as const;

/** The first-page summary leaves `main` for a `featured` region while the header shows. */
const featuredSummaryManifest = {
	template: "kirana",
	regions: [
		{ name: "header", placement: "main", origins: [] },
		{ name: "featured", placement: "main", origins: [] },
		{ name: "main", placement: "main", origins: ["main"] },
		{ name: "sidebar", placement: "sidebar", origins: ["sidebar"] },
	],
	header: { region: "header", placement: "main" },
	specialSummary: { region: "featured", placement: "main", source: "main-with-header" },
	parts: [
		{
			name: "featured-summary",
			key: "featured-summary",
			owner: { kind: "region", key: "featured" },
			binding: view,
			route: { parent: "owner", at: "start", take: "all" },
		},
	],
} as const satisfies TemplateSemanticManifest;

/** The summary always prints inside the header, between the headline and the contacts. */
const headerSummaryManifest = {
	template: "kirana",
	regions: [
		{ name: "header", placement: "main", origins: [] },
		{ name: "main", placement: "main", origins: ["main"] },
		{ name: "sidebar", placement: "sidebar", origins: ["sidebar"] },
	],
	header: { region: "header", placement: "main" },
	specialSummary: { region: "header", placement: "main", source: "always" },
	parts: [
		{
			name: "header-intro",
			key: "header-intro",
			owner: { kind: "header", key: "header" },
			binding: view,
			route: {
				parent: "owner",
				at: "start",
				take: [{ kind: "picture" }, { kind: "name" }, { kind: "headline" }, { kind: "section", name: "summary" }],
			},
		},
	],
} as const satisfies TemplateSemanticManifest;

/** The last contact item carries a part alias, and each item wraps its text in a link-or-view host. */
const contactPartsManifest = baseManifest(
	"kirana",
	[
		{
			name: "contact-item-content",
			key: "contact-item-content",
			owner: { kind: "contact-item", key: "contact-item" },
			binding: {
				type: "primitive",
				primitive: { ownerRole: "structured-link", present: "Link", absent: "View" },
				source: "existing",
			},
			route: { parent: "owner", at: "start", take: "all" },
		},
		{
			name: "contact-item-last",
			key: "contact-item-last",
			owner: { kind: "contact-item", key: "contact-item", position: "last" },
			binding: { type: "alias", canonicalKind: "contact-item", token: "contact-item-last" },
		},
	],
	[{ kind: "contact-item", binding: view }],
) satisfies TemplateSemanticManifest;

const flattenTree = (node: SemanticNode): SemanticNode[] => [node, ...node.children.flatMap(flattenTree)];
const findNodes = (node: SemanticNode, predicate: (candidate: SemanticNode) => boolean): SemanticNode[] =>
	flattenTree(node).filter(predicate);

const buildFixture = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.picture.url = "/uploads/ada.png";
	data.basics = {
		name: "Ada Lovelace",
		headline: "Engineer",
		email: "ada@example.com",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	};
	data.summary.content = "<p>Summary</p>";
	// The one-line entry header brings its parts into the tree, so every manifest part shows up.
	data.metadata.design.entry = { layout: "inline", lead: "organization", accent: "none" };
	data.sections.education.items = [
		{
			id: "education/1",
			hidden: false,
			school: "Cambridge",
			area: "Mathematics",
			degree: "BSc",
			grade: "First",
			location: "Cambridge",
			period: "1835",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	];
	data.sections.experience.columns = 1;
	data.sections.experience.items = [
		{
			id: "experience/1",
			hidden: false,
			company: "Analytical Engines",
			position: "Engineer",
			location: "London",
			period: "1842",
			website: { url: "", label: "", inlineLink: false },
			description: "<p>Built algorithms.</p>",
			roles: [],
		},
	];
	data.sections.projects.items = [
		{
			id: "projects/1",
			hidden: false,
			name: "Analytical Engine",
			period: "1843",
			website: { url: "https://project.example.com", label: "Project", inlineLink: true },
			description: "<p>Wrote the first program.</p>",
		},
	];
	data.sections.skills.items = [
		{
			id: "skills/1",
			hidden: false,
			icon: "code",
			iconColor: "",
			name: "TypeScript",
			proficiency: "Expert",
			level: 4,
			keywords: ["PDF"],
		},
	];

	return data;
};

const buildFixtureTree = (template: Template, showHeader = true, adjust?: (data: ResumeData) => void): SemanticNode => {
	const data = buildFixture();
	adjust?.(data);
	const page = { fullWidth: false, main: ["summary", "experience", "education", "projects"], sidebar: ["skills"] };

	return buildSemanticTree({ data, template, page, pageNumber: 1, showHeader });
};

describe("template semantic manifests", () => {
	it.each(templateSchema.options)("%s builds its manifest-backed tree without key collisions", (template) => {
		const tree = buildFixtureTree(template);
		const nodes = flattenTree(tree);
		const partNames = new Set(
			findNodes(tree, (node) => node.kind === "template-part").map((node) => node.attributes.name),
		);
		const expectedPrimitiveParts = new Set(
			getTemplateSemanticManifest(template).parts.flatMap((part) =>
				part.binding.type === "primitive" ? [part.name] : [],
			),
		);

		expect(partNames).toEqual(expectedPrimitiveParts);
		expect(new Set(nodes.map((node) => node.key)).size).toBe(nodes.length);
	});

	it("moves the first-page summary into its featured region", () => {
		manifestStandIn = featuredSummaryManifest;
		const tree = buildFixtureTree("kirana");
		const featured = findNodes(tree, (node) => node.kind === "region" && node.attributes.region === "featured")[0];
		const summaries = findNodes(tree, (node) => node.kind === "section" && node.id === "summary");

		expect(featured && findNodes(featured, (node) => node.kind === "section" && node.id === "summary")).toHaveLength(1);
		expect(summaries).toHaveLength(1);
		expect(summaries[0]?.roles).toContain("featured-summary");
		expect(
			findNodes(tree, (node) => node.kind === "template-part" && node.attributes.name === "featured-summary"),
		).toHaveLength(1);
	});

	it("places the summary in the header only while the renderer shows that header", () => {
		manifestStandIn = headerSummaryManifest;
		const withHeader = buildFixtureTree("kirana", true);
		const withoutHeader = buildFixtureTree("kirana", false);
		const headerRegion = findNodes(
			withHeader,
			(node) => node.kind === "region" && node.attributes.region === "header",
		)[0];

		expect(
			headerRegion && findNodes(headerRegion, (node) => node.kind === "section" && node.id === "summary"),
		).toHaveLength(1);
		expect(findNodes(withHeader, (node) => node.kind === "section" && node.id === "summary")).toHaveLength(1);
		expect(findNodes(withoutHeader, (node) => node.kind === "section" && node.id === "summary")).toHaveLength(0);
	});

	it("leaves summary in main when featured chrome is absent", () => {
		manifestStandIn = featuredSummaryManifest;
		const tree = buildFixtureTree("kirana", false);
		const summary = findNodes(tree, (node) => node.kind === "section" && node.id === "summary");

		expect(findNodes(tree, (node) => node.kind === "region" && node.attributes.region === "featured")).toHaveLength(0);
		expect(summary).toHaveLength(1);
		expect(summary[0]?.attributes).toMatchObject({ origin: "main", placement: "main" });
		expect(summary[0]?.roles).not.toContain("featured-summary");
	});

	it("builds owner-specific contact parts and a last-item alias", () => {
		manifestStandIn = contactPartsManifest;
		const tree = buildFixtureTree("kirana", true, (data) => {
			data.basics.phone = "+44 123";
			data.basics.location = "London";
		});
		const contacts = findNodes(tree, (node) => node.kind === "contact-item");
		const contents = findNodes(
			tree,
			(node) => node.kind === "template-part" && node.attributes.name === "contact-item-content",
		);

		expect(contacts.length).toBeGreaterThan(1);
		expect(contents).toHaveLength(contacts.length);
		expect(contacts.filter((node) => node.attributes.part?.split(" ").includes("contact-item-last"))).toEqual([
			contacts.at(-1),
		]);
		expect(new Set(flattenTree(tree).map((node) => node.key)).size).toBe(flattenTree(tree).length);
	});
});
