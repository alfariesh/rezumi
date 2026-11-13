import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { emptyProfileData, isProfileEmpty, parseProfileData, profileDataSchema } from "@rezumi/schema/profile/data";
import { parseResumeData } from "@rezumi/schema/resume/data";
import { syncResumeDates } from "@rezumi/schema/resume/dates";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { sampleResumeData } from "@rezumi/schema/resume/sample";
import {
	compareWithProfile,
	completeProfile,
	followProfile,
	mergeProfileData,
	profileFromResume,
	resumeDataFromProfile,
	sameContent,
	saveToProfile,
	takeFromProfile,
} from "./profile";

const sample = () => parseResumeData(structuredClone(sampleResumeData));
const firstJob = (data: ResumeData) => {
	const job = data.sections.experience.items[0];
	if (!job) throw new Error("The sample resume has no experience.");
	return job;
};

describe("profileFromResume and resumeDataFromProfile", () => {
	it("moves a resume's content to a Profile and back unchanged", () => {
		const resume = sample();
		const profile = profileFromResume(resume);

		expect(profileDataSchema.safeParse(profile).success).toBe(true);
		expect(profile.basics.name).toBe(resume.basics.name);
		expect(profile.sections.experience).toHaveLength(resume.sections.experience.items.length);

		const filled = resumeDataFromProfile(profile);
		expect(filled.basics).toEqual(resume.basics);
		expect(filled.summary.content).toBe(resume.summary.content);
		expect(filled.metadata).toEqual(defaultResumeData.metadata);
		expect(defaultResumeData.sections.experience.items).toHaveLength(0);
	});

	it("keeps no item hidden in the Profile", () => {
		const resume = sample();
		firstJob(resume).hidden = true;
		expect(profileFromResume(resume).sections.experience.every((item) => !item.hidden)).toBe(true);
	});
});

describe("compareWithProfile", () => {
	it("reports a resume made from the Profile as fully linked", () => {
		const profile = profileFromResume(sample());
		const comparison = compareWithProfile(resumeDataFromProfile(profile), profile);

		expect(Object.values(comparison.basics).every((link) => link === "linked")).toBe(true);
		expect(comparison.picture).toBe("linked");
		expect(comparison.summary).toBe("linked");
		expect(Object.values(comparison.items.experience).every((link) => link === "linked")).toBe(true);
		expect(comparison.missing.experience).toEqual([]);
	});

	it("tells overrides, local items and missing items apart", () => {
		const profile = profileFromResume(sample());
		const resume = resumeDataFromProfile(profile);
		const [first, second] = resume.sections.skills.items;
		if (!first || !second) throw new Error("The sample resume needs two skills.");
		first.keywords = ["Rewritten for this job"];
		resume.sections.skills.items = [first, { ...first, id: "only-here", name: "Side Skill" }];
		resume.basics.headline = "Another headline";

		const comparison = compareWithProfile(resume, profile);
		expect(comparison.basics.headline).toBe("override");
		expect(comparison.basics.name).toBe("linked");
		expect(comparison.items.skills).toEqual({ [first.id]: "override", "only-here": "local" });
		expect(comparison.missing.skills).toContain(second.id);
	});

	it("ignores what belongs to the document: hidden items and the date text of its language", () => {
		const profile = profileFromResume(sample());
		const resume = resumeDataFromProfile(profile);
		firstJob(resume).hidden = true;
		resume.metadata.page.locale = "id-ID";
		resume.metadata.page.dateFormat = "long";
		syncResumeDates(resume);

		expect(firstJob(resume).period).not.toBe(profile.sections.experience[0]?.period);
		expect(compareWithProfile(resume, profile).items.experience[firstJob(resume).id]).toBe("linked");
	});
});

describe("followProfile", () => {
	it("updates linked parts and leaves overrides alone", () => {
		const before = profileFromResume(sample());
		const resume = resumeDataFromProfile(before);
		resume.basics.headline = "Tailored headline";
		const job = firstJob(resume);
		job.hidden = true;

		const after = structuredClone(before);
		after.basics.phone = "+62 812 0000 0000";
		after.basics.headline = "New headline";
		const changed = after.sections.experience[0];
		if (!changed) throw new Error("The sample Profile has no experience.");
		changed.description = "<p>Now with numbers.</p>";

		const next = followProfile(resume, before, after);
		expect(next?.basics.phone).toBe("+62 812 0000 0000");
		expect(next?.basics.headline).toBe("Tailored headline");
		expect(next && firstJob(next).description).toBe("<p>Now with numbers.</p>");
		expect(next && firstJob(next).hidden).toBe(true);
		expect(resume.basics.phone).toBe(before.basics.phone);
	});

	it("keeps an item the resume rewrote, and one the Profile dropped", () => {
		const before = profileFromResume(sample());
		const resume = resumeDataFromProfile(before);
		firstJob(resume).description = "<p>My own words.</p>";

		const after = structuredClone(before);
		const changed = after.sections.experience[0];
		if (!changed) throw new Error("The sample Profile has no experience.");
		changed.description = "<p>The Profile's new words.</p>";
		after.sections.education = [];

		const next = followProfile(resume, before, after);
		expect(next).toBeNull();
		expect(resume.sections.education.items.length).toBeGreaterThan(0);
	});

	it("returns null when the change is about something the resume doesn't share", () => {
		const before = profileFromResume(sample());
		const after = structuredClone(before);
		after.basics.email = "new@example.com";
		expect(followProfile(structuredClone(defaultResumeData), before, after)).toBeNull();
	});

	it("adds nothing where the resume had nothing: a blank field, photo or summary stays blank", () => {
		const before = emptyProfileData();
		const after = structuredClone(before);
		after.basics.phone = "+1 555 0100";
		after.picture.url = "/uploads/me.jpg";
		after.summary.content = "<p>Hello.</p>";
		const resume = structuredClone(defaultResumeData);

		expect(followProfile(resume, before, after)).toBeNull();
		const comparison = compareWithProfile(resume, after);
		expect(comparison.basics.phone).toBe("empty");
		expect(comparison.picture).toBe("empty");
		expect(comparison.summary).toBe("empty");
		expect(comparison.basics.location).toBe("linked");
		expect(takeFromProfile(resume, after, { kind: "basics", field: "phone" }).basics.phone).toBe("+1 555 0100");
	});

	it("clears a linked field the Profile cleared", () => {
		const before = profileFromResume(sample());
		const after = structuredClone(before);
		after.basics.phone = "";
		expect(followProfile(resumeDataFromProfile(before), before, after)?.basics.phone).toBe("");
	});
});

describe("takeFromProfile and saveToProfile", () => {
	it("brings an override back to the Profile's version, keeping the document's hidden choice", () => {
		const profile = profileFromResume(sample());
		const resume = resumeDataFromProfile(profile);
		const job = firstJob(resume);
		job.description = "<p>Mine.</p>";
		job.hidden = true;

		const next = takeFromProfile(resume, profile, { kind: "item", section: "experience", id: job.id });
		expect(firstJob(next).description).toBe(profile.sections.experience[0]?.description);
		expect(firstJob(next).hidden).toBe(true);
	});

	it("adds a missing Profile item where the Profile's order puts it", () => {
		const profile = profileFromResume(sample());
		const resume = resumeDataFromProfile(profile);
		const ids = resume.sections.skills.items.map((item) => item.id);
		const [first, second] = ids;
		if (!first || !second) throw new Error("The sample resume needs two skills.");
		resume.sections.skills.items = resume.sections.skills.items.filter((item) => item.id !== second);

		const next = takeFromProfile(resume, profile, { kind: "item", section: "skills", id: second });
		expect(next.sections.skills.items.map((item) => item.id)).toEqual(ids);

		resume.sections.skills.items = resume.sections.skills.items.filter((item) => item.id !== first);
		const again = takeFromProfile(resume, profile, { kind: "item", section: "skills", id: first });
		expect(again.sections.skills.items[0]?.id).toBe(first);
	});

	it("saves a resume's version to the Profile, new items included", () => {
		const profile = profileFromResume(sample());
		const resume = resumeDataFromProfile(profile);
		resume.basics.location = "Bandung, Indonesia";
		const job = firstJob(resume);
		resume.sections.experience.items.splice(1, 0, { ...job, id: "new-job", company: "New Co", hidden: true });

		const withLocation = saveToProfile(profile, resume, { kind: "basics", field: "location" });
		expect(withLocation.basics.location).toBe("Bandung, Indonesia");
		expect(profile.basics.location).not.toBe("Bandung, Indonesia");

		const withJob = saveToProfile(profile, resume, { kind: "item", section: "experience", id: "new-job" });
		expect(withJob.sections.experience[1]).toMatchObject({ id: "new-job", company: "New Co", hidden: false });
		expect(compareWithProfile(resume, withJob).items.experience["new-job"]).toBe("linked");
	});
});

describe("completeProfile", () => {
	it("fills only what the Profile lacks", () => {
		const resume = sample();
		const profile = emptyProfileData();
		profile.basics.name = "Kept Name";

		const next = completeProfile(profile, resume);
		expect(next?.basics.name).toBe("Kept Name");
		expect(next?.basics.email).toBe(resume.basics.email);
		expect(next?.sections.experience).toHaveLength(resume.sections.experience.items.length);
		expect(next && completeProfile(next, resume)).toBeNull();
	});
});

describe("mergeProfileData", () => {
	const job = (id: string, company: string, position: string) => ({
		id,
		hidden: false,
		company,
		position,
		location: "",
		period: "",
		website: { url: "", label: "", inlineLink: false },
		description: "",
		roles: [],
	});
	const skill = (id: string, name: string) => ({
		id,
		hidden: false,
		icon: "",
		iconColor: "",
		name,
		proficiency: "",
		level: 0,
		keywords: [],
	});

	it("fills blank basics, photo and summary, and keeps what the base has", () => {
		const base = emptyProfileData();
		base.basics.name = "Rina Saraswati";
		const addition = emptyProfileData();
		addition.basics.name = "Rina S.";
		addition.basics.headline = "Data analyst";
		addition.basics.website = { url: "https://rina.example", label: "" };
		addition.picture.url = "https://media.licdn.com/rina.jpg";
		addition.summary.content = "<p>Numbers person.</p>";

		const merged = mergeProfileData(base, addition);
		expect(merged.basics.name).toBe("Rina Saraswati");
		expect(merged.basics.headline).toBe("Data analyst");
		expect(merged.basics.website.url).toBe("https://rina.example");
		expect(merged.picture.url).toBe("https://media.licdn.com/rina.jpg");
		expect(merged.summary.content).toBe("<p>Numbers person.</p>");
		expect(base.basics.headline).toBe("");
	});

	it("adds items the base doesn't have, matching case and spacing loosely", () => {
		const base = emptyProfileData();
		base.sections.experience = [job("a", "Kopi Nusantara", "Barista")];
		base.sections.skills = [skill("s1", "TypeScript")];
		const addition = emptyProfileData();
		addition.sections.experience = [
			job("b", "  kopi   nusantara ", "BARISTA"),
			job("c", "Kopi Nusantara", "Head barista"),
		];
		addition.sections.skills = [skill("s2", "typescript"), skill("s3", "SQL"), skill("s4", "sql")];

		const merged = mergeProfileData(base, addition);
		expect(merged.sections.experience.map((item) => item.id)).toEqual(["a", "c"]);
		expect(merged.sections.skills.map((item) => item.name)).toEqual(["TypeScript", "SQL"]);
		expect(profileDataSchema.safeParse(merged).success).toBe(true);
	});

	it("gives an added item a new ID when the base already uses its ID", () => {
		const base = emptyProfileData();
		base.sections.skills = [skill("same", "Go")];
		const addition = emptyProfileData();
		addition.sections.skills = [skill("same", "Rust")];

		const merged = mergeProfileData(base, addition);
		expect(merged.sections.skills).toHaveLength(2);
		expect(merged.sections.skills[1]?.name).toBe("Rust");
		expect(merged.sections.skills[1]?.id).not.toBe("same");
	});

	it("keeps the earlier source's version when merging in order", () => {
		const fromFile = emptyProfileData();
		fromFile.sections.experience = [{ ...job("f", "Lumbung Data", "Analyst"), description: "<p>From the file</p>" }];
		const fromLinkedIn = emptyProfileData();
		fromLinkedIn.sections.experience = [
			{ ...job("l", "Lumbung Data", "analyst"), description: "<p>From LinkedIn</p>" },
		];

		const merged = [fromLinkedIn].reduce(mergeProfileData, mergeProfileData(emptyProfileData(), fromFile));
		expect(merged.sections.experience).toHaveLength(1);
		expect(merged.sections.experience[0]?.description).toBe("<p>From the file</p>");
	});
});

describe("Profile data", () => {
	it("reads unreadable stored data as empty parts instead of failing", () => {
		const read = parseProfileData({ basics: { name: 3 }, sections: { experience: "x" }, summary: { content: "Hi" } });
		expect(read.basics.name).toBe("");
		expect(read.sections.experience).toEqual([]);
		expect(read.summary.content).toBe("Hi");
		expect(isProfileEmpty(parseProfileData(null))).toBe(true);
		expect(isProfileEmpty(read)).toBe(false);
	});

	it("treats a missing key as an undefined one", () => {
		expect(sameContent({ a: 1, b: undefined }, { a: 1 })).toBe(true);
		expect(sameContent({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
	});
});
