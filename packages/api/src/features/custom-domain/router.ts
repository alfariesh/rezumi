import z from "zod";
import { protectedProcedure } from "../../context";
import { accountRateLimit } from "../../middleware/rate-limit";
import { customDomainService } from "./service";
import { suggestCvDomain } from "./suggestion";

const route = { tags: ["Custom Domain"] };
const errors = {
	PRECONDITION_FAILED: { status: 412, message: "Custom domains aren't set up on this server." },
};

const status = z.object({
	hostname: z.string().describe("The domain, as DNS knows it (lowercase ASCII)."),
	target: z.string().describe("The host the domain's CNAME record points at."),
	txtName: z.string().describe("Where the TXT record that proves ownership goes."),
	txtValue: z.string().describe("The TXT record's value."),
	records: z
		.array(
			z.object({
				type: z.enum(["A", "AAAA", "CNAME", "TXT"]),
				name: z.string().describe("The record's full host name."),
				value: z.string(),
			}),
		)
		.describe(
			"Every record to add: the TXT record, and a CNAME to the target, or for a root domain A and AAAA records with its addresses.",
		),
	verified: z.boolean().describe("Whether DNS proved ownership and the domain opens the primary resume."),
	lastCheckedAt: z.date().nullable().describe("When DNS was last checked."),
	managed: z.boolean().describe("Whether this server issues the domain's HTTPS certificate through Cloudflare."),
	stage: z
		.enum(["dns", "hostname", "certificate", "active", "problem"])
		.describe(
			"How far the domain has come: waiting for its DNS records, being set up, waiting for its HTTPS certificate, working, or stopped by a problem.",
		),
	problem: z
		.enum(["dns_moved", "blocked", "caa", "certificate", "quota", "rejected"])
		.nullable()
		.describe("What stopped the domain, when stage is problem."),
	plan: z
		.object({
			state: z
				.enum(["ok", "grace", "redirecting"])
				.describe("Whether the plan covers the domain, it's in its grace after the plan ended, or it now redirects."),
			until: z.date().nullable().describe("When the grace ends."),
		})
		.describe("How the account's plan affects the domain."),
});

const checkedStatus = status.extend({
	dns: z
		.object({
			ownership: z.boolean().describe("Whether the TXT record proving ownership is visible."),
			routing: z.boolean().describe("Whether the domain points at this server."),
		})
		.describe("What this check found in DNS."),
});

export const customDomainRouter = {
	suggestion: protectedProcedure
		.route({ ...route, tags: ["Internal"], method: "GET", path: "/custom-domain/suggestion" })
		.input(z.object({}).optional())
		.use(accountRateLimit)
		.output(
			z
				.object({
					domain: z.string(),
					checked: z.boolean().describe("Whether OlaCV confirmed the domain is free to register."),
					price: z
						.object({
							amount: z.number().describe("The registration fee, for the first year."),
							renewal: z.number().nullable().describe("Each later year's fee, when OlaCV says."),
							currency: z.string(),
						})
						.nullable(),
				})
				.nullable(),
		)
		.handler(({ context }) => suggestCvDomain(context.user.id)),

	get: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/custom-domain",
			operationId: "getCustomDomain",
			summary: "Get the custom domain",
			description:
				"Returns the account's custom domain, the DNS records that connect it, and whether it's verified. A verified domain opens the account's primary resume. Null when none is set. Requires authentication.",
		})
		.input(z.object({}).optional())
		.errors(errors)
		.output(status.nullable())
		.handler(({ context }) => customDomainService.get(context.user.id)),

	set: protectedProcedure
		.route({
			...route,
			method: "PUT",
			path: "/custom-domain",
			operationId: "setCustomDomain",
			summary: "Set the custom domain",
			description:
				"Sets the account's custom domain, replacing any previous one, and returns the DNS records to add: a TXT record that proves ownership, and a CNAME (or, for a root domain on a server without certificate automation, addresses) pointing at this server. Answers PLAN_FEATURE_REQUIRED when the instance has portfolios open to the account and its plan doesn't include custom domains. Requires authentication.",
		})
		.input(z.object({ hostname: z.string().max(260).describe("A domain such as resume.example.com.") }))
		.use(accountRateLimit)
		.errors({
			...errors,
			INVALID_DOMAIN: { status: 400, message: "Enter a domain such as resume.example.com." },
			PLAN_FEATURE_REQUIRED: { status: 403, message: "Custom domains aren't included in your plan." },
		})
		.output(status)
		.handler(({ context, input }) => customDomainService.set(context.user.id, input.hostname)),

	verify: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/custom-domain/verify",
			operationId: "verifyCustomDomain",
			summary: "Check the custom domain's DNS",
			description:
				"Checks the custom domain's DNS records now. When they're right, the domain is verified and opens the account's published portfolio or primary resume, moving it from any other account that had it. Requires authentication.",
		})
		.input(z.object({}).optional())
		.use(accountRateLimit)
		.errors(errors)
		.output(checkedStatus)
		.handler(({ context }) => customDomainService.verify(context.user.id)),

	remove: protectedProcedure
		.route({
			...route,
			method: "DELETE",
			path: "/custom-domain",
			operationId: "removeCustomDomain",
			summary: "Remove the custom domain",
			description: "Removes the account's custom domain; it stops opening the primary resume. Requires authentication.",
		})
		.input(z.object({}).optional())
		.errors(errors)
		.output(z.void())
		.handler(({ context }) => customDomainService.remove(context.user.id)),
};
