import type { SchemaKit } from "./kit";
import z from "zod";
import { createImageSchema, portfolioPdfKeySchema } from "./files";
import { itemIdSchema } from "./kit";
import { PORTFOLIO_LIMITS, PORTFOLIO_UPLOAD } from "./limits";
import { webUrlSchema } from "./links";
import { createMetricSchema } from "./metric";
import {
	isVideoThumbnailUrl,
	VIDEO_PROVIDERS,
	VIMEO_HASH_PATTERN,
	VIMEO_ID_PATTERN,
	YOUTUBE_ID_PATTERN,
} from "./video";

const { text: max } = PORTFOLIO_LIMITS;

/** The kinds of block a work's detail is made of (`02-teknis.md` section 16), in the order the editor offers them. */
export const PORTFOLIO_BLOCK_TYPES = ["text", "images", "metrics", "video", "pdf", "link"] as const;
export type PortfolioBlockType = (typeof PORTFOLIO_BLOCK_TYPES)[number];

export const IMAGE_BLOCK_LAYOUTS = ["full", "grid", "carousel"] as const;

/** A brand logo from the resume's brand icon set, by name. The page ignores names it doesn't know. */
export const brandIconSchema = z
	.string()
	.regex(/^[\da-z-]{1,64}$/, "Use a brand icon name.")
	.describe("A brand logo from the resume icon set, such as 'behance' or 'github'.");

export function createBlockSchema(kit: SchemaKit) {
	const image = createImageSchema(kit);
	const metric = createMetricSchema(kit);

	return z.discriminatedUnion("type", [
		z.object({
			id: itemIdSchema,
			type: z.literal("text"),
			html: kit.field(kit.richText(max.blockText), "").describe("Rich text as HTML (paragraphs, H2/H3, lists, links)."),
		}),
		z.object({
			id: itemIdSchema,
			type: z.literal("images"),
			images: kit.list(
				image.extend({ caption: kit.optional(kit.text(max.caption)) }),
				PORTFOLIO_LIMITS.imagesPerBlock,
				{ min: 1 },
			),
			layout: kit.field(z.enum(IMAGE_BLOCK_LAYOUTS), "full"),
		}),
		z.object({
			id: itemIdSchema,
			type: z.literal("metrics"),
			items: kit.list(metric, PORTFOLIO_LIMITS.metricsPerBlock, { id: (item) => item.id, min: 1 }),
		}),
		z
			.object({
				id: itemIdSchema,
				type: z.literal("video"),
				provider: z.enum(VIDEO_PROVIDERS),
				videoId: z.string(),
				hash: kit.optional(z.string().regex(VIMEO_HASH_PATTERN)).describe("The hash of an unlisted Vimeo video."),
				title: kit.optional(kit.text(max.mediaTitle)),
				thumbnailUrl: kit
					.optional(z.string().refine(isVideoThumbnailUrl, "Use the video's own thumbnail."))
					.describe("The thumbnail on YouTube's or Vimeo's image server, for the editor only."),
				thumbnail: kit
					.optional(image)
					.describe(
						"A copy of the thumbnail in the portfolio's storage. The page shows only this, so visitors reach no other site before they press play.",
					),
			})
			// Not a write-only rule: a block with a bad ID can never play, so stored data drops it too.
			.refine((block) => (block.provider === "youtube" ? YOUTUBE_ID_PATTERN : VIMEO_ID_PATTERN).test(block.videoId), {
				message: "This isn't a YouTube or Vimeo video ID.",
				path: ["videoId"],
			}),
		z.object({
			id: itemIdSchema,
			type: z.literal("pdf"),
			file: portfolioPdfKeySchema,
			title: kit.field(kit.text(max.mediaTitle), ""),
			pages: z.number().int().min(1).max(PORTFOLIO_LIMITS.pdfPages).describe("How many pages the PDF has."),
			bytes: kit.optional(z.number().int().min(1).max(PORTFOLIO_UPLOAD.pdfBytes)).describe("The PDF's size in bytes."),
			preview: kit.optional(image).describe("A picture of the first page."),
		}),
		z.object({
			id: itemIdSchema,
			type: z.literal("link"),
			url: webUrlSchema,
			title: kit.field(kit.text(max.linkTitle), ""),
			description: kit.optional(kit.text(max.linkDescription)),
			siteName: kit.optional(kit.text(max.siteName)),
			image: kit.optional(image).describe("A preview image, copied to the portfolio's own storage."),
			brandIcon: kit.optional(brandIconSchema),
		}),
	]);
}

export type PortfolioBlock = z.output<ReturnType<typeof createBlockSchema>>;
export type PortfolioBlockOf<T extends PortfolioBlockType> = Extract<PortfolioBlock, { type: T }>;
