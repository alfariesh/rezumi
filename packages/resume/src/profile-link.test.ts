import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it } from "vite-plus/test";
import { produce } from "immer";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { resumeDataFromProfile } from "./profile";
import {
	isLocalEntry,
	markerState,
	missingFromProfile,
	profilePreview,
	profileSectionOf,
	profileView,
	sectionParts,
	sectionsFromProfile,
	takeProfilePartsEdit,
} from "./profile-link";

const job = (id: string, company: string, position: string) =>
	({
		...defaultResumeData.sections.experience.items[0],
		id,
		hidden: false,
		company,
		position,
	}) as ProfileData["sections"]["experience"][number];

const profile = (): ProfileData => {
	const data = emptyProfileData();
	data.basics.name = "Dana Putri";
	data.basics.email = "dana@example.test";
	data.basics.phone = "+62 812 0000 0000";
	data.sections.experience = [job("job-1", "Northwind", "Designer")];
	return data;
};

const sample = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.basics.name = "Alex Morgan";
	data.basics.email = "alex@example.test";
	data.basics.phone = "+1 555 0100";
	return data;
};

describe("markerState", () => {
	it("leaves a resume that shares nothing with the Profile alone, like a sample", () => {
		const data = sample();
		expect(markerState(data, profile(), { kind: "basics", field: "name" })).toBeNull();
		expect(markerState(data, profile(), { kind: "basics", field: "email" })).toBeNull();
	});

	it("marks a basics field this resume changed, once it shares something with the Profile", () => {
		const data = resumeDataFromProfile(profile());
		data.basics.name = "Dana P.";
		expect(markerState(data, profile(), { kind: "basics", field: "name" })).toBe("both");
		expect(markerState(data, profile(), { kind: "basics", field: "email" })).toBeNull();
	});

	it("offers only Save to Profile for what the Profile doesn't have yet", () => {
		const data = resumeDataFromProfile(profile());
		data.basics.location = "Bandung";
		expect(markerState(data, profile(), { kind: "basics", field: "location" })).toBe("save");
	});

	it("offers only a quiet Use Profile's for a field the resume leaves blank", () => {
		const data = resumeDataFromProfile(profile());
		data.basics.phone = "";
		expect(markerState(data, profile(), { kind: "basics", field: "phone" })).toBe("fill");
	});

	it("marks an entry that reads differently from the Profile's, not one the Profile lacks", () => {
		const data = resumeDataFromProfile(profile());
		const [first] = data.sections.experience.items;
		if (first) first.position = "Lead designer";
		expect(markerState(data, profile(), { kind: "item", section: "experience", id: "job-1" })).toBe("both");
		expect(markerState(data, profile(), { kind: "item", section: "experience", id: "other" })).toBeNull();
	});

	it("marks the summary and the photo like basics fields", () => {
		const data = resumeDataFromProfile(profile());
		data.summary.content = "<p>Writes clear interfaces.</p>";
		data.picture.url = "/uploads/me.jpg";
		expect(markerState(data, profile(), { kind: "summary" })).toBe("save");
		expect(markerState(data, profile(), { kind: "picture" })).toBe("save");
	});
});

describe("profileView", () => {
	it("reuses one comparison per version of the resume and the Profile", () => {
		const data = resumeDataFromProfile(profile());
		const source = profile();
		expect(profileView(data, source)).toBe(profileView(data, source));
		expect(profileView(data, profile())).not.toBe(profileView(data, source));
		expect(profileView(data, source).connected).toBe(true);
		expect(profileView(sample(), source).connected).toBe(false);
	});
});

describe("takeProfilePartsEdit", () => {
	it("writes the Profile's version of a basics field and an entry in one edit", () => {
		const source = profile();
		const data = resumeDataFromProfile(source);
		data.basics.name = "Dana P.";
		const [first] = data.sections.experience.items;
		if (first) {
			first.position = "Lead designer";
			first.hidden = true;
		}
		const edit = takeProfilePartsEdit(data, source, [
			{ kind: "basics", field: "name" },
			{ kind: "item", section: "experience", id: "job-1" },
		]);
		const next = produce(data, (draft) => edit?.(draft));
		expect(next.basics.name).toBe("Dana Putri");
		expect(next.sections.experience.items[0]?.position).toBe("Designer");
		// Hiding is the resume's choice and stays.
		expect(next.sections.experience.items[0]?.hidden).toBe(true);
	});

	it("adds Profile entries the resume doesn't have and runs prepare first", () => {
		const source = profile();
		source.sections.experience.push(job("job-2", "Kopi Studio", "Barista"));
		const data = resumeDataFromProfile(profile());
		const order: string[] = [];
		const edit = takeProfilePartsEdit(data, source, [{ kind: "item", section: "experience", id: "job-2" }], () =>
			order.push("prepare"),
		);
		const next = produce(data, (draft) => edit?.(draft));
		expect(order).toEqual(["prepare"]);
		expect(next.sections.experience.items.map((item) => item.id)).toEqual(["job-1", "job-2"]);
	});

	it("has nothing to do without parts", () => {
		expect(takeProfilePartsEdit(sample(), profile(), [])).toBeNull();
	});
});

describe("entries and sections from the Profile", () => {
	it("tells local entries, missing entries and sections the Profile can fill", () => {
		const source = profile();
		source.sections.experience.push(job("job-2", "Kopi Studio", "Barista"));
		source.summary.content = "<p>Designer.</p>";
		const data = resumeDataFromProfile(profile());
		data.sections.experience.items.push(job("own", "Side project", "Maker") as never);

		expect(isLocalEntry(data, source, "experience", "own")).toBe(true);
		expect(isLocalEntry(data, source, "experience", "job-1")).toBe(false);
		expect(missingFromProfile(data, source, "experience")).toEqual(["job-2"]);
		expect(sectionsFromProfile(source, ["summary", "experience", "education"])).toEqual([
			{ type: "summary", count: 1 },
			{ type: "experience", count: 2 },
		]);
		expect(sectionParts(source, "experience")).toEqual([
			{ kind: "item", section: "experience", id: "job-1" },
			{ kind: "item", section: "experience", id: "job-2" },
		]);
		expect(sectionParts(source, "summary")).toEqual([{ kind: "summary" }]);
	});

	it("doesn't offer a Profile entry the resume keeps in a custom section", () => {
		const source = profile();
		source.sections.experience.push(job("job-2", "Kopi Studio", "Barista"));
		const data = resumeDataFromProfile(profile());
		// job-1 moved out of Experience into a custom section keeps its Profile id.
		const [moved] = data.sections.experience.items.splice(0, 1);
		data.customSections.push({
			id: "custom-1",
			type: "experience",
			title: "Freelance",
			icon: "",
			hidden: false,
			showHeading: true,
			columns: 1,
			keepTogether: false,
			startOnNewPage: false,
			items: [moved],
		} as never);

		expect(missingFromProfile(data, source, "experience")).toEqual(["job-2"]);
	});
});

describe("profileSectionOf", () => {
	it("links built-in sections only", () => {
		expect(profileSectionOf({ id: "experience", kind: "builtin" })).toBe("experience");
		expect(profileSectionOf({ id: "summary", kind: "summary" })).toBeNull();
		expect(profileSectionOf({ id: "abc", kind: "custom" })).toBeNull();
	});
});

describe("profilePreview", () => {
	it("describes a part in one short line", () => {
		const source = profile();
		source.basics.website = { url: "https://dana.example.test", label: "" };
		expect(profilePreview(source, { kind: "basics", field: "name" })).toBe("Dana Putri");
		expect(profilePreview(source, { kind: "basics", field: "website" })).toBe("https://dana.example.test");
		expect(profilePreview(source, { kind: "item", section: "experience", id: "job-1" })).toContain("Northwind");
		source.summary.content = `<p>${"a".repeat(200)}</p>`;
		expect(profilePreview(source, { kind: "summary" })).toHaveLength(161);
	});
});
