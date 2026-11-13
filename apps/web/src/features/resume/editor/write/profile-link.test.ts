import type { ProfileData } from "@rezumi/schema/profile/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { describe, expect, it, vi } from "vite-plus/test";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { defaultResumeData } from "@rezumi/schema/resume/default";
import { markerState } from "./profile-link";

vi.mock("@/libs/orpc/client", () => ({ client: {}, orpc: {} }));

const profile = (): ProfileData => {
	const data = emptyProfileData();
	data.basics.name = "Dana Putri";
	data.basics.email = "dana@example.test";
	data.basics.phone = "+62 812 0000 0000";
	data.sections.experience = [
		{
			...defaultResumeData.sections.experience.items[0],
			id: "job-1",
			hidden: false,
			company: "Northwind",
			position: "Designer",
		} as ProfileData["sections"]["experience"][number],
	];
	return data;
};

const sample = (): ResumeData => {
	const data = structuredClone(defaultResumeData);
	data.basics.name = "Alex Morgan";
	data.basics.email = "alex@example.test";
	data.basics.phone = "+1 555 0100";
	return data;
};

describe("Profile markers", () => {
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
		const [job] = data.sections.experience.items;
		if (job) job.position = "Lead designer";
		expect(markerState(data, profile(), { kind: "item", section: "experience", id: "job-1" })).toBe("both");
		expect(markerState(data, profile(), { kind: "item", section: "experience", id: "other" })).toBeNull();
	});
});
