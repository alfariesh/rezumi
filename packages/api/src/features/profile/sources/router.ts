import z from "zod";
import { sourceResultSchema, sourcesStatusSchema } from "@rezumi/schema/profile/sources";
import { protectedProcedure } from "../../../context";
import { aiRequestRateLimit, storageUploadRateLimit } from "../../../middleware/rate-limit";
import { aiErrors } from "../../ai/procedure";
import { aiSourceInput } from "../../billing/ai-source";
import { assertNotGuest } from "./account";
import { SOURCE_ERRORS } from "./errors";
import { readGitHub } from "./github";
import { readLinkedIn } from "./linkedin";
import { adoptPhoto } from "./photo";
import { sourcesStatus } from "./status";
import { readWebsite } from "./website";

// The onboarding's own calls: kept out of the public API and its OpenAPI spec.
const route = { tags: ["Internal"] };

/**
 * Filling the Profile from outside sources. Each read returns a draft (`SourceResult`) for the person to review;
 * nothing here writes the Profile. The app merges drafts with `mergeProfileData` and saves with `profile.update`.
 */
export const profileSourcesRouter = {
	status: protectedProcedure
		.route({
			...route,
			method: "GET",
			path: "/profile/sources",
			operationId: "getProfileSources",
			summary: "Which sources can fill the Profile",
			description:
				"Which sources this account can read (LinkedIn needs the server's Apify token; guests get GitHub only) and what its sign-ins already tell: name, email, photo, linked GitHub login and providers.",
		})
		.input(z.object({}).optional())
		.output(sourcesStatusSchema)
		.handler(({ context }) => sourcesStatus(context.user.id)),

	linkedin: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/profile/sources/linkedin",
			operationId: "readProfileSourceLinkedin",
			summary: "Read the person's LinkedIn profile",
			description:
				"Reads the public LinkedIn profile at a linkedin.com/in/ address (or its identifier) into Profile data to review. Three reads per account per day. Not for guests.",
		})
		.input(
			z.object({ url: z.string().trim().min(1).max(300).describe("A linkedin.com/in/ address, or its identifier.") }),
		)
		.errors(SOURCE_ERRORS)
		.output(sourceResultSchema)
		.handler(async ({ context, input, signal }) => {
			await assertNotGuest(context.user.id);
			return readLinkedIn(context.user.id, input.url, signal);
		}),

	github: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/profile/sources/github",
			operationId: "readProfileSourceGithub",
			summary: "Read a GitHub account",
			description:
				"Reads a GitHub account into Profile data to review: details, the account under Profiles, its best own repositories as projects and their languages as skills. Ten reads per account per day.",
		})
		.input(
			z.object({
				username: z.string().trim().min(1).max(200).describe("A GitHub username, @username or github.com/ address."),
			}),
		)
		.errors(SOURCE_ERRORS)
		.output(sourceResultSchema)
		.handler(({ context, input, signal }) => readGitHub(context.user.id, input.username, signal)),

	website: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/profile/sources/website",
			operationId: "readProfileSourceWebsite",
			summary: "Read the person's website",
			description:
				"Reads a public web page and has AI turn what it says about the person into Profile data to review, adding nothing the page doesn't state. Not for guests. (2 credits on Rezumi AI)",
		})
		.use(aiRequestRateLimit)
		.input(z.object({ url: z.string().trim().min(1).max(2048).describe("The page's address."), ...aiSourceInput }))
		.errors({ ...aiErrors, ...SOURCE_ERRORS })
		.output(sourceResultSchema)
		.handler(async ({ context, input, signal }) => {
			await assertNotGuest(context.user.id);
			return readWebsite(context.user.id, input, signal);
		}),

	adoptPhoto: protectedProcedure
		.route({
			...route,
			method: "POST",
			path: "/profile/sources/photo",
			operationId: "adoptProfileSourcePhoto",
			summary: "Keep a source's photo",
			description:
				"Copies a photo a source returned (from LinkedIn, GitHub or Google) into the account's uploads, as an uploaded resume photo is stored, and returns its address there. The app's own upload addresses come back as they are.",
		})
		.use(storageUploadRateLimit)
		.input(z.object({ url: z.string().trim().min(1).max(2048).describe("The photo's address at the source.") }))
		.errors(SOURCE_ERRORS)
		.output(z.object({ url: z.string().describe("The photo's address in the account's uploads.") }))
		.handler(({ context, input, signal }) => adoptPhoto(context.user.id, input.url, { signal })),
};
