import z from "zod";
import { profileDataSchema, profilePartSchema } from "@rezumi/schema/profile/data";
import { protectedProcedure } from "../../context";
import { profileService } from "./service";

const profileOutput = z.object({
	data: profileDataSchema,
	updatedAt: z.date().nullable().describe("The version to send back with a save; null until the first save."),
});

const saveOutput = profileOutput.extend({
	updatedResumes: z
		.array(z.object({ id: z.string(), name: z.string() }))
		.describe("The resumes whose linked parts followed this change."),
});

const resumeInput = z.object({ resumeId: z.string().min(1).describe("A resume the account owns, not in Trash.") });

export const profileRouter = {
	get: protectedProcedure
		.route({
			method: "GET",
			path: "/profile",
			tags: ["Profile"],
			operationId: "getProfile",
			summary: "Get the Profile",
			description:
				"Returns the account's Profile: the person's details and career history that resumes, cover letters and the portfolio take their content from. An account that never saved one gets its sign-up name and email, with `updatedAt` null.",
		})
		.input(z.object({}).optional())
		.output(profileOutput)
		.handler(({ context }) => profileService.read(context.user.id)),

	update: protectedProcedure
		.route({
			method: "PUT",
			path: "/profile",
			tags: ["Profile"],
			operationId: "updateProfile",
			summary: "Save the Profile",
			description:
				"Replaces the Profile's data. Every resume part that still read like the Profile before the change takes the new value; parts a resume made its own, locked resumes and resumes in Trash are left as they are. Send `expectedUpdatedAt` (the `updatedAt` you read, null before the first save) to get PROFILE_VERSION_CONFLICT instead of overwriting a change made elsewhere.",
		})
		.input(
			z.object({
				data: profileDataSchema,
				expectedUpdatedAt: z.coerce.date().nullable().optional(),
			}),
		)
		.output(saveOutput)
		.errors({
			PROFILE_VERSION_CONFLICT: {
				status: 409,
				message: "The Profile changed after it was read. Read it again, then save.",
			},
		})
		.handler(({ context, input }) => profileService.update(context.user.id, input)),

	savePart: protectedProcedure
		.route({
			method: "POST",
			path: "/profile/parts",
			tags: ["Profile"],
			operationId: "saveProfilePart",
			summary: "Save a resume's part to the Profile",
			description:
				"Makes one resume's version of a part (a basics field, the photo, the summary or one item) the Profile's. Other resumes still linked to that part follow. Reads the resume as saved, so save pending edits first.",
		})
		.input(resumeInput.extend({ part: profilePartSchema }))
		.output(saveOutput)
		.handler(({ context, input }) => profileService.savePart(context.user.id, input)),

	fillFromResume: protectedProcedure
		.route({
			method: "POST",
			path: "/profile/fill",
			tags: ["Profile"],
			operationId: "fillProfileFromResume",
			summary: "Fill the Profile from a resume",
			description:
				"Adds what the Profile still lacks from one resume: blank basics, a missing photo or summary, and sections that have no items yet. Nothing already in the Profile changes.",
		})
		.input(resumeInput)
		.output(saveOutput)
		.handler(({ context, input }) => profileService.fillFromResume(context.user.id, input)),
};
