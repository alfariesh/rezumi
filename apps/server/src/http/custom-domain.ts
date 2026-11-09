import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import {
	customDomainDestination,
	isCloudflareSaasEnabled,
	isCustomDomainsEnabled,
	ownHosts,
	traefikConfiguration,
} from "@rezumi/api/features/custom-domain";
import { env } from "@rezumi/env/server";
import { servePortfolioOrResume } from "../static/portfolio-page";
import { onAppDomain } from "./alias";

type Destination = Awaited<ReturnType<typeof customDomainDestination>>;

// Hosts seen recently and where they lead; a minute is how long a new verification takes to show.
const cache = new Map<string, { destination: Destination; expires: number }>();
const CACHE_MS = 60_000;
const CACHE_LIMIT = 5_000;

async function destinationOf(hostname: string): Promise<Destination> {
	const hit = cache.get(hostname);
	if (hit && hit.expires > Date.now()) return hit.destination;
	const destination = await customDomainDestination(hostname);
	if (cache.size >= CACHE_LIMIT) cache.clear();
	cache.set(hostname, { destination, expires: Date.now() + CACHE_MS });
	return destination;
}

const isLoopback = (hostname: string) =>
	hostname === "localhost" || hostname === "[::1]" || (isIP(hostname) === 4 && hostname.startsWith("127."));

const notConnected = () =>
	new Response("This domain isn't connected to a page.", {
		status: 404,
		headers: { "Content-Type": "text/plain; charset=UTF-8", "Cache-Control": "no-store" },
	});

/**
 * A verified custom domain shows the account's published portfolio at `/`, or else its primary resume, and nothing
 * else of the app: the resume PDF downloads and the portfolio's own requests pass through, and any other address goes
 * to the app's own domain. Once the plan's grace is over, the whole domain redirects to the account's address on the
 * app. With Cloudflare for SaaS, traffic for any hostname can reach this Worker, so an address that isn't connected
 * (not verified, or just removed) gets a 404 rather than the app; without it, unknown hosts are left alone.
 */
export async function handleCustomDomain(request: Request, trustedClient: string): Promise<Response | null> {
	if (!isCustomDomainsEnabled()) return null;
	const url = new URL(request.url);
	const automated = isCloudflareSaasEnabled();
	if (ownHosts().has(url.hostname)) {
		// The CNAME target is a place to point records at, not a second address for the app.
		return automated && url.hostname === env.CUSTOM_DOMAIN_TARGET ? Response.redirect(onAppDomain(url), 301) : null;
	}
	// The zone's other names (a wildcard record can send them here) can never be a custom domain; they stay as they were.
	if ([...ownHosts()].some((own) => url.hostname.endsWith(`.${own}`))) return null;
	const destination = await destinationOf(url.hostname);
	if (!destination) return automated && !isLoopback(url.hostname) ? notConnected() : null;
	const { username } = destination;
	if (destination.redirecting)
		return Response.redirect(`${new URL(env.APP_URL).origin}/${encodeURIComponent(username)}`, 302);

	if (
		url.pathname.startsWith("/api/resumes/") ||
		url.pathname.startsWith("/api/portfolio/") ||
		/^\/favicon\.(ico|svg)$/.test(url.pathname)
	)
		return null;
	if (url.pathname === "/robots.txt")
		return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain; charset=UTF-8" } });
	if (url.pathname !== "/") return Response.redirect(onAppDomain(url), 301);

	// Without a portfolio or a primary resume, the page says it isn't shared, as for any address that isn't.
	return servePortfolioOrResume(request, username, trustedClient, { customDomain: url.hostname });
}

const NAME = /^[\w@.-]{1,100}$/;

/**
 * `GET /api/internal/traefik?service=…&entryPoint=…&certResolver=…`: the routers Traefik's HTTP provider polls. The
 * query names the deployment's own Traefik service, entry point and resolver; the secret header keeps it private.
 */
export async function handleTraefikProvider(request: Request): Promise<Response> {
	const secret = env.CUSTOM_DOMAIN_PROVIDER_SECRET;
	// Compared as bytes: a header with non-ASCII characters can match the secret's length in characters but not bytes.
	const given = Buffer.from(request.headers.get("x-provider-secret") ?? "");
	const expected = Buffer.from(secret ?? "");
	if (!secret || !isCustomDomainsEnabled() || given.length !== expected.length || !timingSafeEqual(given, expected))
		return new Response("Not Found", { status: 404 });

	const params = new URL(request.url).searchParams;
	const options = {
		service: params.get("service") ?? "",
		entryPoint: params.get("entryPoint") ?? "websecure",
		certResolver: params.get("certResolver") ?? "letsencrypt",
	};
	if (!Object.values(options).every((value) => NAME.test(value)))
		return new Response("service, entryPoint and certResolver must be Traefik names", { status: 400 });

	return Response.json(await traefikConfiguration(options), { headers: { "Cache-Control": "no-store" } });
}
