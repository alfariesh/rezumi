import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as tables from "@rezumi/db/schema";

const TOKEN = "integration-test-token";
const ZONE = "b".repeat(32);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const fixture = vi.hoisted(() => ({
	db: undefined as ReturnType<typeof drizzle> | undefined,
	billing: "on" as "off" | "admins" | "on",
	portfolio: "on" as "off" | "admins" | "on",
	automated: true,
	txt: new Map<string, string[]>(),
	cname: new Map<string, string[]>(),
}));

vi.mock("@rezumi/db/client", () => ({
	get db() {
		return fixture.db;
	},
}));
vi.mock("node:dns/promises", () => ({
	resolveTxt: (name: string) => {
		const values = fixture.txt.get(name);
		return values ? Promise.resolve(values.map((value) => [value])) : Promise.reject(new Error("ENOTFOUND"));
	},
	resolveCname: (name: string) => {
		const values = fixture.cname.get(name);
		return values ? Promise.resolve(values) : Promise.reject(new Error("ENOTFOUND"));
	},
	resolve4: () => Promise.resolve([]),
	resolve6: () => Promise.resolve([]),
}));
vi.mock("@rezumi/env/server", async () => {
	const actual = await vi.importActual<typeof import("@rezumi/env/server")>("@rezumi/env/server");
	return {
		...actual,
		env: {
			...actual.env,
			APP_URL: "https://rezumi.test",
			CUSTOM_DOMAIN_TARGET: "domains.rezumi.test",
			CUSTOM_DOMAIN_PROVIDER_SECRET: undefined,
			get CLOUDFLARE_SAAS_ZONE_ID() {
				return fixture.automated ? "b".repeat(32) : undefined;
			},
			get CLOUDFLARE_SAAS_API_TOKEN() {
				return fixture.automated ? "integration-test-token" : undefined;
			},
			get PORTFOLIO_MODE() {
				return fixture.portfolio;
			},
			get BILLING_MODE() {
				return fixture.billing;
			},
		},
	};
});
vi.mock("@rezumi/auth/config", () => ({
	auth: { $context: Promise.resolve({ secretConfig: "test" }) },
	isCustomOAuthProviderEnabled: () => false,
}));
vi.mock("../storage/service", () => ({ getStorageService: () => ({ delete: () => Promise.resolve(true) }) }));
vi.mock("../billing/deletion", () => ({ endBillingForDeletedUser: () => Promise.resolve() }));

type FakeHostname = { id: string; hostname: string; status: string; ssl: { status: string } };

/** Cloudflare's custom hostnames API, kept in memory. */
class FakeCloudflare {
	hostnames = new Map<string, FakeHostname>();
	calls: string[] = [];
	refuseNext: { status: number; code: number } | null = null;
	settle: { status: string; ssl: { status: string; validation_errors?: { message: string }[] } } = {
		status: "pending",
		ssl: { status: "pending_validation" },
	};

	private json(status: number, body: object) {
		return new Response(JSON.stringify(body), { status });
	}

	private refuse(status: number, code: number) {
		return this.json(status, { success: false, result: null, errors: [{ code, message: "Refused" }] });
	}

	private ok(result: unknown, status = 200) {
		return this.json(status, { success: true, result, errors: [] });
	}

	fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
		const method = init?.method ?? "GET";
		this.calls.push(`${method} ${url.pathname.split("custom_hostnames")[1]}${url.search}`);
		if (new Headers(init?.headers).get("authorization") !== `Bearer ${TOKEN}`)
			throw new Error("The request carried the wrong token.");
		if (!url.pathname.includes(`/zones/${ZONE}/custom_hostnames`))
			throw new Error("The request went to the wrong zone.");
		return Promise.resolve(this.handle(method, url, init));
	};

	private handle(method: string, url: URL, init?: RequestInit): Response {
		if (this.refuseNext) {
			const { status, code } = this.refuseNext;
			this.refuseNext = null;
			return this.refuse(status, code);
		}
		const id = url.pathname.split("custom_hostnames/")[1];
		if (method === "POST") {
			const { hostname } = JSON.parse(String(init?.body)) as { hostname: string };
			if ([...this.hostnames.values()].some((row) => row.hostname === hostname)) return this.refuse(409, 1406);
			const row = { id: randomUUID(), hostname, status: "pending", ssl: { status: "initializing" } };
			this.hostnames.set(row.id, row);
			return this.ok(row, 201);
		}
		if (method === "GET" && !id)
			return this.ok([...this.hostnames.values()].filter((row) => row.hostname === url.searchParams.get("hostname")));
		const row = id ? this.hostnames.get(id) : undefined;
		if (!row) return this.refuse(404, 1436);
		if (method === "GET" || method === "PATCH") {
			Object.assign(row, this.settle);
			return this.ok(row);
		}
		this.hostnames.delete(row.id);
		return this.ok({ id: row.id });
	}

	hostnameNamed(hostname: string) {
		return [...this.hostnames.values()].find((row) => row.hostname === hostname);
	}

	postCount() {
		return this.calls.filter((call) => call.startsWith("POST")).length;
	}
}

const databaseUrl = process.env.PORTFOLIO_TEST_DATABASE_URL;

function getDb() {
	if (!fixture.db) throw new Error("Test database is not initialized.");
	return fixture.db;
}

// Opt-in real PostgreSQL tests: all tables live in an isolated schema that the suite drops afterwards.
describe.skipIf(!databaseUrl)("custom domains with Cloudflare for SaaS", () => {
	let service: typeof import("./service").customDomainService;
	let destination: typeof import("./service").customDomainDestination;
	let domainIsLive: typeof import("./service").domainIsLive;
	let isOffered: typeof import("./service").isCustomDomainOffered;
	let runJobs: typeof import("./jobs").runCustomDomainJobs;
	let billingAdmin: typeof import("../billing/admin").billingAdmin;
	let authService: typeof import("../auth/service").authService;
	let admin: Pool;
	let pool: Pool;
	let cloudflare: FakeCloudflare;
	const schemaName = `custom_domain_test_${randomUUID().replaceAll("-", "")}`;
	const usernameSuffix = randomUUID().slice(0, 8);
	const site = "www.nadia.example";

	const later = (ms: number) => new Date(Date.now() + ms);

	// Long enough to outlast the job's simulated dates.
	const grantPlus = (userId = "member") =>
		billingAdmin.grantPeriod({ actorUserId: "owner", userId, planId: "plus", days: 90, reason: "Test" });
	const endPlans = (userId = "member") =>
		getDb()
			.update(tables.membershipPeriod)
			.set({ revokedAt: new Date() })
			.where(eq(tables.membershipPeriod.userId, userId));

	const rowOf = async (userId = "member") => {
		const [row] = await getDb().select().from(tables.customDomain).where(eq(tables.customDomain.userId, userId));
		if (!row) throw new Error("No domain row.");
		return row;
	};
	const removals = () => getDb().select().from(tables.customDomainRemoval);

	/** Publishes the records the status asks for, as the domain's owner would. */
	const publishDns = (status: { txtName: string; txtValue: string; hostname: string }) => {
		fixture.txt.set(status.txtName, [status.txtValue]);
		fixture.cname.set(status.hostname, ["domains.rezumi.test"]);
	};

	/** A verified domain with its hostname made. */
	const connect = async (userId = "member", hostname = site) => {
		publishDns(await service.set(userId, hostname));
		return service.verify(userId);
	};

	const isLive = async (userId = "member") => {
		const rows = await getDb()
			.select({ hostname: tables.customDomain.hostname })
			.from(tables.customDomain)
			.where(eq(tables.customDomain.userId, userId))
			.then((found) => found.length);
		if (rows !== 1) throw new Error("No domain row.");
		const [row] = await getDb()
			.select({ hostname: tables.customDomain.hostname })
			.from(tables.customDomain)
			.where(domainIsLive());
		return row?.hostname === site;
	};

	beforeAll(async () => {
		admin = new Pool({ connectionString: databaseUrl });
		await admin.query(`CREATE SCHEMA ${schemaName}`);
		pool = new Pool({
			connectionString: databaseUrl,
			max: 12,
			options: `-c search_path=${schemaName} -c statement_timeout=10000`,
		});
		fixture.db = drizzle({ client: pool });
		const migrations = new URL("../../../../../migrations/", import.meta.url);
		const directories = (await readdir(migrations, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
			.map((entry) => entry.name)
			.sort();
		for (const directory of directories) {
			const file = new URL(`${directory}/migration.sql`, migrations);
			if (existsSync(file)) await pool.query((await readFile(file, "utf8")).replaceAll('"public".', ""));
		}
		({
			customDomainService: service,
			customDomainDestination: destination,
			domainIsLive,
			isCustomDomainOffered: isOffered,
		} = await import("./service"));
		({ runCustomDomainJobs: runJobs } = await import("./jobs"));
		({ billingAdmin } = await import("../billing/admin"));
		({ authService } = await import("../auth/service"));
	}, 30_000);

	afterAll(async () => {
		await pool?.end();
		await admin?.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
		await admin?.end();
	});

	beforeEach(async () => {
		fixture.billing = "on";
		fixture.portfolio = "on";
		fixture.automated = true;
		fixture.txt.clear();
		fixture.cname.clear();
		cloudflare = new FakeCloudflare();
		vi.stubGlobal("fetch", cloudflare.fetch);
		await pool.query('TRUNCATE "user", released_username, custom_domain_removal CASCADE');
		await getDb()
			.insert(tables.user)
			.values(
				[
					{ id: "member", role: "user" },
					{ id: "other", role: "user" },
					{ id: "owner", role: "admin" },
				].map((account) => ({
					...account,
					name: `${account.id} name`,
					email: `${account.id}@example.test`,
					emailVerified: true,
					username: `cd-${account.id}-${usernameSuffix}`,
					displayUsername: `cd-${account.id}-${usernameSuffix}`,
				})),
			);
		await grantPlus();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	describe("connecting", () => {
		it("makes the hostname once DNS is right and follows it to active", async () => {
			const waiting = await service.set("member", site);
			expect(waiting).toMatchObject({ managed: true, stage: "dns", verified: false });
			expect(cloudflare.hostnames.size).toBe(0);

			publishDns(waiting);
			const checked = await service.verify("member");
			expect(checked).toMatchObject({ verified: true, stage: "hostname", dns: { ownership: true, routing: true } });
			const made = cloudflare.hostnameNamed(site);
			expect(made).toBeDefined();
			expect((await rowOf()).cfHostnameId).toBe(made?.id);

			cloudflare.settle = { status: "active", ssl: { status: "pending_issuance" } };
			await runJobs(later(5 * 60_000));
			expect(await service.get("member")).toMatchObject({ stage: "certificate" });

			cloudflare.settle = { status: "active", ssl: { status: "active" } };
			await runJobs(later(10 * 60_000));
			expect(await service.get("member")).toMatchObject({ stage: "active", problem: null });
			expect(await isLive()).toBe(true);
		});

		it("says which record is missing and makes no hostname", async () => {
			const waiting = await service.set("member", site);
			fixture.txt.set(waiting.txtName, [waiting.txtValue]);
			expect(await service.verify("member")).toMatchObject({
				verified: false,
				stage: "dns",
				dns: { ownership: true, routing: false },
			});
			expect(cloudflare.calls).toEqual([]);
		});

		it("always gives a root domain a CNAME, since addresses can't work below Enterprise", async () => {
			const status = await service.set("member", "nadia.example");
			expect(status.records.map((record) => record.type)).toEqual(["CNAME", "TXT"]);
		});

		it("gives up its proof after a week of failing DNS and lets go of the hostname", async () => {
			await connect();
			const id = (await rowOf()).cfHostnameId;
			await getDb()
				.update(tables.customDomain)
				.set({ failingSince: new Date(Date.now() - 8 * DAY) })
				.where(eq(tables.customDomain.userId, "member"));
			fixture.cname.clear();

			expect(await service.verify("member")).toMatchObject({ verified: false, stage: "dns" });
			expect((await rowOf()).cfHostnameId).toBeNull();
			expect((await removals()).map((removal) => removal.cfHostnameId)).toEqual([id]);
		});
	});

	describe("what Cloudflare answers", () => {
		it("explains a CAA record stopping the certificate", async () => {
			await connect();
			cloudflare.settle = {
				status: "active",
				ssl: {
					status: "pending_validation",
					validation_errors: [{ message: "caa_error: CAA record prevents issuance" }],
				},
			};
			await runJobs(later(5 * 60_000));
			expect(await service.get("member")).toMatchObject({ stage: "problem", problem: "caa" });
			expect(await isLive()).toBe(false);
		});

		it("restarts a failed validation when asked to check again", async () => {
			await connect();
			cloudflare.settle = { status: "active", ssl: { status: "validation_timed_out" } };
			await runJobs(later(5 * 60_000));
			expect(await service.get("member")).toMatchObject({ stage: "problem", problem: "certificate" });

			cloudflare.settle = { status: "active", ssl: { status: "active" } };
			cloudflare.calls = [];
			expect(await service.verify("member")).toMatchObject({ stage: "active", problem: null });
			expect(cloudflare.calls.some((call) => call.startsWith("PATCH"))).toBe(true);
		});

		it("reports a full quota, then connects by itself once there's room", async () => {
			publishDns(await service.set("member", site));
			cloudflare.refuseNext = { status: 403, code: 1405 };
			expect(await service.verify("member")).toMatchObject({ verified: true, stage: "problem", problem: "quota" });
			expect((await rowOf()).cfHostnameId).toBeNull();

			await runJobs(later(2 * HOUR));
			expect(await service.get("member")).toMatchObject({ stage: "hostname", problem: null });
			expect(cloudflare.hostnameNamed(site)).toBeDefined();
		});

		it("keeps a wrong token to the log, without the token, and retries", async () => {
			const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
			publishDns(await service.set("member", site));
			cloudflare.refuseNext = { status: 403, code: 9109 };
			expect(await service.verify("member")).toMatchObject({ verified: true, stage: "hostname", problem: null });
			const output = JSON.stringify(logged.mock.calls);
			expect(output).toContain("auth");
			expect(output).not.toContain(TOKEN);

			await runJobs(later(2 * HOUR));
			expect(cloudflare.hostnameNamed(site)).toBeDefined();
		});

		it("adopts a hostname that's already there instead of failing", async () => {
			cloudflare.hostnames.set("left-over", {
				id: "left-over",
				hostname: site,
				status: "active",
				ssl: { status: "active" },
			});
			await connect();
			expect((await rowOf()).cfHostnameId).toBe("left-over");
			expect(await service.get("member")).toMatchObject({ stage: "active" });
		});

		it("makes the hostname again when Cloudflare no longer has it", async () => {
			await connect();
			cloudflare.hostnames.clear();
			await runJobs(later(5 * 60_000));
			expect((await rowOf()).cfHostnameId).toBeNull();
			await runJobs(later(6 * 60_000));
			expect(cloudflare.hostnameNamed(site)).toBeDefined();
			expect((await rowOf()).cfHostnameId).toBe(cloudflare.hostnameNamed(site)?.id);
		});
	});

	describe("the job", () => {
		it("makes one hostname however many runs overlap", async () => {
			publishDns(await service.set("member", site));
			cloudflare.refuseNext = { status: 503, code: 1500 };
			await service.verify("member");
			expect(cloudflare.hostnames.size).toBe(0);

			const time = later(2 * HOUR);
			await Promise.all([runJobs(time), runJobs(time), runJobs(time)]);
			expect(cloudflare.hostnames.size).toBe(1);
			expect(cloudflare.postCount()).toBeLessThanOrEqual(2);
			expect((await rowOf()).cfHostnameId).toBe(cloudflare.hostnameNamed(site)?.id);
		});

		it("does nothing again until the hostname is due", async () => {
			await connect();
			cloudflare.calls = [];
			await runJobs(later(30_000));
			expect(cloudflare.calls).toEqual([]);
		});

		it("makes no hostname for an account portfolios aren't open to", async () => {
			fixture.portfolio = "admins";
			await getDb().insert(tables.customDomain).values({
				userId: "member",
				hostname: site,
				verificationToken: "t",
				verifiedAt: new Date(),
			});
			await runJobs(later(HOUR));
			expect(cloudflare.hostnames.size).toBe(0);
		});
	});

	describe("letting a domain go", () => {
		it("deletes the hostname when the domain is removed", async () => {
			await connect();
			await service.remove("member");
			expect(cloudflare.hostnameNamed(site)).toBeDefined();
			await runJobs(later(60_000));
			expect(cloudflare.hostnames.size).toBe(0);
			expect(await removals()).toEqual([]);
		});

		it("deletes the old hostname when the domain is replaced", async () => {
			await connect();
			await service.set("member", "cv.nadia.example");
			expect((await rowOf()).cfHostnameId).toBeNull();
			await runJobs(later(60_000));
			expect(cloudflare.hostnameNamed(site)).toBeUndefined();
		});

		it("deletes the hostname when the account is deleted", async () => {
			await connect();
			await authService.deleteAccount({ userId: "member" });
			expect(await getDb().select().from(tables.customDomain)).toEqual([]);
			expect(await removals()).toHaveLength(1);
			await runJobs(later(60_000));
			expect(cloudflare.hostnames.size).toBe(0);
		});

		it("retries a failed delete later, and counts a hostname already gone as done", async () => {
			await connect();
			await service.remove("member");
			cloudflare.refuseNext = { status: 503, code: 1500 };
			await runJobs(later(60_000));
			expect(await removals()).toHaveLength(1);
			expect(cloudflare.hostnames.size).toBe(1);

			cloudflare.hostnames.clear();
			await runJobs(later(2 * HOUR));
			expect(await removals()).toEqual([]);
		});

		it("never deletes a hostname another row uses", async () => {
			await connect();
			const id = (await rowOf()).cfHostnameId as string;
			await getDb().insert(tables.customDomainRemoval).values({ cfHostnameId: id, hostname: site });
			await runJobs(later(60_000));
			expect(cloudflare.hostnames.has(id)).toBe(true);
		});
	});

	describe("answers that arrive too late", () => {
		it("lets go of a hostname that came back after the domain lost its proof", async () => {
			publishDns(await service.set("member", site));
			cloudflare.refuseNext = { status: 503, code: 1500 };
			await service.verify("member");
			// The job's call is out when the week of failing DNS ends.
			const original = cloudflare.fetch;
			vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
				const response = await original(input, init);
				await getDb()
					.update(tables.customDomain)
					.set({ verifiedAt: null })
					.where(eq(tables.customDomain.userId, "member"));
				return response;
			});
			await runJobs(later(2 * HOUR));

			// Not written onto the row that lost its proof: queued and deleted in the same run.
			expect((await rowOf()).cfHostnameId).toBeNull();
			expect(cloudflare.calls.some((call) => call.startsWith("DELETE"))).toBe(true);
			expect(cloudflare.hostnames.size).toBe(0);
			expect(await removals()).toEqual([]);
		});
	});

	describe("a domain moving to another account", () => {
		it("takes the hostname along, so the old owner can't delete it", async () => {
			await connect();
			const id = (await rowOf()).cfHostnameId;
			await grantPlus("other");

			const claim = await service.set("other", site);
			publishDns(claim);
			await service.verify("other");

			const previous = await rowOf("member");
			expect(previous.verifiedAt).toBeNull();
			expect(previous.cfHostnameId).toBeNull();
			expect((await rowOf("other")).cfHostnameId).toBe(id);
			expect(cloudflare.postCount()).toBe(1);

			await service.remove("member");
			await runJobs(later(60_000));
			expect(cloudflare.hostnames.has(id as string)).toBe(true);
		});
	});

	describe("when the plan ends", () => {
		const check = (ms: number) => runJobs(later(ms));

		beforeEach(async () => {
			await connect();
			cloudflare.settle = { status: "active", ssl: { status: "active" } };
			await check(5 * 60_000);
			await endPlans();
			await check(2 * HOUR);
		});

		it("keeps working through the grace, saying until when", async () => {
			const status = await service.get("member");
			expect(status?.plan.state).toBe("grace");
			expect(status?.plan.until?.getTime()).toBeGreaterThan(later(6 * DAY).getTime());
			expect(await destination(site)).toMatchObject({ redirecting: false });
			expect(await isLive()).toBe(true);
		});

		it("redirects after seven days and stops telling search engines about it", async () => {
			await expect(destination(site, later(8 * DAY))).resolves.toMatchObject({ redirecting: true });
			await getDb()
				.update(tables.customDomain)
				.set({ planLapsedAt: new Date(Date.now() - 8 * DAY) })
				.where(eq(tables.customDomain.userId, "member"));
			expect(await isLive()).toBe(false);
			expect(cloudflare.hostnames.size).toBe(1);
			expect((await service.get("member"))?.plan.state).toBe("redirecting");
		});

		it("deletes the hostname 37 days later, keeps the domain, and brings it back on renewal", async () => {
			await check(38 * DAY);
			expect(cloudflare.hostnames.size).toBe(0);
			const row = await rowOf();
			expect(row.cfHostnameId).toBeNull();
			expect(row.verifiedAt).not.toBeNull();
			expect(row.planLapsedAt).not.toBeNull();

			cloudflare.calls = [];
			await check(39 * DAY);
			expect(cloudflare.postCount()).toBe(0);

			await grantPlus();
			await check(40 * DAY);
			await check(40 * DAY + 11 * 60_000);
			expect((await rowOf()).planLapsedAt).toBeNull();
			expect(cloudflare.hostnameNamed(site)).toBeDefined();
			expect((await service.get("member"))?.plan.state).toBe("ok");
		});

		it("clears the clock when the plan comes back within the grace", async () => {
			await grantPlus();
			await check(4 * HOUR);
			expect((await rowOf()).planLapsedAt).toBeNull();
			expect(cloudflare.hostnames.size).toBe(1);
		});
	});

	describe("who can use it", () => {
		it("hides it everywhere while portfolios are off", async () => {
			fixture.portfolio = "off";
			expect(isOffered()).toBe(false);
			await expect(service.get("member")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			await expect(service.set("member", site)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		});

		it("is only for admins while admins test", async () => {
			fixture.portfolio = "admins";
			expect(isOffered()).toBe(true);
			await expect(service.get("member")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			await expect(service.get("owner")).resolves.toBeNull();
		});

		it("needs the plan to connect", async () => {
			await endPlans();
			await expect(service.set("member", site)).rejects.toMatchObject({ code: "PLAN_FEATURE_REQUIRED" });
		});
	});

	describe("without the Cloudflare automation", () => {
		it("verifies by DNS alone, as before, and calls nothing", async () => {
			fixture.automated = false;
			// Without the automation custom domains also need the Traefik secret; this suite proves the rest of the path.
			const { env } = await import("@rezumi/env/server");
			Object.defineProperty(env, "CUSTOM_DOMAIN_PROVIDER_SECRET", { value: "x".repeat(32), configurable: true });
			try {
				const status = await service.set("member", "nadia.example");
				expect(status.managed).toBe(false);
				publishDns(status);
				expect(await service.verify("member")).toMatchObject({ verified: true, stage: "active", managed: false });
				await runJobs(later(2 * HOUR));
				expect(cloudflare.calls).toEqual([]);
			} finally {
				Object.defineProperty(env, "CUSTOM_DOMAIN_PROVIDER_SECRET", { value: undefined, configurable: true });
			}
		});
	});
});
