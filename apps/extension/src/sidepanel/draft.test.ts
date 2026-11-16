import type { ReadingSummary } from "./reading";
import { describe, expect, it } from "vite-plus/test";
import {
	canSave,
	contactId,
	createInput,
	draftFromReading,
	editDraft,
	locationWithType,
	readDraft,
	sourceName,
	withCapture,
} from "./draft";

const summary: ReadingSummary = {
	kind: "posting",
	fields: {
		role: { value: "Product Designer", source: "site" },
		company: { value: "Lumen Health", source: "site" },
		description: { value: "Design calm tools. Email hr@lumen.example", source: "site" },
	},
	missing: ["location"],
};

const context = {
	site: "linkedin" as const,
	sourceUrl: "https://www.linkedin.com/jobs/view/4012345678/",
	postingSource: {
		method: "extension" as const,
		format: "text" as const,
		truncated: false,
		completeness: "unknown" as const,
	},
	requirements: ["Figma"],
	suggestions: [
		{ type: "email" as const, value: "hr@lumen.example" },
		{ type: "phone" as const, value: "+6281234567890" },
	],
};

describe("draft", () => {
	it("starts from the page, Saved by default with today's date ready for Applied (aturan turunan #2)", () => {
		const draft = draftFromReading("linkedin:1", summary, "2026-11-15");
		expect(draft.values).toMatchObject({
			role: "Product Designer",
			company: "Lumen Health",
			location: "",
			status: "saved",
			appliedOn: "2026-11-15",
			contacts: [],
		});
		expect(canSave(draft)).toBe(true);
		expect(canSave(editDraft(draft, { role: " " }))).toBe(false);
	});

	it("takes the server's reading only for fields the person did not change", () => {
		const edited = editDraft(draftFromReading("linkedin:1", summary), { company: "Lumen" });
		const next = withCapture(edited, {
			role: "Senior Product Designer",
			company: "Lumen Health Tbk",
			location: "Jakarta",
			salary: "",
			employmentType: "Full-time",
			validThrough: null,
		});
		expect(next.values).toMatchObject({
			role: "Senior Product Designer",
			company: "Lumen",
			location: "Jakarta",
			employmentType: "Full-time",
		});
		expect(next.edited).toEqual(["company"]);
	});

	it("starts the reminder two days before the posting closes, unless the person set one (aturan turunan #6)", () => {
		const capture = {
			role: "",
			company: "",
			location: "",
			salary: "",
			employmentType: "",
			validThrough: "2026-12-31",
		};
		const fresh = draftFromReading("linkedin:1", summary, "2026-11-15");
		expect(withCapture(fresh, capture, "2026-11-15").values.followUpOn).toBe("2026-12-29");
		expect(withCapture(fresh, { ...capture, validThrough: null }, "2026-11-15").values.followUpOn).toBe("");
		const cleared = editDraft(fresh, { followUpOn: "" });
		expect(withCapture(cleared, capture, "2026-11-15").values.followUpOn).toBe("");
		const picked = editDraft(fresh, { followUpOn: "2026-11-20" });
		expect(withCapture(picked, capture, "2026-11-15").values.followUpOn).toBe("2026-11-20");
	});

	it("keeps a stored draft only for the same posting", () => {
		const draft = draftFromReading("linkedin:1", summary);
		expect(readDraft(draft, "linkedin:1")).toEqual(draft);
		expect(readDraft(draft, "linkedin:2")).toBeNull();
		expect(readDraft({ identity: "linkedin:1", values: null, edited: [] }, "linkedin:1")).toBeNull();
		expect(readDraft(undefined, "linkedin:1")).toBeNull();
		// A draft from before reminders existed gets empty reminder fields.
		const { followUpOn: _on, followUpNote: _note, ...older } = draft.values;
		expect(readDraft({ ...draft, values: older }, "linkedin:1")?.values).toMatchObject({
			followUpOn: "",
			followUpNote: "",
		});
	});
});

describe("createInput", () => {
	it("saves only the ticked contacts and the applied date with Applied", () => {
		const draft = editDraft(draftFromReading("linkedin:1", summary, "2026-11-15"), {
			status: "applied",
			appliedOn: "2026-11-14",
			location: "Jakarta",
			employmentType: "Full-time",
			contacts: [contactId({ type: "email", value: "hr@lumen.example" })],
			tags: ["remote"],
		});
		expect(createInput(draft, context)).toEqual({
			role: "Product Designer",
			company: "Lumen Health",
			location: "Jakarta · Full-time",
			source: "LinkedIn",
			sourceUrl: context.sourceUrl,
			jobDescription: "Design calm tools. Email hr@lumen.example",
			postingSource: context.postingSource,
			requirements: ["Figma"],
			resumeId: null,
			tags: ["remote"],
			contacts: [{ name: "Lumen Health", role: "", type: "Recruiter", email: "hr@lumen.example", phone: "" }],
			status: "applied",
			stageEnteredAt: "2026-11-14",
		});
	});

	it("saves no contact when none is ticked, and no date with Saved", () => {
		const input = createInput(draftFromReading("linkedin:1", summary), context);
		expect(input.contacts).toEqual([]);
		expect(input).not.toHaveProperty("stageEnteredAt");
		expect(input).not.toHaveProperty("followUpAt");
		expect(input.status).toBe("saved");
	});

	it("saves the reminder as the picked day, as the web does", () => {
		const draft = editDraft(draftFromReading("linkedin:1", summary), {
			followUpOn: "2026-11-20",
			followUpNote: " Ask about the take-home ",
		});
		expect(createInput(draft, context)).toMatchObject({
			followUpAt: new Date("2026-11-20T00:00:00.000Z"),
			followUpNote: "Ask about the take-home",
		});
	});
});

describe("helpers", () => {
	it("names the source and joins the kind of employment to the place", () => {
		expect(sourceName(null, "https://www.acme.example/careers/1")).toBe("acme.example");
		expect(sourceName("glints", "https://glints.com/x")).toBe("Glints");
		expect(locationWithType("Jakarta", "Full-time")).toBe("Jakarta · Full-time");
		expect(locationWithType("Jakarta (Full-time)", "Full-time")).toBe("Jakarta (Full-time)");
		expect(locationWithType("", "Contract")).toBe("Contract");
	});
});
