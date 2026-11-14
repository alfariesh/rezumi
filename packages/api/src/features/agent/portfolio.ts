import type { PortfolioAiState } from "../portfolio/service";
import type {
	EditPortfolioInput,
	EditPortfolioOutput,
	PortfolioEditCard,
	SaveAttachmentImageInput,
	SaveAttachmentImageOutput,
} from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioEdit } from "@rezumi/schema/portfolio/edits";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { UIMessage } from "ai";
import { applyPortfolioEdits, portfolioAiView } from "@rezumi/portfolio/edits";
import { portfolioFileKeys } from "@rezumi/portfolio/files";
import { generateId } from "@rezumi/utils/string";
import { PORTFOLIO_DOCUMENT_NAME } from "./document";

/**
 * The portfolio assistant's side of a reply (Phase 14, `phase-14-asisten-ai.md` §4.2). A reply works on a copy of the
 * saved portfolio (the editor saves before each message), loaded on first use: `edit_portfolio` applies edits to the
 * copy in strict mode and returns them resolved, and the editor replays them on its store, which saves them. The
 * server never writes the portfolio for the assistant, so the editor stays its only writer while it's open.
 */

/** Pictures `save_attachment_image` takes, by the type the attachment was uploaded with: what the portfolio stores. */
const PORTFOLIO_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** The most pictures one reply stores: a gallery's worth. Each counts toward the plan's storage until it's placed. */
export const MAX_SAVED_IMAGES_PER_REPLY = 10;

/**
 * Settings that show the owner's private details on the page, by edit path, with where the owner switches them on.
 * The assistant may switch them off, never on: a page, attachment or CV it reads could ask it to publish a phone
 * number or send visitors' messages elsewhere, and its edits apply at once.
 */
const PRIVATE_DETAILS = {
	"contact.email": "Content → Contact",
	"contact.phone": "Content → Contact",
	"contact.website": "Content → Contact",
	"contact.profiles": "Content → Contact",
	"contact.whatsapp": "Content → Contact",
	"hero.showLocation": "Content → Intro",
} as const;
type PrivateDetail = keyof typeof PRIVATE_DETAILS;

type DetailsShown = {
	[K in Exclude<PrivateDetail, "contact.whatsapp">]: boolean;
} & { "contact.whatsapp": { show: boolean; number: string } };

const detailsShown = (data: PortfolioData): DetailsShown => ({
	"contact.email": data.contact.email,
	"contact.phone": data.contact.phone,
	"contact.website": data.contact.website,
	"contact.profiles": data.contact.profiles,
	"contact.whatsapp": { show: data.contact.whatsapp.show, number: data.contact.whatsapp.number },
	"hero.showLocation": data.hero.showLocation,
});

const isPrivateDetail = (path: string): path is PrivateDetail => path in PRIVATE_DETAILS;

/**
 * Whether a `set` would show a private detail the page doesn't show now (or route WhatsApp to another number), given
 * what the edits before it in the call left. Anything but `false` counts as on, since `null` restores a default that
 * may be on. Updates `shown` with what the edit would leave.
 */
function widensPrivacy(path: PrivateDetail, value: unknown, shown: DetailsShown): boolean {
	if (path === "contact.whatsapp") {
		const before = shown[path];
		const next = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
		const show = next.show === true;
		const number = typeof next.number === "string" ? next.number.trim() : "";
		const widens = (show && !before.show) || (number !== "" && number !== before.number);
		if (!widens) shown[path] = { show, number };
		return widens;
	}
	const on = value !== false;
	const widens = on && !shown[path];
	if (!widens) shown[path] = on;
	return widens;
}

/**
 * The edits the assistant may apply, with their places in the call, and those refused for switching on a private detail.
 * Only `set` reaches these fields, and refused edits are never `add`s, so refs between the others still hold.
 */
function screenPrivateDetails(data: PortfolioData, edits: readonly PortfolioEdit[]) {
	const shown = detailsShown(data);
	const allowed: { index: number; edit: PortfolioEdit }[] = [];
	const refused: { index: number; error: string }[] = [];
	edits.forEach((edit, index) => {
		if (edit.op === "set" && isPrivateDetail(edit.path) && widensPrivacy(edit.path, edit.value, shown))
			refused.push({
				index,
				error: `${edit.path}: you can't switch on details the page doesn't show yet (or change the WhatsApp number). Ask the user to switch it on themselves in ${PRIVATE_DETAILS[edit.path]}.`,
			});
		else allowed.push({ index, edit });
	});
	return { allowed, refused };
}

/** Pictures this conversation saved from its attachments in earlier replies, by attachment id. */
export function savedAttachmentImages(messages: readonly UIMessage[]): Map<string, PortfolioImage> {
	const saved = new Map<string, PortfolioImage>();
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.parts as Array<
			UIMessage["parts"][number] & { state?: string; input?: unknown; output?: unknown }
		>) {
			if (part.type !== "tool-save_attachment_image" || part.state !== "output-available") continue;
			const attachmentId = (part.input as { attachmentId?: unknown } | undefined)?.attachmentId;
			const image = (part.output as { image?: PortfolioImage } | undefined)?.image;
			if (typeof attachmentId === "string" && typeof image?.key === "string") saved.set(attachmentId, image);
		}
	}
	return saved;
}

type PortfolioRunInput = {
	/** The saved portfolio as AI works on it (`portfolioService.aiState`). */
	load: () => Promise<PortfolioAiState>;
	/** An attachment of this conversation, already sent with a message. */
	readAttachment: (attachmentId: string) => Promise<{ filename: string; mediaType: string; data: Uint8Array }>;
	/** Stores a picture for the portfolio like an upload (`portfolioService.addImage`). */
	addImage: (file: File, alt: string | undefined) => Promise<PortfolioImage>;
	/** Counts edits toward the conversation's outcome ("3 of 4 edits applied"). */
	countProposed: (count: number) => Promise<void>;
	/** Pictures earlier replies saved, by attachment id (`savedAttachmentImages`): used again while still stored. */
	savedImages?: ReadonlyMap<string, PortfolioImage> | undefined;
	newId?: (() => string) | undefined;
};

/** One reply's working copy of the portfolio and the tools' work on it. */
export function createPortfolioRun(input: PortfolioRunInput) {
	const newId = input.newId ?? generateId;
	let loading: Promise<PortfolioAiState> | null = null;
	// Loaded once per reply; a failed load (the portfolio is gone) is tried again on the next call.
	const working = () => {
		loading ??= input.load().catch((error: unknown) => {
			loading = null;
			throw error;
		});
		return loading;
	};
	// One stored copy per attachment and reply, however often (or how many times at once) the model asks.
	const saving = new Map<string, Promise<PortfolioImage>>();
	let stored = 0;

	/** A picture an earlier reply saved, when the portfolio still has it (placed, or an upload not yet cleaned up). */
	const savedEarlier = async (attachmentId: string) => {
		const image = input.savedImages?.get(attachmentId);
		if (!image) return null;
		const state = await working();
		const known = state.uploads.some((upload) => upload.key === image.key);
		return known || portfolioFileKeys(state.data).includes(image.key) ? image : null;
	};

	const store = async (attachmentId: string, alt: string | undefined): Promise<PortfolioImage> => {
		const earlier = await savedEarlier(attachmentId);
		if (earlier) return earlier;
		if (stored >= MAX_SAVED_IMAGES_PER_REPLY)
			throw new Error(
				`This reply already saved ${MAX_SAVED_IMAGES_PER_REPLY} pictures, the most one reply may. Place those, and ask the user to send the rest in another message.`,
			);
		// Counted before the first wait, so pictures saved at once can't pass the cap together; given back on failure.
		stored++;
		try {
			const attachment = await input.readAttachment(attachmentId);
			if (!PORTFOLIO_IMAGE_TYPES.has(attachment.mediaType))
				throw new Error(
					`${attachment.filename} is ${attachment.mediaType}; the portfolio takes PNG, JPEG or WebP pictures. Ask the user for one of those.`,
				);
			const image = await input.addImage(
				new File([attachment.data as Uint8Array<ArrayBuffer>], attachment.filename, { type: attachment.mediaType }),
				alt,
			);
			(await working()).uploads.push(image);
			return image;
		} catch (error) {
			stored--;
			throw error;
		}
	};

	return {
		/** `read_portfolio`: the copy as a model reads it. `data` marks it as a snapshot that context pruning replaces. */
		read: async () => {
			const state = await working();
			const placed = new Set(portfolioFileKeys(state.data));
			return {
				name: PORTFOLIO_DOCUMENT_NAME,
				updatedAt: state.updatedAt.toISOString(),
				data: portfolioAiView({ ...state, uploads: state.uploads.filter((upload) => !placed.has(upload.key)) }),
			};
		},

		/** `edit_portfolio`: applies the edits to the copy (nothing is saved here) and returns them as change cards. */
		edit: async (call: EditPortfolioInput): Promise<EditPortfolioOutput> => {
			const state = await working();
			const { allowed, refused } = screenPrivateDetails(state.data, call.edits);
			const result = applyPortfolioEdits(
				state.data,
				allowed.map((item) => item.edit),
				{ mode: "strict", plan: state.plan, images: state.uploads },
			);
			state.data = result.data;
			// The engine counts places in what it was given; the model and the editor read them in the whole call.
			const place = (index: number) => allowed[index]?.index ?? index;
			const failed = [...refused, ...result.failed.map((item) => ({ ...item, index: place(item.index) }))].sort(
				(a, b) => a.index - b.index,
			);
			const edits = result.applied.map((applied): PortfolioEditCard => ({
				id: newId(),
				edit: applied.edit,
				summary: applied.summary,
				status: "pending",
				...(applied.id ? { itemId: applied.id } : {}),
				...(applied.ref ? { ref: applied.ref } : {}),
			}));
			if (edits.length > 0) await input.countProposed(edits.length);
			return { title: call.title, edits, failed };
		},

		/**
		 * `save_attachment_image`: stores a picture the user attached in the portfolio's storage (the upload's checks and
		 * records, metadata dropped), and lets later edits in this reply place it. An attachment is stored once: asked
		 * again in this reply, or saved by an earlier one and still there, the same picture comes back. At most
		 * `MAX_SAVED_IMAGES_PER_REPLY` new pictures per reply.
		 */
		saveImage: async (call: SaveAttachmentImageInput): Promise<SaveAttachmentImageOutput> => {
			let pending = saving.get(call.attachmentId);
			if (!pending) {
				pending = store(call.attachmentId, call.alt);
				saving.set(call.attachmentId, pending);
				pending.catch(() => saving.delete(call.attachmentId));
			}
			const image = await pending;
			return {
				image: {
					key: image.key,
					width: image.width,
					height: image.height,
					// The alt text belongs to where a picture is placed, so each call may give its own.
					alt: call.alt ?? image.alt,
					...(image.thumbKey ? { thumbKey: image.thumbKey } : {}),
				},
			};
		},
	};
}

export type PortfolioRun = ReturnType<typeof createPortfolioRun>;

const STATUS_FOR_MODEL = {
	accepted: "applied",
	rejected: "undone by the user",
	pending: "not applied in the editor yet",
} as const;

/**
 * What the model reads back from an `edit_portfolio` call: one line per applied edit with the id of what it added,
 * and the failures. The resolved edits (full items, image objects) are for the editor and would only fill the context.
 * In a later turn (`history`) it also says what the user did with each change.
 */
export function editPortfolioModelOutput(output: EditPortfolioOutput, history = false) {
	return {
		title: output.title,
		applied: output.edits.map((edit) => ({
			summary: edit.summary,
			...(edit.itemId ? { id: edit.itemId } : {}),
			...(edit.ref ? { ref: edit.ref } : {}),
			...(history ? { status: STATUS_FOR_MODEL[edit.status] } : {}),
		})),
		failed: output.failed,
		...(history ? {} : { note: "Applied to the page. Use the ids above for further edits in this reply." }),
	};
}

type ToolPart = UIMessage["parts"][number] & { state?: string; output?: unknown };

/** Earlier `edit_portfolio` results, as the model reads them again in a later turn (`editPortfolioModelOutput`). */
export function withCompactPortfolioEdits(message: UIMessage): UIMessage {
	if (!message.parts.some((part) => part.type === "tool-edit_portfolio")) return message;
	return {
		...message,
		parts: message.parts.map((part) => {
			const toolPart = part as ToolPart;
			const output = toolPart.output as EditPortfolioOutput | undefined;
			if (part.type !== "tool-edit_portfolio" || toolPart.state !== "output-available" || !Array.isArray(output?.edits))
				return part;
			return { ...part, output: editPortfolioModelOutput(output, true) } as UIMessage["parts"][number];
		}),
	};
}
