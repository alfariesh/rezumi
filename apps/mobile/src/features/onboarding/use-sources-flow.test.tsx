// The sources flow behind onboarding and Profile → Bring what you have: what a review saves when the Profile changed
// since the review was built. The API is replaced; the shared source rules are the real ones.
import type { SavedOnboarding } from "./saved-run";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourceResult } from "@rezumi/schema/profile/sources";
import { renderHook } from "@testing-library/react-native";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { useSourcesFlow } from "./use-sources-flow";

jest.mock("@/api/client", () => ({
	client: { profile: { sources: { adoptPhoto: jest.fn(async ({ url }: { url: string }) => ({ url })) } } },
}));
jest.mock("./read-file", () => ({ readResumeFile: jest.fn() }));

const project = (id: string, name: string) =>
	({
		id,
		hidden: false,
		name,
		period: "",
		website: { url: "", label: "", inlineLink: false },
		description: "",
		options: { showLinkInTitle: false },
	}) as never;

const found = (): SourceResult => {
	const data = emptyProfileData();
	data.basics.headline = "Data analyst";
	data.sections.projects = [project("p-ledger", "ledger")];
	return { data, photoUrl: null, notes: [] };
};

const restore: SavedOnboarding = {
	step: "review",
	inputs: { linkedin: "", linkedinOwn: false, github: "ayu-dev", website: "" },
	answers: { targetRoles: [], locations: [], maxOfficeDays: null },
	runs: { github: { status: "done", key: "ayu-dev", result: found() } },
	rerun: [],
	excluded: [],
	template: "meridian",
	savedAt: null,
};

const flowFor = (base: ProfileData, excluded: string[] = []) =>
	renderHook(() =>
		useSourcesFlow({
			base,
			availability: { linkedin: false, github: true, website: false },
			accountImage: null,
			github: "",
			aiAvailable: false,
			restore: { ...restore, excluded },
		}),
	);

describe("useSourcesFlow finish", () => {
	it("adds what was kept to the Profile it was reviewed against", async () => {
		const base = emptyProfileData();
		base.basics.name = "Ayu Pratiwi";
		const { result } = await flowFor(base);
		const { data } = await result.current.finish(new Map());
		expect(data.basics.name).toBe("Ayu Pratiwi");
		expect(data.sections.projects.map((item) => item.name)).toEqual(["ledger"]);
	});

	it("adds it onto a newer Profile without losing what was saved in between", async () => {
		const base = emptyProfileData();
		base.basics.name = "Ayu Pratiwi";
		const { result } = await flowFor(base);

		// Saved on the web while the review was open: a new project, a location and a photo.
		const newer = structuredClone(base);
		newer.basics.location = "Bandung";
		newer.picture.url = "/uploads/me.jpg";
		newer.sections.projects = [project("p-web", "from the web")];

		const { data } = await result.current.finish(new Map(), newer);
		expect(data.basics.location).toBe("Bandung");
		expect(data.basics.headline).toBe("Data analyst");
		expect(data.picture.url).toBe("/uploads/me.jpg");
		expect(data.sections.projects.map((item) => item.name)).toEqual(["from the web", "ledger"]);
	});

	it("leaves out what was unticked on the newer Profile too", async () => {
		const base = emptyProfileData();
		const { result } = await flowFor(base, ["item:p-ledger", "basics:headline"]);
		const newer = structuredClone(base);
		newer.sections.projects = [project("p-web", "from the web")];
		const { data } = await result.current.finish(new Map(), newer);
		expect(data.basics.headline).toBe("");
		expect(data.sections.projects.map((item) => item.name)).toEqual(["from the web"]);
	});
});
