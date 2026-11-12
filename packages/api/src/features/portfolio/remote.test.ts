import { afterEach, describe, expect, it, vi } from "vite-plus/test";

/**
 * The real transport with a fake DNS: names that resolve to a private address, and names that don't resolve. Nothing
 * here reaches the network: every name either fails to resolve or resolves to an address the transport refuses.
 */
const dns = vi.hoisted(() => ({
	answers: new Map<string, string[]>(),
	resolve: (hostname: string) => dns.answers.get(hostname.replace(/\.$/, "")) ?? [],
}));
vi.mock("node:dns", async (original) => ({
	...(await original<typeof import("node:dns")>()),
	lookup: (
		hostname: string,
		_options: unknown,
		callback: (error: NodeJS.ErrnoException | null, addresses: { address: string; family: number }[]) => void,
	) => {
		const addresses = dns.resolve(hostname);
		if (!addresses.length)
			return callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" }), []);
		callback(
			null,
			addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
		);
	},
}));
vi.mock("node:dns/promises", async (original) => ({
	...(await original<typeof import("node:dns/promises")>()),
	resolve4: (hostname: string) => Promise.resolve(dns.resolve(hostname).filter((address) => !address.includes(":"))),
	resolve6: (hostname: string) => Promise.resolve(dns.resolve(hostname).filter((address) => address.includes(":"))),
}));

const { fetchRemote, remoteUrl } = await import("./remote");

const read = (url: string) =>
	fetchRemote(new URL(url), {
		signal: AbortSignal.timeout(5000),
		accept: "text/html",
		acceptsType: () => true,
		maxBytes: 1024,
		overflow: "truncate",
	});

afterEach(() => {
	dns.answers.clear();
	vi.unstubAllEnvs();
});

describe("fetchRemote's answer about internal names", () => {
	it.each(["node", "workers"])(
		"is the same for a name that resolves to a private address as for one that doesn't resolve (%s)",
		async (platform) => {
			if (platform === "workers") vi.stubEnv("CLOUDFLARE", "1");
			dns.answers.set("intranet.example.test", ["10.0.0.7"]);
			dns.answers.set("metadata.example.test", ["169.254.169.254"]);
			dns.answers.set("rebind.example.test", ["fd00::1"]);
			const errors = await Promise.all(
				[
					"https://intranet.example.test/",
					"https://metadata.example.test/latest",
					"https://rebind.example.test/",
					"https://missing.example.test/",
				].map((url) =>
					read(url).then(
						() => null,
						(error: { reason?: string; cause?: { cause?: unknown } }) => error,
					),
				),
			);
			expect(errors.map((error) => error?.reason)).toEqual([
				"unreachable",
				"unreachable",
				"unreachable",
				"unreachable",
			]);
			// Inside, the private answers were refused as such (the fake DNS answered); only the reason looks alike.
			if (platform === "node")
				expect(errors.map((error) => error?.cause?.cause === "unsafe-url")).toEqual([true, true, true, false]);
		},
	);
});

describe("remoteUrl", () => {
	it("refuses loopback names written with a trailing dot, and ports other than the scheme's own", () => {
		for (const input of [
			"http://localhost./",
			"http://api.localhost./",
			"https://studio.example.test:8443/",
			"http://studio.example.test:22/",
			"https://studio.example.test:80/",
		])
			expect(remoteUrl(input), input).toBeNull();
		expect(remoteUrl("https://studio.example.test:443/work")?.href).toBe("https://studio.example.test/work");
		expect(remoteUrl("studio.example.test/work#top")?.href).toBe("https://studio.example.test/work");
	});
});

describe("fetchRemote's answer about odd statuses", () => {
	it("reads a status a Response can't hold as a site turning bots away", async () => {
		const failing = (error: Error) => () => Promise.reject(error);
		for (const error of [new TypeError("Invalid response status code 999"), new Error("Invalid response status 999")])
			await expect(
				fetchRemote(new URL("https://site.example.test/"), {
					signal: AbortSignal.timeout(5000),
					accept: "text/html",
					acceptsType: () => true,
					maxBytes: 1024,
					overflow: "truncate",
					hop: failing(error),
				}),
			).rejects.toMatchObject({ name: "RemoteFetchError", reason: "blocked" });
	});
});
