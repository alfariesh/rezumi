import { describe, expect, it } from "vite-plus/test";
import { parseGitHubProfile } from "./github";

// A fictional account, with the fields GitHub's REST API returns.
const user = {
	login: "budi-example",
	name: "Budi Santoso",
	bio: "Backend developer. Likes Go.",
	blog: "budi.example",
	location: "Jakarta",
	email: null,
	html_url: "https://github.com/budi-example",
	twitter_username: "budi_x",
	public_repos: 9,
};

const repo = (name: string, extra: Record<string, unknown> = {}) => ({
	name,
	description: `${name} description`,
	html_url: `https://github.com/budi-example/${name}`,
	homepage: null,
	language: "Go",
	fork: false,
	archived: false,
	stargazers_count: 0,
	pushed_at: "2026-01-01T00:00:00Z",
	owner: { login: "budi-example" },
	...extra,
});

describe("parseGitHubProfile", () => {
	it("reads the account's details and links", () => {
		const data = parseGitHubProfile({ user, repos: [] });
		expect(data.basics).toMatchObject({
			name: "Budi Santoso",
			location: "Jakarta",
			email: "",
			website: { url: "https://budi.example/", label: "" },
		});
		expect(data.summary.content).toBe("<p>Backend developer. Likes Go.</p>");
		expect(data.sections.profiles.items.map((item) => [item.network, item.username])).toEqual([
			["GitHub", "budi-example"],
			["X", "budi_x"],
		]);
		expect(data.sections.projects.items).toEqual([]);
	});

	it("takes six own repositories, most starred then most recent, and their languages as skills", () => {
		const repos = [
			repo("fork", { fork: true, stargazers_count: 99 }),
			repo("old", { archived: true, stargazers_count: 50 }),
			repo("other", { owner: { login: "someone-else" }, stargazers_count: 40 }),
			repo("star", { stargazers_count: 30, language: "TypeScript", homepage: "https://star.example" }),
			repo("recent", { pushed_at: "2026-06-01T00:00:00Z", language: "TypeScript" }),
			repo("a"),
			repo("b", { language: null }),
			repo("c", { language: "Rust" }),
			repo("d"),
			repo("e"),
			{ nonsense: true },
		];
		const data = parseGitHubProfile({ user, repos });
		expect(data.sections.projects.items.map((item) => item.name)).toEqual(["star", "recent", "a", "b", "c", "d"]);
		expect(data.sections.projects.items[0]).toMatchObject({
			website: { url: "https://star.example/" },
			description: "<p>star description</p>",
		});
		expect(data.sections.skills.items.map((item) => item.name)).toEqual(["Go", "TypeScript", "Rust"]);
	});

	it("falls back to the login for the name and reads anything else as empty", () => {
		const data = parseGitHubProfile({ user: { login: "x-only", name: 5 }, repos: "not a list" });
		expect(data.basics.name).toBe("x-only");
		expect(data.sections.skills.items).toEqual([]);
		expect(parseGitHubProfile({ user: null, repos: null }).sections.profiles.items).toEqual([]);
	});
});
