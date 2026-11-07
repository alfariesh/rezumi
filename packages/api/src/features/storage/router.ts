import { ORPCError } from "@orpc/server";
import z from "zod";
import { MAX_UPLOADED_FONT_BYTES } from "@rezumi/fonts/uploaded";
import { reachesPortfolioFiles } from "@rezumi/schema/portfolio/files";
import { protectedProcedure } from "../../context";
import { storageDeleteRateLimit, storageUploadRateLimit } from "../../middleware/rate-limit";
import { assertFeature } from "../billing/limits";
import { getStorageService, isImageFile, processImageForUpload, uploadFile, uploadFontFile } from "./service";

const fileSchema = z.file().max(10 * 1024 * 1024, "File size must be less than 10MB");

const filenameSchema = z.object({
	filename: z.string().min(1).describe("The path or filename of the file to delete."),
});

function normalizeKey(input: string): string {
	return input.trim().replace(/^\/+/, "").split("/").filter(Boolean).join("/");
}

function isUnsafeStorageKey(key: string): boolean {
	return key.split("/").some((segment) => segment === "." || segment === "..");
}

export const uploadFileOutputSchema = z.object({
	url: z.string().describe("The download URL. Profile images are public; other files require owner authentication."),
	path: z.string().describe("The storage path of the uploaded file."),
	contentType: z.string().describe("The MIME type of the uploaded file."),
});

export const uploadFontOutputSchema = z.object({
	url: z.string().describe("The public download URL of the font file."),
	path: z.string().describe("The storage path of the uploaded file."),
	family: z.string().describe("The font's family name, read from the file."),
	weight: z.enum(["100", "200", "300", "400", "500", "600", "700", "800", "900"]).describe("The face's weight."),
	italic: z.boolean().describe("Whether the face is italic."),
	format: z.enum(["ttf", "otf"]).describe("The file's format."),
});

export const storageRouter = {
	uploadFont: protectedProcedure
		.route({
			tags: ["Internal"],
			operationId: "uploadFont",
			summary: "Upload a font",
			description:
				"Uploads one TrueType or OpenType font face for use in documents and returns its family, weight and style as read from the file. Fonts whose licence forbids embedding are refused. Maximum file size is 8MB. Needs a plan that includes your own fonts. Requires authentication.",
			successDescription: "The font was uploaded successfully.",
		})
		.input(z.file().max(MAX_UPLOADED_FONT_BYTES, "Font files must be smaller than 8 MB."))
		.use(storageUploadRateLimit)
		.output(uploadFontOutputSchema)
		.handler(async ({ context, input: file }) => {
			await assertFeature(context.user.id, "customFonts");
			return uploadFontFile(context.user.id, file);
		}),

	uploadFile: protectedProcedure
		.route({
			tags: ["Internal"],
			operationId: "uploadFile",
			summary: "Upload a file",
			description:
				"Uploads a file to storage. Images are automatically resized and converted to JPEG format. Maximum file size is 10MB. Requires authentication.",
			successDescription: "The file was uploaded successfully.",
		})
		.input(fileSchema)
		.use(storageUploadRateLimit)
		.output(uploadFileOutputSchema)
		.handler(async ({ context, input: file }) => {
			const originalMimeType = file.type;
			const isImage = isImageFile(originalMimeType);

			let data: Uint8Array;
			let contentType: string;

			if (isImage) {
				const processed = await processImageForUpload(file);
				data = processed.data;
				contentType = processed.contentType;
			} else {
				const fileBuffer = await file.arrayBuffer();
				data = new Uint8Array(fileBuffer);
				contentType = originalMimeType;
			}

			const result = await uploadFile({ userId: context.user.id, data, contentType });

			return {
				url: result.url,
				path: result.key,
				contentType,
			};
		}),

	deleteFile: protectedProcedure
		.route({
			tags: ["Internal"],
			operationId: "deleteFile",
			summary: "Delete a file",
			description:
				"Deletes a file from storage by its filename or path. If the filename does not start with 'uploads/', the user's picture directory is assumed. Requires authentication.",
			successDescription: "The file was deleted successfully.",
		})
		.input(filenameSchema)
		.use(storageDeleteRateLimit)
		.output(z.void())
		.errors({
			NOT_FOUND: {
				message: "The specified file was not found in storage.",
				status: 404,
			},
			FORBIDDEN: {
				message: "You do not have permission to delete this file.",
				status: 403,
			},
		})
		.handler(async ({ context, input }): Promise<void> => {
			const requestedKey = normalizeKey(input.filename);
			const key = requestedKey.startsWith("uploads/")
				? requestedKey
				: normalizeKey(`uploads/${context.user.id}/pictures/${requestedKey}`);
			const userPrefix = `uploads/${context.user.id}/`;

			if (isUnsafeStorageKey(key) || !key.startsWith(userPrefix)) {
				throw new ORPCError("FORBIDDEN");
			}
			// Portfolio files are recorded in `portfolio_file` (storage quota, cleanup, what the public route serves), so
			// only the portfolio API deletes them, never a key or folder here.
			if (reachesPortfolioFiles(context.user.id, key)) {
				throw new ORPCError("FORBIDDEN", {
					message: "Portfolio files are deleted through the portfolio, which keeps track of them.",
				});
			}

			const deleted = await getStorageService().delete(key);

			if (!deleted) throw new ORPCError("NOT_FOUND");
		}),
};
