import type { SourceRun, SourceRuns } from "./profile-sources";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { describe, expect, it, vi } from "vite-plus/test";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import {
	applyReview,
	canRetrySource,
	clearEditedProblems,
	countReviewEntries,
	createSourceRunner,
	emptySourceInputs,
	hasSourceInput,
	isFetching,
	keepRequested,
	keptPhoto,
	mergeSourceResults,
	photoCandidates,
	readSourceInputs,
	requestsToRun,
	reviewGroups,
	sourceErrorCode,
	sourceFindings,
	websiteAddress,
	websitePlatform,
	withKeptPhoto,
} from "./profile-sources";

/** The shape of an oRPC error, which the rules read by its `code`. */
class ORPCError extends Error {
	constructor(readonly code: string) {
		super(code);
		this.name = "ORPCError";
	}
}

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
				websiteOwn: false,
			},
			everything,
		);
		expect(problems).toEqual({});
		expect(requests.map((request) => request.id)).toEqual(["file", "linkedin", "github", "website"]);
		expect(requests[2]).toMatchObject({ username: "Dewi-Dev", key: "dewi-dev" });
		expect(requests[3]).toMatchObject({ url: "https://dewi.design/", own: false });
	});

	it("imports an own website's works only where portfolios are open, as another run than reading the page", () => {
		const inputs = { ...emptySourceInputs(), website: "dewi.design", websiteOwn: true };
		expect(readSourceInputs(inputs, everything).requests).toEqual([
			{ id: "website", key: "https://dewi.design/", url: "https://dewi.design/", own: false },
		]);
		expect(readSourceInputs(inputs, { ...everything, websiteImport: true }).requests).toEqual([
			{ id: "website", key: "https://dewi.design/#own", url: "https://dewi.design/", own: true },
		]);
	});

	it("points LinkedIn, Behance and Dribbble addresses away from the website field", () => {
		const read = (website: string) => readSourceInputs({ ...emptySourceInputs(), website }, everything);
		expect(read("www.linkedin.com/in/dewi").problems).toEqual({ website: "linkedin-site" });
		expect(read("behance.net/dewi").problems).toEqual({ website: "platform-site" });
		expect(read("https://dribbble.com/dewi").requests).toEqual([]);
		expect(read("notbehance.net").problems).toEqual({});
		expect(websitePlatform("https://dewi.dribbble.com/")).toBe("dribbble");
		expect(websitePlatform("not a url")).toBeNull();
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
	const website = { id: "website", key: "https://dewi.design/", url: "https://dewi.design/", own: false } as const;

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

describe("app files and errors", () => {
	it("keys an app's picked document by its name, size and address", () => {
		const picked = { name: "cv.pdf", size: 1200, uri: "file:///tmp/cv.pdf" };
		const { requests } = readSourceInputs({ ...emptySourceInputs<typeof picked>(), file: picked }, everything);
		expect(requests).toEqual([{ id: "file", key: "cv.pdf:1200:file:///tmp/cv.pdf", file: picked }]);
	});

	it("reads a server error's code by its shape, never an aborted request's", () => {
		expect(sourceErrorCode(new ORPCError("SOURCE_LIMIT"))).toBe("SOURCE_LIMIT");
		expect(sourceErrorCode(new Error("plain"))).toBeNull();
		expect(sourceErrorCode(Object.assign(new Error("gone"), { name: "AbortError", code: "x" }))).toBeNull();
		expect(sourceErrorCode("SOURCE_LIMIT")).toBeNull();
	});

	it("clears a field's problem once it's edited, and only that one", () => {
		const problems = { linkedin: "unconfirmed", github: "invalid" } as const;
		expect(clearEditedProblems(problems, { linkedinOwn: true })).toEqual({ github: "invalid" });
		expect(clearEditedProblems(problems, { website: "x" })).toEqual(problems);
		expect(clearEditedProblems({ website: "platform-site" }, { websiteOwn: true })).toEqual({});
	});
});

describe("the kept photo", () => {
	const photos = [
		{ source: "linkedin", url: "https://media.licdn.com/a.jpg" },
		{ source: "file", url: "/uploads/b.jpg" },
	] as const;

	it("keeps the first offered until one is picked, and none when picked so", () => {
		expect(keptPhoto([...photos], undefined)).toBe("https://media.licdn.com/a.jpg");
		expect(keptPhoto([...photos], "/uploads/b.jpg")).toBe("/uploads/b.jpg");
		expect(keptPhoto([...photos], null)).toBeNull();
		expect(keptPhoto([...photos], "https://gone.test/c.jpg")).toBe("https://media.licdn.com/a.jpg");
	});

	it("copies a photo from elsewhere once, takes a file's as it is, and leaves out one that fails", async () => {
		const copy = vi.fn(async () => "/uploads/copied.jpg");
		const copied = new Map<string, string>();
		const first = await withKeptPhoto(emptyProfileData(), photos[0], copied, copy);
		const again = await withKeptPhoto(emptyProfileData(), photos[0], copied, copy);
		expect(first.data.picture.url).toBe("/uploads/copied.jpg");
		expect(again.data.picture.url).toBe("/uploads/copied.jpg");
		expect(copy).toHaveBeenCalledTimes(1);
		expect((await withKeptPhoto(emptyProfileData(), photos[1], new Map(), copy)).data.picture.url).toBe(
			"/uploads/b.jpg",
		);
		const failed = await withKeptPhoto(emptyProfileData(), photos[0], new Map(), async () => {
			throw new Error("blocked");
		});
		expect(failed).toEqual({ data: emptyProfileData(), photoFailed: true });
		expect(await withKeptPhoto(emptyProfileData(), null, new Map(), copy)).toEqual({
			data: emptyProfileData(),
			photoFailed: false,
		});
	});
});

describe("the runner", () => {
	const github = { id: "github", key: "dewi-dev", username: "dewi-dev" } as const;
	const result = (name: string): SourceResult => ({
		data: profile((data) => {
			data.basics.name = name;
		}),
		photoUrl: null,
		notes: [],
	});
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("loads, then settles each source on its own, and retries with the same request", async () => {
		const changes: SourceRuns[] = [];
		const fetch = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(result("Dewi"));
		const onError = vi.fn();
		const runner = createSourceRunner({ onChange: (runs) => changes.push(runs), onError });
		runner.run([github], fetch);
		expect(runner.runs().github?.status).toBe("loading");
		await settle();
		expect(runner.runs().github?.status).toBe("failed");
		expect(onError).toHaveBeenCalledWith(expect.any(TypeError), github);
		runner.retry("github");
		await settle();
		expect(runner.runs().github).toMatchObject({ status: "done", key: "dewi-dev" });
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(changes.at(-1)).toBe(runner.runs());
	});

	it("drops the answer of a source cleared or run again meanwhile", async () => {
		let resolveFirst: (value: SourceResult) => void = () => undefined;
		const fetch = vi
			.fn()
			.mockImplementationOnce(() => new Promise<SourceResult>((resolve) => (resolveFirst = resolve)))
			.mockResolvedValue(result("Second"));
		const runner = createSourceRunner({ onChange: () => undefined });
		runner.run([github], fetch);
		await settle();
		runner.run([{ ...github, key: "other", username: "other" }], fetch);
		await settle();
		resolveFirst(result("First"));
		await settle();
		const run = runner.runs().github;
		expect(run?.status === "done" && run.result.data.basics.name).toBe("Second");
		runner.run([], fetch);
		expect(runner.runs()).toEqual({});
	});

	it("keeps finished runs it starts with and doesn't run them again", () => {
		const fetch = vi.fn();
		const initial: SourceRuns = { github: { status: "done", key: "dewi-dev", result: result("Dewi") } };
		const runner = createSourceRunner({ onChange: () => undefined, initial });
		runner.run([github], fetch);
		expect(fetch).not.toHaveBeenCalled();
		expect(runner.runs()).toEqual(initial);
	});
});
