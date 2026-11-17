import { describe, expect, it } from "vite-plus/test";
import { guardSetup, SETUP_UNLOCK_PATH } from "./setup-lock";

const TOKEN = "t".repeat(40);
const site = "https://blog.rezumi.app";

const request = (path: string, init: RequestInit = {}, origin = site) => new Request(`${origin}${path}`, init);

const unlockCookie = async () => {
	const body = new FormData();
	body.set("token", TOKEN);
	const response = await guardSetup(request(SETUP_UNLOCK_PATH, { method: "POST", body }), { BLOG_SETUP_TOKEN: TOKEN });
	return response?.headers.get("set-cookie")?.split(";")[0] ?? "";
};

describe("guardSetup", () => {
	it("leaves every other route to EmDash", async () => {
		for (const path of ["/", "/hello-world", "/_emdash/admin", "/_emdash/api/content/posts", "/_emdash/api/setupx"])
			expect(await guardSetup(request(path, { method: "POST" }), {}), path).toBeNull();
	});

	it("refuses the setup API on the public site without the token, even with a secret configured", async () => {
		for (const env of [{}, { BLOG_SETUP_TOKEN: TOKEN }, { BLOG_SETUP_TOKEN: "short" }])
			for (const path of ["/_emdash/api/setup", "/_emdash/api/setup/admin", "/_emdash/api/setup/admin/verify"]) {
				const response = await guardSetup(request(path, { method: "POST" }), env);
				expect(response?.status, path).toBe(403);
			}
		const forged = await guardSetup(
			request("/_emdash/api/setup/admin", { method: "POST", headers: { cookie: "__Host-rezumi_setup=wrong" } }),
			{ BLOG_SETUP_TOKEN: TOKEN },
		);
		expect(forged?.status).toBe(403);
	});

	it("keeps the status check open", async () => {
		expect(await guardSetup(request("/_emdash/api/setup/status"), {})).toBeNull();
		expect((await guardSetup(request("/_emdash/api/setup/status", { method: "POST" }), {}))?.status).toBe(403);
	});

	it("opens setup only for the browser that entered the right token", async () => {
		const env = { BLOG_SETUP_TOKEN: TOKEN };
		const wrong = new FormData();
		wrong.set("token", "x".repeat(40));
		expect((await guardSetup(request(SETUP_UNLOCK_PATH, { method: "POST", body: wrong }), env))?.status).toBe(403);

		const cookie = await unlockCookie();
		expect(cookie).toMatch(/^__Host-rezumi_setup=/);
		const admin = request("/_emdash/api/setup/admin", { method: "POST", headers: { cookie } });
		expect(await guardSetup(admin, env)).toBeNull();
		// Once the secret is deleted after setup, the old cookie opens nothing.
		const after = request("/_emdash/api/setup/admin", { method: "POST", headers: { cookie } });
		expect((await guardSetup(after, {}))?.status).toBe(403);
	});

	it("hides the unlock page when no token is configured", async () => {
		expect((await guardSetup(request(SETUP_UNLOCK_PATH), {}))?.status).toBe(404);
		expect((await guardSetup(request(SETUP_UNLOCK_PATH), { BLOG_SETUP_TOKEN: TOKEN }))?.status).toBe(200);
	});

	it("leaves local development to EmDash's own rules", async () => {
		const local = request("/_emdash/api/setup/admin", { method: "POST" }, "http://localhost:4321");
		expect(await guardSetup(local, {})).toBeNull();
	});
});
