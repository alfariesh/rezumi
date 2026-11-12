import type { DbOrTx } from "@rezumi/db/client";
import { randomBytes } from "node:crypto";
import { resolve4, resolve6, resolveCname, resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { env } from "@rezumi/env/server";
import { assertFeature } from "../billing/limits";
import { getPortfolioMode, isPortfolioEnabledFor } from "../portfolio/mode";
import { ownerIsNotBanned } from "../resume/access-policy";
import { isCloudflareSaasEnabled } from "./cloudflare";
import { clearedHostname, queueHostnameRemoval, syncHostname } from "./hostnames";
import { connectionStageOf, PLAN_GRACE_DAYS, planStateOf, toConnectionProblem } from "./lifecycle";

export { isCloudflareSaasEnabled };

const TXT_PREFIX = "_rx-verify";
const DAY_MS = 24 * 60 * 60 * 1000;
// A verified domain whose DNS stops pointing here keeps working this long, in case the owner is mid-change.
const GRACE_MS = 7 * DAY_MS;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const isCustomDomainsEnabled = () =>
	Boolean(env.CUSTOM_DOMAIN_TARGET && (env.CUSTOM_DOMAIN_PROVIDER_SECRET || isCloudflareSaasEnabled()));

/**
 * Whether the app offers connecting a domain. On a deployment with the Cloudflare automation, each hostname costs
 * money, so a domain is a portfolio feature there: with portfolios off, nothing changes from before they existed.
 */
export const isCustomDomainOffered = () =>
	isCustomDomainsEnabled() && (!isCloudflareSaasEnabled() || getPortfolioMode() !== "off");

let hosts: ReadonlySet<string> | undefined;
/** The app's own hostnames (APP_URL, APP_ALIAS_URL, the CNAME target): none of them, or anything under them, is a custom domain. */
export const ownHosts = (): ReadonlySet<string> =>
	(hosts ??= new Set(
		[env.APP_URL, env.APP_ALIAS_URL, env.CUSTOM_DOMAIN_TARGET && `https://${env.CUSTOM_DOMAIN_TARGET}`]
			.filter((value): value is string => Boolean(value))
			.map((value) => new URL(value).hostname),
	));

/**
 * A typed domain as the host DNS knows: lowercase ASCII, no scheme, path, port or trailing dot. `null` when it can't be
 * a public domain (an IP address, a single label, the app's own hosts).
 */
export function normalizeHostname(input: string): string | null {
	const value = input.trim();
	let ascii: string;
	try {
		// The URL parser lowercases, converts to punycode and drops the port, path, query and fragment.
		ascii = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`).hostname.replace(/\.$/, "");
	} catch {
		return null;
	}
	if (!ascii || ascii.length > 253 || isIP(ascii)) return null;
	const labels = ascii.split(".");
	if (labels.length < 2 || !labels.every((label) => LABEL.test(label))) return null;
	if (!/^[a-z][a-z0-9-]*$/.test(labels.at(-1) ?? "")) return null;
	for (const own of ownHosts()) if (ascii === own || ascii.endsWith(`.${own}`)) return null;
	return ascii;
}

const lookup = <T>(query: Promise<T[]>) => query.catch(() => [] as T[]);

const txtValue = (token: string) => `rx-verify=${token}`;

export type DnsRecord = { type: "A" | "AAAA" | "CNAME" | "TXT"; name: string; value: string };

/**
 * What to add where the domain's DNS is managed: a TXT record proving ownership, and a CNAME to the target. A root
 * domain can't have a CNAME, so it gets A and AAAA records with the target's addresses instead. Not with Cloudflare for
 * SaaS, which can't serve a root domain from addresses below Enterprise: there the CNAME stands, for DNS providers that
 * flatten it at the root, and the app suggests `www`.
 */
async function connectionRecords(hostname: string, token: string): Promise<DnsRecord[]> {
	const target = env.CUSTOM_DOMAIN_TARGET ?? "";
	const proof: DnsRecord = { type: "TXT", name: `${TXT_PREFIX}.${hostname}`, value: txtValue(token) };
	// ponytail: two labels is a root domain; one under a two-part suffix (example.co.uk) gets the CNAME, and the
	// client's note explains the addresses. A public-suffix list would tell them apart.
	if (hostname.split(".").length === 2 && !isCloudflareSaasEnabled()) {
		const [v4, v6] = await Promise.all([lookup(resolve4(target)), lookup(resolve6(target))]);
		const addresses = [
			...v4.map((value): DnsRecord => ({ type: "A", name: hostname, value })),
			...v6.map((value): DnsRecord => ({ type: "AAAA", name: hostname, value })),
		];
		if (addresses.length > 0) return [...addresses, proof];
	}
	return [{ type: "CNAME", name: hostname, value: target }, proof];
}

async function toStatus(domain: typeof schema.customDomain.$inferSelect) {
	const managed = isCloudflareSaasEnabled();
	return {
		hostname: domain.hostname,
		target: env.CUSTOM_DOMAIN_TARGET ?? "",
		txtName: `${TXT_PREFIX}.${domain.hostname}`,
		txtValue: txtValue(domain.verificationToken),
		records: await connectionRecords(domain.hostname, domain.verificationToken),
		verified: domain.verifiedAt !== null,
		lastCheckedAt: domain.lastCheckedAt,
		managed,
		stage: connectionStageOf(domain, managed),
		problem: managed ? toConnectionProblem(domain.cfProblem) : null,
		plan: planStateOf(domain.planLapsedAt, new Date()),
	};
}

const notSetUp = () =>
	new ORPCError("PRECONDITION_FAILED", { status: 412, message: "Custom domains aren't set up on this server." });

const assertEnabled = () => {
	if (!isCustomDomainsEnabled()) throw notSetUp();
};

type DnsCheck = { ownership: boolean; routing: boolean };

/** Whether DNS proves `token`'s account owns `hostname`, and whether it points the domain at this server. */
async function checkDns(hostname: string, token: string): Promise<DnsCheck> {
	const target = env.CUSTOM_DOMAIN_TARGET;
	if (!target) return { ownership: false, routing: false };
	const txt = (await lookup(resolveTxt(`${TXT_PREFIX}.${hostname}`))).map((parts) => parts.join(""));
	const ownership = txt.includes(txtValue(token));

	const cnames = (await lookup(resolveCname(hostname))).map((name) => name.toLowerCase().replace(/\.$/, ""));
	if (cnames.includes(target)) return { ownership, routing: true };
	// A root domain can't have a CNAME: its addresses must be the target's.
	const [own4, own6, target4, target6] = await Promise.all([
		lookup(resolve4(hostname)),
		lookup(resolve6(hostname)),
		lookup(resolve4(target)),
		lookup(resolve6(target)),
	]);
	const targets = new Set([...target4, ...target6]);
	const addresses = [...own4, ...own6];
	return { ownership, routing: addresses.length > 0 && addresses.every((address) => targets.has(address)) };
}

const dnsProves = (dns: DnsCheck) => dns.ownership && dns.routing;

/** Reads nothing while portfolios are off. */
async function isPortfolioOpenTo(userId: string) {
	const mode = getPortfolioMode();
	if (mode === "off") return false;
	const [account] = await db
		.select({ role: schema.user.role, isAnonymous: schema.user.isAnonymous })
		.from(schema.user)
		.where(eq(schema.user.id, userId));
	return Boolean(account && isPortfolioEnabledFor(account, mode));
}

/** On a deployment with the automation, an account portfolios aren't open to sees custom domains as not set up. */
async function assertAvailable(userId: string) {
	assertEnabled();
	if (isCloudflareSaasEnabled() && !(await isPortfolioOpenTo(userId))) throw notSetUp();
}

/**
 * Connecting a domain is a paid feature from the day portfolios open to the account (`00-keputusan.md` rule #3); until
 * then accounts connect one as before, so `PORTFOLIO_MODE=off` changes nothing.
 */
async function assertCanConnect(userId: string) {
	if (await isPortfolioOpenTo(userId)) await assertFeature(userId, "customDomain");
}

export const customDomainService = {
	get: async (userId: string) => {
		await assertAvailable(userId);
		const [domain] = await db.select().from(schema.customDomain).where(eq(schema.customDomain.userId, userId));
		return domain ? toStatus(domain) : null;
	},

	/** Claims a domain for the account, replacing its previous one. It works once `verify` sees the DNS records. */
	set: async (userId: string, input: string) => {
		await assertAvailable(userId);
		const hostname = normalizeHostname(input);
		if (!hostname)
			throw new ORPCError("INVALID_DOMAIN", { status: 400, message: "Enter a domain such as resume.example.com." });

		const [existing] = await db.select().from(schema.customDomain).where(eq(schema.customDomain.userId, userId));
		if (existing?.hostname === hostname) return toStatus(existing);
		await assertCanConnect(userId);

		const values = {
			hostname,
			verificationToken: randomBytes(16).toString("hex"),
			verifiedAt: null,
			lastCheckedAt: null,
			failingSince: null,
			...clearedHostname,
		};
		const domain = await db.transaction(async (tx) => {
			const [previous] = await tx
				.select()
				.from(schema.customDomain)
				.where(eq(schema.customDomain.userId, userId))
				.for("update");
			if (previous) await queueHostnameRemoval(tx, previous);
			const [saved] = await tx
				.insert(schema.customDomain)
				.values({ userId, ...values })
				.onConflictDoUpdate({ target: schema.customDomain.userId, set: values })
				.returning();
			return saved;
		});
		if (!domain) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return toStatus(domain);
	},

	/** Checks DNS now. Proof moves the domain from any other account that had it, since DNS shows who owns it today. */
	verify: async (userId: string) => {
		await assertAvailable(userId);
		const [domain] = await db.select().from(schema.customDomain).where(eq(schema.customDomain.userId, userId));
		if (!domain) throw new ORPCError("NOT_FOUND");
		// Connecting needs the plan; checking a domain that's already connected doesn't (the plan job decides when it stops).
		if (!domain.verifiedAt) await assertCanConnect(userId);

		const dns = await checkDns(domain.hostname, domain.verificationToken);
		const valid = dnsProves(dns);
		const now = new Date();
		const updated = await db.transaction(async (tx) => {
			const [current] = await tx
				.select()
				.from(schema.customDomain)
				.where(
					and(
						eq(schema.customDomain.userId, userId),
						eq(schema.customDomain.hostname, domain.hostname),
						eq(schema.customDomain.verificationToken, domain.verificationToken),
					),
				)
				.for("update");
			if (!current)
				throw new ORPCError("CONFLICT", { message: "The domain changed during verification. Verify it again." });
			const failingSince = current.failingSince ?? now;
			const lostProof = !valid && now.getTime() - failingSince.getTime() > GRACE_MS;
			// Proof moves the domain here, and its hostname with it: the previous account must not delete it later.
			const movedHostname = valid ? await takeHostnameFromOthers(tx, domain.hostname, userId) : null;
			if (lostProof) await queueHostnameRemoval(tx, current);
			const [row] = await tx
				.update(schema.customDomain)
				.set(
					valid
						? {
								verifiedAt: current.verifiedAt ?? now,
								lastCheckedAt: now,
								failingSince: null,
								...(movedHostname ? { cfHostnameId: movedHostname } : {}),
							}
						: {
								lastCheckedAt: now,
								failingSince,
								...(lostProof ? { verifiedAt: null, ...clearedHostname } : {}),
							},
				)
				.where(eq(schema.customDomain.userId, userId))
				.returning();
			return row;
		});
		if (!updated) throw new ORPCError("NOT_FOUND");
		// So the steps move as soon as DNS is right, and "Check" reads Cloudflare; the job carries on from here.
		return {
			...(await toStatus(valid ? await syncHostname(updated, now, { restartValidation: true }) : updated)),
			dns,
		};
	},

	remove: async (userId: string) => {
		assertEnabled();
		await db.transaction(async (tx) => {
			const [removed] = await tx.delete(schema.customDomain).where(eq(schema.customDomain.userId, userId)).returning();
			if (removed) await queueHostnameRemoval(tx, removed);
		});
	},
};

/** Unverifies the domain on every other account; the Cloudflare hostname one of them holds, if any, is returned. */
async function takeHostnameFromOthers(tx: DbOrTx, hostname: string, userId: string): Promise<string | null> {
	const others = and(eq(schema.customDomain.hostname, hostname), ne(schema.customDomain.userId, userId));
	// Read first: an UPDATE's RETURNING gives the cleared values.
	const holders = await tx
		.select({ cfHostnameId: schema.customDomain.cfHostnameId })
		.from(schema.customDomain)
		.where(others)
		.for("update");
	await tx
		.update(schema.customDomain)
		.set({ verifiedAt: null, ...clearedHostname })
		.where(others);
	return holders.find((holder) => holder.cfHostnameId)?.cfHostnameId ?? null;
}

/**
 * Whether a domain is connected: proven, and with the automation, its hostname and certificate active. The one rule for
 * whether it answers at all (`customDomainDestination`) and, within its plan, where search engines are sent
 * (`domainIsLive`), so a domain never serves pages while canonical links and the sitemap point elsewhere.
 */
const domainIsConnected = () =>
	and(
		isNotNull(schema.customDomain.verifiedAt),
		isCloudflareSaasEnabled()
			? and(eq(schema.customDomain.cfHostnameStatus, "active"), eq(schema.customDomain.cfSslStatus, "active"))
			: undefined,
	);

/**
 * Whether a domain really opens the account's pages: connected (`domainIsConnected`) and still within its plan's
 * grace. Where search engines are sent, so never a domain that redirects or doesn't work yet.
 */
export const domainIsLive = () =>
	and(
		domainIsConnected(),
		or(
			isNull(schema.customDomain.planLapsedAt),
			gt(schema.customDomain.planLapsedAt, sql`now() - make_interval(days => ${PLAN_GRACE_DAYS})`),
		),
	);

/**
 * The resume owner's verified custom domain, as a column of a query on `resume`: where its primary resume lives for
 * search engines. Null when custom domains are off.
 */
export const verifiedDomainColumn = () =>
	isCustomDomainsEnabled()
		? sql<
				string | null
			>`(select ${schema.customDomain.hostname} from ${schema.customDomain} where ${schema.customDomain.userId} = ${schema.resume.userId} and ${domainIsLive()})`
		: sql<string | null>`null`;

/**
 * Where a connected custom domain leads (`domainIsConnected`, the rule `domainIsLive` builds on): whose pages it opens,
 * and whether it only redirects to their app address now that the plan's grace is over. `null` for an unknown host or
 * one whose hostname or certificate isn't active yet.
 */
export async function customDomainDestination(
	hostname: string,
	now = new Date(),
): Promise<{ username: string; redirecting: boolean } | null> {
	if (!isCustomDomainsEnabled()) return null;
	const [owner] = await db
		.select({ username: schema.user.username, planLapsedAt: schema.customDomain.planLapsedAt })
		.from(schema.customDomain)
		.innerJoin(schema.user, eq(schema.customDomain.userId, schema.user.id))
		.where(and(eq(schema.customDomain.hostname, hostname.toLowerCase()), domainIsConnected(), ownerIsNotBanned()));
	return owner
		? { username: owner.username, redirecting: planStateOf(owner.planLapsedAt, now).state === "redirecting" }
		: null;
}

/**
 * Traefik's HTTP provider configuration: one router per verified domain, each asking the certificate resolver for its
 * own certificate. Domains not checked for a day are checked again in the background; one failing for a week loses its
 * verification, which takes its router away.
 */
export async function traefikConfiguration(options: { service: string; entryPoint: string; certResolver: string }) {
	const domains = await db
		.select({ userId: schema.customDomain.userId, hostname: schema.customDomain.hostname })
		.from(schema.customDomain)
		.where(isNotNull(schema.customDomain.verifiedAt));

	void recheckStaleDomains().catch((error: unknown) => console.warn("Custom domain re-check failed", error));

	const routers = Object.fromEntries(
		domains.map(({ userId, hostname }) => [
			`custom-domain-${userId}`,
			{
				rule: `Host(\`${hostname}\`)`,
				entryPoints: [options.entryPoint],
				service: options.service,
				tls: { certResolver: options.certResolver },
			},
		]),
	);
	// Traefik rejects an empty map ("routers cannot be a standalone element"), but accepts an empty document.
	return domains.length > 0 ? { http: { routers } } : {};
}

let rechecking = false;

/** Domains not checked for a day, and what follows from a week of failing. Run by the job, or Traefik's polling. */
export async function recheckStaleDomains() {
	if (rechecking) return;
	rechecking = true;
	try {
		const stale = await db
			.select()
			.from(schema.customDomain)
			.where(
				and(
					isNotNull(schema.customDomain.verifiedAt),
					or(
						isNull(schema.customDomain.lastCheckedAt),
						lt(schema.customDomain.lastCheckedAt, new Date(Date.now() - DAY_MS)),
					),
				),
			)
			.limit(20);
		for (const domain of stale) {
			const now = new Date();
			const unchanged = and(
				eq(schema.customDomain.userId, domain.userId),
				eq(schema.customDomain.hostname, domain.hostname),
				eq(schema.customDomain.verificationToken, domain.verificationToken),
				domain.lastCheckedAt === null
					? isNull(schema.customDomain.lastCheckedAt)
					: eq(schema.customDomain.lastCheckedAt, domain.lastCheckedAt),
			);
			if (dnsProves(await checkDns(domain.hostname, domain.verificationToken))) {
				await db.update(schema.customDomain).set({ lastCheckedAt: now, failingSince: null }).where(unchanged);
				continue;
			}
			const failingSince = domain.failingSince ?? now;
			const lostProof = now.getTime() - failingSince.getTime() > GRACE_MS;
			await db.transaction(async (tx) => {
				// Locked and read again: a hostname may have been made since the list above was read.
				const [current] = await tx.select().from(schema.customDomain).where(unchanged).for("update");
				if (!current) return;
				if (lostProof) await queueHostnameRemoval(tx, current);
				await tx
					.update(schema.customDomain)
					.set({ lastCheckedAt: now, failingSince, ...(lostProof ? { verifiedAt: null, ...clearedHostname } : {}) })
					.where(unchanged);
			});
		}
	} finally {
		rechecking = false;
	}
}
