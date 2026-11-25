import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { checkPortfolio } from "./checkup";
import { testResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { buildPortfolioView } from "./view";

const image = (name: string, alt = "") => ({
	key: `uploads/user-1/pictures/portfolio/${name}.webp`,
	width: 1600,
	height: 1200,
	alt,
});

type WorkInput = NonNullable<NonNullable<PortfolioDataInput["works"]>["items"]>[number];

const work = (id: string, rest: Partial<WorkInput> = {}): WorkInput => ({
	id,
	slug: id,
	title: `Work ${id}`,
	summary: "What it was and what changed.",
	cover: image(`${id}-cover`, "The finished screen"),
	blocks: [{ id: `${id}-text`, type: "text", html: "<p>The story.</p>" }],
	...rest,
});

function check(input: PortfolioDataInput = {}, resume: ResumeData | null = testResume()) {
	const data = parseWritablePortfolioData(input);
	const view = buildPortfolioView({
		portfolio: { data },
		resume: resume ? { data: resume } : null,
		owner: { name: "", username: "nadia" },
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(portfolioMessages("en-US")),
		fileUrl: (key) => `https://rezumi.example/${key}`,
	});
	return checkPortfolio({ data, view });
}

const ids = (findings: ReturnType<typeof checkPortfolio>) => findings.map((finding) => finding.id);

describe("checkPortfolio", () => {
	it("finds nothing on a complete page", () => {
		expect(check({ hero: { greeting: "Hello." }, works: { items: [work("a")] } })).toEqual([]);
	});

	it("lists what an empty portfolio without a resume lacks, important first", () => {
		const findings = check({}, null);
		// The name falls back to the account's, so it is never the gap here.
		expect(ids(findings)).toEqual(["contact", "headline", "intro-text", "photo", "works"]);
		expect(findings.map((finding) => finding.level)).toEqual([
			"important",
			"suggestion",
			"suggestion",
			"suggestion",
			"suggestion",
		]);
	});

	it("names shown works without a title, which the page leaves out", () => {
		const findings = check({
			hero: { greeting: "Hello." },
			works: { items: [work("a"), work("b", { title: " " }), work("c", { title: "", hidden: true })] },
		});
		expect(findings).toEqual([{ id: "work-untitled", level: "important", workIds: ["b"], count: 1 }]);
	});

	it("doesn't ask for a first work while an untitled one waits", () => {
		const findings = check({ hero: { greeting: "Hello." }, works: { items: [work("a", { title: "" })] } });
		expect(ids(findings)).toEqual(["work-untitled"]);
	});

	it("points at works without a cover, a summary or blocks", () => {
		const findings = check({
			hero: { greeting: "Hello." },
			works: {
				items: [work("a", { cover: undefined }), work("b", { summary: "" }), work("c", { blocks: [] }), work("d")],
			},
		});
		expect(findings).toEqual([
			{ id: "work-cover", level: "suggestion", workIds: ["a"], count: 1 },
			{ id: "work-summary", level: "suggestion", workIds: ["b"], count: 1 },
			{ id: "work-empty", level: "suggestion", workIds: ["c"], count: 1 },
		]);
	});

	it("counts pictures without a description; a cover without one is read as the work's title", () => {
		const findings = check({
			hero: { greeting: "Hello." },
			works: {
				items: [
					work("a", {
						cover: image("a-cover"),
						blocks: [{ id: "a-images", type: "images", images: [image("a-1"), image("a-2", "Checkout screen")] }],
					}),
					work("b"),
				],
			},
		});
		expect(findings).toEqual([{ id: "image-alt", level: "suggestion", workIds: ["a"], count: 1 }]);
	});

	it("leaves works alone while the Work section is hidden", () => {
		const findings = check({
			hero: { greeting: "Hello." },
			sections: { hidden: ["work"] },
			works: { items: [work("a", { title: "", cover: undefined, blocks: [] })] },
		});
		expect(findings).toEqual([]);
	});

	it("flags WhatsApp switched on without a number", () => {
		const findings = check({
			hero: { greeting: "Hello." },
			works: { items: [work("a")] },
			contact: { whatsapp: { show: true, number: "" } },
		});
		expect(ids(findings)).toEqual(["whatsapp-number"]);
	});

	it("flags a page nobody can answer, unless a button leads somewhere", () => {
		const closed: PortfolioDataInput = {
			hero: { greeting: "Hello." },
			works: { items: [work("a")] },
			sections: { hidden: ["contact"] },
		};
		expect(ids(check(closed))).toEqual(["contact"]);
		expect(check({ ...closed, hero: { greeting: "Hello.", buttons: [{ kind: "email" }] } })).toEqual([]);
	});

	it("treats no photo as a gap only when one was wanted", () => {
		const resume = testResume();
		resume.picture.url = "";
		const base: PortfolioDataInput = { hero: { greeting: "Hello." }, works: { items: [work("a")] } };
		expect(ids(check(base, resume))).toEqual(["photo"]);
		expect(check({ ...base, basics: { picture: null } }, resume)).toEqual([]);
		expect(check({ ...base, hero: { greeting: "Hello.", showPicture: false } }, resume)).toEqual([]);
	});

	it("accepts an About section in place of a greeting", () => {
		expect(check({ about: { content: "<p>About me.</p>" }, works: { items: [work("a")] } })).toEqual([]);
	});
});
