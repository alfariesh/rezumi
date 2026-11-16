import type { Proposal } from "./proposals";
import { describe, expect, it } from "vite-plus/test";
import { experienceItemSchema } from "@rezumi/schema/resume/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import {
	additionAfter,
	applyProposal,
	applyTo,
	canApplyTo,
	canonicalHtml,
	collectLetterPassages,
	collectPassages,
	getStateIn,
	readTarget,
	replaceBlockText,
} from "./proposals";

const labels = { body: "Letter", bullet: (n: number) => `bullet ${n}`, paragraph: (n: number) => `paragraph ${n}` };

it("rejects ambiguous paragraphs instead of replacing the first occurrence", () => {
	const value = "<p>Repeated claim.</p><p>Different middle.</p><p>Repeated claim.</p>";
	expect(applyTo(value, { before: "<p>Repeated claim.</p>", after: "<p>Changed</p>" })).toBeUndefined();
	expect(additionAfter(value, "<p>Repeated claim.</p>", "Added")).toBeUndefined();
	expect(applyTo("<p>Unique</p>", { before: "<p>Unique</p>", after: "<p>$&</p>" })).toBe("<p>$&</p>");
});

it("collects and edits nested role descriptions and custom summaries without changing siblings", () => {
	const data = structuredClone(defaultResumeData);
	data.sections.experience.items = [
		experienceItemSchema.parse({
			id: "company",
			hidden: false,
			company: "Kettle",
			position: "",
			location: "",
			period: "",
			description: "",
			website: { url: "", label: "" },
			roles: [
				{ id: "lead", position: "Lead", period: "", description: "<p>Led delivery.</p>" },
				{ id: "engineer", position: "Engineer", period: "", description: "<p>Built services.</p>" },
			],
		}),
	];
	data.customSections = [
		{
			id: "custom",
			type: "summary",
			title: "About",
			icon: "",
			columns: 1,
			hidden: false,
			keepTogether: false,
			startOnNewPage: false,
			items: [{ id: "about", hidden: false, content: "<p>Custom prose.</p>" }],
		},
	];
	const passages = collectPassages(data, {
		...labels,
		summary: "Summary",
		sectionTitle: (id) => id,
		entryTitle: () => "Kettle",
	});
	expect(passages.map((passage) => passage.text)).toEqual(["Led delivery.", "Built services.", "Custom prose."]);
	for (const passage of [passages[0], passages[2]]) {
		if (!passage) throw new Error("Missing supported passage");
		expect(
			applyProposal(data, {
				id: passage.id,
				target: passage.target,
				location: passage.location,
				before: passage.html,
				after: "<p>Revised.</p>",
				why: "Clearer",
				status: "pending",
				source: "check",
			}),
		).toBe(true);
		expect(readTarget(data, passage.target)).toBe("<p>Revised.</p>");
	}
	expect(data.sections.experience.items[0]?.roles[1]?.description).toBe("<p>Built services.</p>");
	expect(data.sections.experience.items[0]?.description).toBe("");
	const experience = data.sections.experience.items[0];
	const custom = data.customSections[0];
	if (!experience || !custom) throw new Error("Missing fixtures");
	experience.hidden = true;
	custom.hidden = true;
	expect(
		collectPassages(data, { ...labels, summary: "Summary", sectionTitle: (id) => id, entryTitle: () => "Kettle" }),
	).toEqual([]);
});

describe("additionAfter", () => {
	it("adds a paragraph after a paragraph, and nothing for a passage that's gone", () => {
		expect(additionAfter("<p>One</p><p>Two</p>", "<p>One</p>", "Between")).toEqual({
			before: "<p>One</p>",
			after: "<p>One</p><p>Between</p>",
		});
		expect(additionAfter("<p>One</p>", "<p>Gone</p>", "x")).toBeUndefined();
	});
});

describe("collectLetterPassages", () => {
	it("lists the body's paragraphs with stable ids that change with the text", () => {
		const passages = collectLetterPassages("<p>Hello there.</p><p>Hello there.</p><p>Bye.</p>", labels);

		expect(passages.map((passage) => passage.location)).toEqual([
			"Letter · paragraph 1",
			"Letter · paragraph 2",
			"Letter · paragraph 3",
		]);
		expect(passages[1]?.id).toBe(`${passages[0]?.id}_2`);
		expect(collectLetterPassages("<p>Hello, there.</p>", labels)[0]?.id).not.toBe(passages[0]?.id);
	});

	it("offers an empty body as one empty passage only when asked", () => {
		expect(collectLetterPassages("", labels)).toEqual([]);
		const [empty] = collectLetterPassages("", { ...labels, includeEmpty: true });
		expect(empty).toMatchObject({ html: "", text: "", location: "Letter" });
		// Writing into it replaces the empty text.
		expect(applyTo("", { before: "", after: "<p>Dear team</p>" })).toBe("<p>Dear team</p>");
	});
});

describe("letter proposals across spellings", () => {
	// The body as the editor holds it after "Keep" (`coverLetterTextToHtml` escapes quotes) and a little typing (the
	// editor writes `<br>`, `&nbsp;` and spaced styles)...
	const editor = [
		"<p>Dear Ms. Reyes,<br>I&#39;m applying for the Product Designer role at Kettle&nbsp;Labs.</p>",
		"<p>At Lumen Health I led the &quot;Care Plans&quot; redesign — it’s now used by 40,000 patients.</p>",
		"<p>I built the design system and ran weekly usability sessions.</p>",
		"<p>I also mentor two junior designers.</p>",
		'<p style="text-align: left;">I&#39;d welcome a chat about the team&#39;s plans.<br>Kind regards,<br>Dana Reyes</p>',
	].join("");
	// ...and as the server sanitized and stored it, which the assistant reads and proposes against.
	const stored = [
		"<p>Dear Ms. Reyes,<br />I'm applying for the Product Designer role at Kettle\u00a0Labs.</p>",
		'<p>At Lumen Health I led the "Care Plans" redesign — it’s now used by 40,000 patients.</p>',
		"<p>I built the design system and ran weekly usability sessions.</p>",
		"<p>I also mentor two junior designers.</p>",
		"<p style=\"text-align:left\">I'd welcome a chat about the team's plans.<br />Kind regards,<br />Dana Reyes</p>",
	].join("");
	const translations = [
		"Yth. Ibu Reyes, saya melamar posisi Product Designer di Kettle Labs.",
		"Di Lumen Health saya memimpin desain ulang “Care Plans”.",
		"Saya membangun design system dan menjalankan sesi uji kegunaan mingguan.",
		"Saya juga membimbing dua desainer junior.",
		"Saya ingin berdiskusi tentang rencana tim. Salam hormat, Dana Reyes",
	];
	const proposals: Proposal[] = collectLetterPassages(stored, labels).map((passage, index) => ({
		id: passage.id,
		target: passage.target,
		location: passage.location,
		before: passage.html,
		after: replaceBlockText(passage.html, translations[index] ?? ""),
		why: "Translate to Indonesian.",
		status: "pending",
		source: "assistant",
	}));

	it("keeps every fresh proposal applicable to the editor's copy", () => {
		expect(proposals).toHaveLength(5);
		expect(proposals.map((proposal) => getStateIn(editor, proposal))).toEqual(Array(5).fill("pending"));
	});

	it("applies them all, replacing each paragraph as the editor spells it", () => {
		const translated = proposals.reduce((value, proposal) => applyTo(value, proposal) ?? value, editor);
		expect(translated).toBe(proposals.map((proposal) => proposal.after).join(""));
		expect(proposals.map((proposal) => getStateIn(translated, { ...proposal, status: "accepted" }))).toEqual(
			Array(5).fill("accepted"),
		);
		// Undo puts the editor's text back: accepted edits show as pending again.
		expect(proposals.map((proposal) => getStateIn(editor, { ...proposal, status: "accepted" }))).toEqual(
			Array(5).fill("pending"),
		);
	});

	it("still marks a proposal out of date once its words or formatting change", () => {
		const [first, second] = proposals;
		if (!first || !second) throw new Error("Missing proposals");
		expect(getStateIn(editor.replace("Kettle&nbsp;Labs", "Kettle Studio"), first)).toBe("stale");
		expect(
			getStateIn(editor.replace("&quot;Care Plans&quot;", "<strong>&quot;Care Plans&quot;</strong>"), second),
		).toBe("stale");
		// A paragraph that now appears twice is ambiguous, however it's spelled.
		const repeated = `${editor}<p>At Lumen Health I led the "Care Plans" redesign — it’s now used by 40,000 patients.</p>`;
		expect(canApplyTo(repeated, second)).toBe(false);
	});

	it("adds a paragraph after one the editor spells differently", () => {
		const [first] = collectLetterPassages(stored, labels);
		if (!first) throw new Error("Missing passage");
		const addition = additionAfter(editor, first.html, "Saya tertarik pada misi Kettle.");
		expect(addition?.before).toBe(
			"<p>Dear Ms. Reyes,<br>I&#39;m applying for the Product Designer role at Kettle&nbsp;Labs.</p>",
		);
		expect(addition && applyTo(editor, addition)).toContain(
			"Kettle&nbsp;Labs.</p><p>Saya tertarik pada misi Kettle.</p><p>At Lumen",
		);
	});

	it("spells equivalent HTML the same and different HTML differently", () => {
		expect(canonicalHtml("<P STYLE='text-align: center;'>a&nbsp;b<BR/></P>")).toBe(
			canonicalHtml('<p style="text-align:center">a\u00a0b<br></p>'),
		);
		expect(canonicalHtml("<p>1 &lt; 2 &amp;&amp; 3 &#62; 2</p>")).toBe("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2</p>");
		expect(canonicalHtml("<p>Tom &amp; Jerry</p>")).not.toBe(canonicalHtml("<p>Tom and Jerry</p>"));
		expect(canonicalHtml("<p><em>Hi</em></p>")).not.toBe(canonicalHtml("<p>Hi</p>"));
	});
});
