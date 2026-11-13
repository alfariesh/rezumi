import type { SourceRun, SourceRuns } from "./model";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { describe, expect, it } from "vite-plus/test";
import { ORPCError } from "@orpc/client";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import {
	applyReview,
	canRetrySource,
	countReviewEntries,
	emptySourceInputs,
	hasSourceInput,
	isFetching,
	keepRequested,
	mergeSourceResults,
	photoCandidates,
	readSourceInputs,
	requestsToRun,
	reviewGroups,
	sourceFindings,
	websiteAddress,
} from "./model";

const everything = { linkedin: true, github: true, website: true };

const website = { url: "", label: "", inlineLink: false };

const experience = (id: string, company: string, position: string) => ({
	id,
	hidden: false,
	company,
	position,
	location: "",
	period: "",
	website,
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

const profile = (fill: (data: ProfileData) => void = () => {}) => {
	const data = emptyProfileData();
	fill(data);
	return data;
};

const done = (data: ProfileData, extra: Partial<SourceResult> = {}): SourceRun => ({
	status: "done",
	key: "k",
	result: { data, photoUrl: null, notes: [], ...extra },
});

describe("reading what was entered", () => {
	it("runs only the sources filled in, in merge order, with their normalized input", () => {
		const file = new File(["{}"], "resume.json", { type: "application/json" });
		const { requests, problems } = readSourceInputs(
			{
				file,
				linkedin: "https://www.linkedin.com/in/dewi-lestari/",
				linkedinOwn: true,
				github: "@Dewi-Dev",
				website: "dewi.design",
			},
			everything,
		);
		expect(problems).toEqual({});
		expect(requests.map((request) => request.id)).toEqual(["file", "linkedin", "github", "website"]);
		expect(requests[2]).toMatchObject({ username: "Dewi-Dev", key: "dewi-dev" });
		expect(requests[3]).toMatchObject({ url: "https://dewi.design/" });
	});

	it("holds LinkedIn back until the person says the profile is theirs", () => {
		const inputs = { ...emptySourceInputs(), linkedin: "linkedin.com/in/dewi" };
		expect(readSourceInputs(inputs, everything)).toEqual({ requests: [], problems: { linkedin: "unconfirmed" } });
		expect(
			readSourceInputs({ ...inputs, linkedin: "linkedin.com/company/acme", linkedinOwn: true }, everything).problems,
		).toEqual({ linkedin: "invalid" });
	});

	it("flags what can't be read without stopping at the first problem", () => {
		const { requests, problems } = readSourceInputs(
			{ ...emptySourceInputs(), github: "not a login", website: "localhost" },
			everything,
		);
		expect(requests).toEqual([]);
		expect(problems).toEqual({ github: "invalid", website: "invalid" });
	});

	it("ignores sources this account doesn't offer", () => {
		const inputs = { ...emptySourceInputs("octocat"), linkedin: "dewi", linkedinOwn: true, website: "dewi.design" };
		const offered = { linkedin: false, github: true, website: false };
		expect(readSourceInputs(inputs, offered).requests.map((request) => request.id)).toEqual(["github"]);
		expect(hasSourceInput({ ...emptySourceInputs(), website: "dewi.design" }, offered)).toBe(false);
		expect(hasSourceInput(emptySourceInputs("octocat"), offered)).toBe(true);
	});

	it("accepts a website with or without its scheme, and nothing that isn't public", () => {
		expect(websiteAddress("dewi.design/about")).toBe("https://dewi.design/about");
		expect(websiteAddress("http://dewi.design")).toBe("http://dewi.design/");
		expect(websiteAddress("ftp://dewi.design")).toBeNull();
		expect(websiteAddress("https://user:secret@dewi.design")).toBeNull();
		expect(websiteAddress("dewi")).toBeNull();
		expect(websiteAddress("")).toBeNull();
	});
});

describe("running sources", () => {
	const github = { id: "github", key: "dewi-dev", username: "dewi-dev" } as const;
	const website = { id: "website", key: "https://dewi.design/", url: "https://dewi.design/" } as const;

	it("starts new, changed and failed sources and leaves running or found ones alone", () => {
		const runs: SourceRuns = {
			github: { status: "loading", key: "dewi-dev" },
			website: { status: "failed", key: "https://dewi.design/", error: new Error("x") },
		};
		expect(requestsToRun([github, website], runs)).toEqual([website]);
		expect(requestsToRun([{ ...github, key: "someone-else" }], runs)).toHaveLength(1);
		expect(requestsToRun([github], { github: { ...done(profile()), key: "dewi-dev" } as never })).toEqual([]);
	});

	it("forgets a source that was cleared, so its result isn't merged", () => {
		const runs: SourceRuns = {
			github: { status: "loading", key: "dewi-dev" },
			website: { status: "loading", key: "x" },
		};
		expect(keepRequested(runs, [github])).toEqual({ github: runs.github });
		expect(keepRequested(runs, [])).toEqual({});
	});

	it("is fetching while any source still loads, whatever the others did", () => {
		expect(
			isFetching({ github: { status: "loading", key: "k" }, website: { status: "failed", key: "k", error: 1 } }),
		).toBe(true);
		expect(isFetching({ website: { status: "failed", key: "k", error: 1 } })).toBe(false);
	});

	it("offers Retry only when trying again can help", () => {
		expect(canRetrySource(new ORPCError("SOURCE_FAILED"))).toBe(true);
		expect(canRetrySource(new ORPCError("BAD_GATEWAY"))).toBe(true);
		expect(canRetrySource(new TypeError("Failed to fetch"))).toBe(true);
		for (const code of [
			"SOURCE_INVALID",
			"SOURCE_NOT_FOUND",
			"SOURCE_LIMIT",
			"SOURCE_UNAVAILABLE",
			"INSUFFICIENT_CREDITS",
		])
			expect(canRetrySource(new ORPCError(code))).toBe(false);
		expect(canRetrySource(new Error("This PDF is a scanned image."))).toBe(false);
	});
});

describe("merging and reviewing", () => {
	const base = profile((data) => {
		data.basics.name = "Dewi Lestari";
		data.basics.email = "dewi@example.test";
		data.sections.experience = [experience("own-1", "Kopi Senja Digital", "Senior product designer")];
	});
	const linkedin = profile((data) => {
		data.basics.name = "Dewi L.";
		data.basics.headline = "Product designer";
		data.summary.content = "<p>Six years of product design.</p>";
		data.sections.experience = [
			experience("li-1", "kopi senja  digital", "Senior Product Designer"),
			experience("li-2", "Layanan Kota", "Product designer"),
		];
		data.sections.skills = [skill("li-s1", "Figma")];
	});
	const github = profile((data) => {
		data.sections.skills = [skill("gh-s1", "figma"), skill("gh-s2", "TypeScript")];
	});

	it("merges finished sources in order over the Profile, skipping failed and running ones", () => {
		const merged = mergeSourceResults(base, {
			github: done(github),
			linkedin: done(linkedin),
			website: { status: "failed", key: "k", error: new Error("x") },
			file: { status: "loading", key: "k" },
		});
		expect(merged.basics.name).toBe("Dewi Lestari");
		expect(merged.basics.headline).toBe("Product designer");
		expect(merged.sections.experience.map((item) => item.id)).toEqual(["own-1", "li-2"]);
		// LinkedIn comes before GitHub: its "Figma" wins and GitHub's repeat is left out.
		expect(merged.sections.skills.map((item) => item.name)).toEqual(["Figma", "TypeScript"]);
	});

	it("lists only what's new, by part, with every entry ticked", () => {
		const merged = mergeSourceResults(base, { linkedin: done(linkedin), github: done(github) });
		const groups = reviewGroups(base, merged);
		expect(groups.map((group) => [group.id, group.entries.length])).toEqual([
			["details", 1],
			["summary", 1],
			["experience", 1],
			["skills", 2],
		]);
		expect(countReviewEntries(groups)).toBe(5);
		expect(countReviewEntries(groups, new Set(["summary", "item:li-2"]))).toBe(3);
	});

	it("saves what stayed ticked and keeps the Profile's own parts", () => {
		const merged = mergeSourceResults(base, { linkedin: done(linkedin), github: done(github) });
		const reviewed = applyReview(base, merged, new Set(["basics:headline", "item:li-2", "item:gh-s2"]));
		expect(reviewed.basics.headline).toBe("");
		expect(reviewed.basics.name).toBe("Dewi Lestari");
		expect(reviewed.summary.content).toBe("<p>Six years of product design.</p>");
		expect(reviewed.sections.experience.map((item) => item.id)).toEqual(["own-1"]);
		expect(reviewed.sections.skills.map((item) => item.name)).toEqual(["Figma"]);
		expect(applyReview(base, merged, new Set(["summary"])).summary.content).toBe("");
	});

	it("never takes a photo from the merge: a kept photo is copied first", () => {
		const withPhoto = profile((data) => {
			data.picture.url = "https://example.test/me.jpg";
		});
		const merged = mergeSourceResults(base, { file: done(withPhoto) });
		expect(applyReview(base, merged, new Set()).picture.url).toBe("");
	});

	it("has nothing to review when the sources found nothing new", () => {
		const merged = mergeSourceResults(base, { github: done(profile()) });
		expect(reviewGroups(base, merged)).toEqual([]);
	});

	it("says what one source found", () => {
		expect(sourceFindings(linkedin)).toEqual({
			details: 2,
			summary: true,
			sections: [
				{ type: "experience", count: 2 },
				{ type: "skills", count: 1 },
			],
		});
	});
});

describe("photos", () => {
	it("offers LinkedIn's photo first, then the account's, once each, while the Profile has none", () => {
		const runs: SourceRuns = {
			github: done(profile(), { photoUrl: "https://avatars.githubusercontent.com/u/1" }),
			linkedin: done(profile(), { photoUrl: "https://media.licdn.com/me.jpg" }),
		};
		expect(photoCandidates(emptyProfileData(), runs, "https://avatars.githubusercontent.com/u/1")).toEqual([
			{ source: "linkedin", url: "https://media.licdn.com/me.jpg" },
			{ source: "account", url: "https://avatars.githubusercontent.com/u/1" },
		]);
		const withPhoto = profile((data) => {
			data.picture.url = "/uploads/me.jpg";
		});
		expect(photoCandidates(withPhoto, runs, null)).toEqual([]);
	});
});
