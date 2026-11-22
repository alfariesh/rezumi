import type { CheckIssue } from "./issues";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { lintResumeForAts } from "../ats";
import { buildCheckIssues, getFindingField, getSectionName, hideTerm, ignoreIssue, runCheck } from "./issues";

const NOW = new Date("2026-09-28T00:00:00Z");

function makeResume(mutate: (data: ResumeData) => void = () => undefined): ResumeData {
	return produce(defaultResumeData, (data) => {
		data.basics.name = "Jordan Reyes";
		data.basics.email = "jordan@reyes.design";
		data.basics.phone = "+49 151 2345 6789";
		data.basics.location = "Berlin";
		data.sections.experience.items = [
			{
				id: "kettle",
				hidden: false,
				company: "Studio Kettle",
				position: "Junior Designer",
				location: "Lisbon",
				period: "2016 - 2019",
				website: { url: "", label: "", inlineLink: false },
				description: "<p>Designed identities for small businesses.</p>",
				roles: [],
			} as ResumeData["sections"]["experience"]["items"][number],
		];
		data.metadata.template = "meridian";
		data.metadata.layout.pages = [{ fullWidth: false, main: ["experience"], sidebar: [] }];
		mutate(data);
	});
}

const issuesOf = (data: ResumeData) => buildCheckIssues(lintResumeForAts(data, { now: NOW }), data);

const only = (data: ResumeData, code: string): CheckIssue => {
	const issue = issuesOf(data).find((entry) => entry.code === code);
	if (!issue) throw new Error(`No ${code} issue`);
	return issue;
};

/** Applies an issue's one-step fix to the data and returns the result. */
function applyFix(data: ResumeData, issue: CheckIssue) {
	if (issue.fix.kind !== "apply") throw new Error(`${issue.code} has no one-step fix`);
	const { apply } = issue.fix;
	return produce(data, (draft) => {
		apply(draft);
	});
}

describe("buildCheckIssues", () => {
	it("numbers open issues in the report's order and places each on its block", () => {
		const data = makeResume((resume) => {
			resume.basics.email = "";
			const entry = resume.sections.experience.items[0];
			if (entry) entry.period = "a while back";
		});
		const issues = issuesOf(data);

		expect(issues.map((issue) => [issue.number, issue.code])).toEqual([
			[1, "MISSING_EMAIL"],
			[2, "UNPARSEABLE_PERIOD"],
		]);
		expect(issues[0]?.target).toEqual({ kind: "header" });
		expect(issues[1]?.target).toEqual({ kind: "item", sectionId: "experience", itemId: "kettle" });
		expect(issues[1]?.category).toBe("dates");
		expect(issues[1]?.fix).toMatchObject({ kind: "write", target: issues[1]?.target });
		expect(issues[1]?.facts).toMatchObject({ value: "a while back", entry: "Junior Designer" });
	});

	it("colours errors danger and the rest warning", () => {
		const data = makeResume((resume) => {
			resume.basics.name = "";
			resume.basics.phone = "";
		});
		const tones = Object.fromEntries(issuesOf(data).map((issue) => [issue.code, issue.tone]));
		expect(tones).toMatchObject({ MISSING_NAME: "danger" });
		expect(Object.values(tones)).toContain("warning");
	});

	it("adds https:// to a link in one step, and sends links with another scheme to Write", () => {
		const bare = makeResume((resume) => (resume.basics.website.url = "reyes.design"));
		const issue = only(bare, "MALFORMED_URL");
		expect(issue.facts.url).toBe("https://reyes.design");
		const fixed = applyFix(bare, issue);
		expect(fixed.basics.website.url).toBe("https://reyes.design");
		expect(issuesOf(fixed).map((entry) => entry.code)).not.toContain("MALFORMED_URL");

		const odd = makeResume((resume) => (resume.basics.website.url = "ftp:/reyes.design"));
		expect(only(odd, "MALFORMED_URL").fix.kind).toBe("write");
	});

	it("switches a two-column page to one column without losing its sidebar sections", () => {
		const data = makeResume((resume) => {
			resume.metadata.template = "jejak";
			resume.sections.skills.items = [
				{ id: "s1", hidden: false, icon: "", iconColor: "", name: "Figma", proficiency: "", level: 0, keywords: [] },
			];
			resume.metadata.layout.pages = [{ fullWidth: false, main: ["experience"], sidebar: ["skills"] }];
		});
		const issue = only(data, "TWO_COLUMN_LAYOUT");
		expect(issue.keepLabel).toBe(true);
		expect(issue.target).toBeNull();
		expect(issue.facts.sections).toEqual(["skills"]);

		const fixed = applyFix(data, issue);
		expect(fixed.metadata.layout.pages).toEqual([{ fullWidth: true, main: ["experience", "skills"], sidebar: [] }]);
		expect(issuesOf(fixed)).toEqual([]);
	});

	it("hides the photo in one step", () => {
		const data = makeResume((resume) => {
			resume.picture.url = "https://example.com/me.jpg";
			resume.picture.hidden = false;
		});
		const issue = only(data, "PICTURE_PRESENT");
		expect(issue.fix).toMatchObject({ kind: "apply", icon: "eye-slash" });
		expect(applyFix(data, issue).picture.hidden).toBe(true);
	});
});

describe("check state", () => {
	it("ignores an issue once, so it stops counting", () => {
		const data = makeResume((resume) => (resume.basics.email = ""));
		const [issue] = runCheck(data, { now: NOW }).issues;
		if (!issue) throw new Error("No issue");
		const ignored = produce(data, (draft) => {
			ignoreIssue(draft, issue.key);
			ignoreIssue(draft, issue.key);
		});
		expect(ignored.metadata.check?.ignored).toEqual([issue.key]);
		const after = runCheck(ignored, { now: NOW });
		expect(after.issues).toEqual([]);
		expect(after.report.ignored).toHaveLength(1);
	});

	it("hides a posting term once", () => {
		const hidden = produce(makeResume(), (draft) => {
			hideTerm(draft, "figma");
			hideTerm(draft, "figma");
		});
		expect(hidden.metadata.check?.hiddenTerms).toEqual(["figma"]);
	});
});

describe("names and fields", () => {
	it("names a section by its own title, else its type", () => {
		const data = makeResume((resume) => (resume.sections.skills.title = "Toolbox"));
		expect(getSectionName(data, "skills", (type) => `type:${type}`)).toBe("Toolbox");
		expect(getSectionName(data, "experience", (type) => `type:${type}`)).toBe("type:experience");
		expect(getSectionName(data, "nowhere", (type) => `type:${type}`)).toBe("nowhere");
	});

	it("reads the field inside an entry from a pointer", () => {
		expect(getFindingField("/basics/email")).toBe("email");
		expect(getFindingField("/sections/experience/items/0/period")).toBe("period");
		expect(getFindingField("/basics/website/url")).toBe("website/url");
	});
});
