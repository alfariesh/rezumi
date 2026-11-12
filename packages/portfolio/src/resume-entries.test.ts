import type { CustomSectionItem, ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { parseWritablePortfolioData } from "@rezumi/schema/portfolio/data";
import { fullTestResume } from "./fixtures.test-helpers";
import { portfolioMessages, portfolioViewMessages } from "./messages";
import { customSectionEntries, isResumeEntryKind, resumeEntries } from "./resume-entries";
import { buildPortfolioView } from "./view";

type Items<K extends keyof ResumeData["sections"]> = ResumeData["sections"][K]["items"];

const website = (url: string) => ({ url, label: "", inlineLink: false });

describe("resumeEntries", () => {
	it("reads a job by its position, company and place, with its roles", () => {
		const items: Items<"experience"> = [
			{
				id: "e1",
				hidden: false,
				company: " Tokopedia ",
				position: "Product Designer",
				location: "Jakarta",
				period: "2021 – now",
				website: website("https://tokopedia.example.test"),
				description: "<p>Checkout.</p>",
				roles: [{ id: "r1", position: " Lead ", period: "2023", description: "" }],
			},
			{
				id: "e2",
				hidden: false,
				company: "Startup",
				position: "",
				location: "",
				period: "",
				website: website(""),
				description: "",
				roles: [],
			},
		];
		expect(resumeEntries("experience", items)).toEqual([
			{
				id: "e1",
				title: "Product Designer",
				subtitle: "Tokopedia · Jakarta",
				when: "2021 – now",
				description: "<p>Checkout.</p>",
				url: "https://tokopedia.example.test",
				keywords: [],
				roles: [{ id: "r1", title: "Lead", when: "2023", description: "" }],
			},
			// Without a position the company is the title, not repeated under it.
			{ id: "e2", title: "Startup", subtitle: "", when: "", description: "", url: "", keywords: [], roles: [] },
		]);
	});

	it("skips roles that aren't objects, as older or imported data may hold", () => {
		const item = {
			id: "e1",
			hidden: false,
			company: "Tokopedia",
			position: "Designer",
			location: "",
			period: "",
			website: website(""),
			description: "",
			roles: [null, "Lead", { id: "r1", position: "Lead", period: "", description: "" }],
		} as unknown as Items<"experience">[number];
		expect(resumeEntries("experience", [item])[0]?.roles).toEqual([
			{ id: "r1", title: "Lead", when: "", description: "" },
		]);
	});

	it("reads a degree and its field as the title and the school under it, else the school alone", () => {
		const school = {
			hidden: false,
			grade: "3.8",
			location: "Bandung",
			period: "2015 – 2019",
			website: website(""),
			description: "",
		};
		const items: Items<"education"> = [
			{ ...school, id: "d1", school: "ITB", degree: "BA", area: "Design" },
			{ ...school, id: "d2", school: "ITB", degree: "", area: "", grade: "" },
		];
		expect(resumeEntries("education", items).map(({ title, subtitle }) => ({ title, subtitle }))).toEqual([
			{ title: "BA, Design", subtitle: "ITB · Bandung · 3.8" },
			{ title: "ITB", subtitle: "Bandung" },
		]);
	});

	it("reads short lists: who gave it, how well, when, and the keywords without empty ones", () => {
		expect(
			resumeEntries("certifications", [
				{
					id: "c1",
					hidden: false,
					title: "UX Certificate",
					issuer: "Google",
					date: "2022",
					website: website("https://cert.example.test"),
					description: "",
				},
			])[0],
		).toMatchObject({ title: "UX Certificate", subtitle: "Google", when: "2022", url: "https://cert.example.test" });
		expect(
			resumeEntries("languages", [{ id: "l1", hidden: false, language: "Indonesian", fluency: "Native", level: 5 }])[0],
		).toMatchObject({ title: "Indonesian", subtitle: "Native", when: "", url: "" });
		expect(
			resumeEntries("interests", [
				{ id: "i1", hidden: false, icon: "", iconColor: "", name: "Hiking", keywords: [" Volcanoes ", " ", "Rivers"] },
			])[0],
		).toMatchObject({ title: "Hiking", keywords: ["Volcanoes", "Rivers"] });
		expect(
			resumeEntries("profiles", [
				{
					id: "p1",
					hidden: false,
					icon: "",
					iconColor: "",
					network: "",
					username: "nadia",
					website: website("https://x.example.test/nadia"),
				},
			])[0],
		).toMatchObject({ title: "nadia", subtitle: "", url: "https://x.example.test/nadia" });
	});

	it("reads fields missing from older data as empty instead of failing", () => {
		const old = [{ id: "e1", hidden: false, company: "Old Co" }] as unknown as Items<"experience">;
		expect(resumeEntries("experience", old)).toEqual([
			{ id: "e1", title: "Old Co", subtitle: "", when: "", description: "", url: "", keywords: [], roles: [] },
		]);
	});
});

describe("custom sections", () => {
	it("draws every kind but cover letters and references", () => {
		for (const kind of ["experience", "skills", "summary", "projects", "languages", "profiles"])
			expect(isResumeEntryKind(kind), kind).toBe(true);
		for (const kind of ["cover-letter", "references", "constructor", ""])
			expect(isResumeEntryKind(kind), kind).toBe(false);
	});

	it("reads a custom section's items as items of its type", () => {
		const items = [
			{
				id: "s1",
				hidden: false,
				icon: "",
				iconColor: "",
				name: "Tools",
				proficiency: "",
				level: 0,
				keywords: ["Figma"],
			},
		] as CustomSectionItem[];
		expect(customSectionEntries("skills", items)[0]).toMatchObject({ title: "Tools", keywords: ["Figma"] });
		expect(
			customSectionEntries("summary", [{ id: "u1", hidden: false, content: " <p>Talks.</p> " }] as CustomSectionItem[]),
		).toEqual([
			{ id: "u1", title: "", subtitle: "", when: "", description: "<p>Talks.</p>", url: "", keywords: [], roles: [] },
		]);
	});
});

describe("the view's resume sections", () => {
	it("hold the items as the page draws them, links made safe and hidden items left out", () => {
		const resume = fullTestResume();
		const [job] = resume.sections.experience.items;
		if (!job) throw new Error("The full test resume has a job.");
		resume.sections.experience.items = [
			{ ...job, website: website("github.com/nadia") },
			{ ...job, id: "hidden-job", hidden: true },
		];
		const messages = portfolioViewMessages(portfolioMessages("en-US"));
		const view = buildPortfolioView({
			portfolio: { data: parseWritablePortfolioData({}) },
			resume: { data: resume },
			owner: { name: "Nadia", username: "nadia" },
			entitlements: { hidePortfolioCredit: false },
			messages,
			fileUrl: (key) => key,
		});
		const experience = view.sections.find((section) => section.kind === "experience");
		expect(experience && "entries" in experience ? experience.entries.map((entry) => entry.url) : null).toEqual([
			"https://github.com/nadia",
		]);
		const tools = view.sections.find((section) => section.kind === "resume" && section.type === "skills");
		expect(tools && "entries" in tools ? tools.entries[0] : null).toMatchObject({
			title: "Design tools",
			keywords: ["Figma", "Sketch"],
		});
	});
});
