import type { PortfolioAiState } from "../portfolio/service";
import type { EditPortfolioOutput } from "@rezumi/ai/tools/agent-tool-contracts";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { UIMessage } from "ai";
import { describe, expect, it, vi } from "vite-plus/test";
import { createDefaultPortfolioData } from "@rezumi/schema/portfolio/default";

vi.mock("./document", () => ({ PORTFOLIO_DOCUMENT_NAME: "Portfolio" }));

const {
	createPortfolioRun,
	editPortfolioModelOutput,
	MAX_SAVED_IMAGES_PER_REPLY,
	savedAttachmentImages,
	withCompactPortfolioEdits,
} = await import("./portfolio");

const UPLOAD = "uploads/user-1/pictures/portfolio/upload-1.webp";
const SAVED = "uploads/user-1/pictures/portfolio/saved-1.webp";

function savedState(): PortfolioAiState {
	return {
		data: createDefaultPortfolioData(),
		source: { from: "profile", name: null, resume: null },
		status: { published: false, url: "https://rezumi.test/dana" },
		uploads: [{ key: UPLOAD, width: 800, height: 600, alt: "" }],
		plan: null,
		updatedAt: new Date("2026-11-14T08:00:00.000Z"),
	};
}

function setup(state = savedState(), savedImages?: ReadonlyMap<string, PortfolioImage>) {
	let next = 0;
	let saved = 0;
	const deps = {
		load: vi.fn(async () => state),
		readAttachment: vi.fn(async (_id: string) => ({
			filename: "shot.png",
			mediaType: "image/png",
			data: new Uint8Array([1, 2, 3]),
		})),
		addImage: vi.fn(async (_file: File, alt: string | undefined) => ({
			key: saved++ === 0 ? SAVED : `uploads/user-1/pictures/portfolio/saved-${saved}.webp`,
			width: 1200,
			height: 900,
			alt: alt ?? "",
		})),
		countProposed: vi.fn(async (_count: number) => {}),
		savedImages,
		newId: () => `card-${++next}`,
	};
	return { deps, run: createPortfolioRun(deps) };
}

const addWork = (title: string, extra: Record<string, unknown> = {}) => ({
	op: "add" as const,
	list: "works" as const,
	ref: "new-work",
	item: { title, ...extra },
});

describe("portfolio assistant run", () => {
	it("loads the saved portfolio once and keeps one working copy across read, edit and read", async () => {
		const { deps, run } = setup();
		const first = await run.read();
		expect(first).toMatchObject({ name: "Portfolio", updatedAt: "2026-11-14T08:00:00.000Z" });
		expect(JSON.stringify(first.data)).not.toContain("Lumen redesign");

		const output = await run.edit({ title: "Add Lumen", edits: [addWork("Lumen redesign")] });
		expect(output.failed).toEqual([]);
		expect(output.edits).toHaveLength(1);
		expect(output.edits[0]).toMatchObject({ id: "card-1", status: "pending", ref: "new-work" });
		expect(output.edits[0]?.itemId).toEqual(expect.any(String));
		expect(deps.countProposed).toHaveBeenCalledWith(1);

		const second = await run.read();
		expect(JSON.stringify(second.data)).toContain("Lumen redesign");
		// The saved version the copy started from; nothing was written.
		expect(second.updatedAt).toBe("2026-11-14T08:00:00.000Z");
		expect(deps.load).toHaveBeenCalledTimes(1);
	});

	it("reports edits that fail and counts only the ones that applied", async () => {
		const { deps, run } = setup();
		const output = await run.edit({
			title: "Two changes",
			edits: [{ op: "remove", list: "works", id: "no-such-work" }, addWork("Kopi app")],
		});
		expect(output.failed).toEqual([{ index: 0, error: expect.any(String) }]);
		expect(output.edits.map((edit) => edit.summary)).toHaveLength(1);
		expect(deps.countProposed).toHaveBeenCalledWith(1);

		const none = await run.edit({ title: "Nothing", edits: [{ op: "remove", list: "works", id: "missing" }] });
		expect(none.edits).toEqual([]);
		expect(deps.countProposed).toHaveBeenCalledTimes(1);
	});

	it("places an upload known to the run, and refuses an image key it doesn't know", async () => {
		const { run } = setup();
		const known = await run.edit({
			title: "Cover",
			edits: [addWork("Lumen", { cover: { key: UPLOAD, alt: "Checkout screens" } })],
		});
		expect(known.failed).toEqual([]);
		const unknown = await run.edit({
			title: "Cover",
			edits: [addWork("Kopi", { cover: { key: "uploads/user-1/pictures/portfolio/elsewhere.webp" } })],
		});
		expect(unknown.edits).toEqual([]);
		expect(unknown.failed).toHaveLength(1);
	});

	it("saves an attached picture like an upload and lets a later edit place it", async () => {
		const { deps, run } = setup();
		const saved = await run.saveImage({ attachmentId: "attachment-1", alt: "The Lumen checkout" });
		expect(saved).toEqual({ image: { key: SAVED, width: 1200, height: 900, alt: "The Lumen checkout" } });
		expect(deps.readAttachment).toHaveBeenCalledWith("attachment-1");
		const [file] = deps.addImage.mock.calls[0] ?? [];
		expect(file).toBeInstanceOf(File);
		expect(file?.type).toBe("image/png");

		const placed = await run.edit({ title: "Cover", edits: [addWork("Lumen", { cover: { key: SAVED } })] });
		expect(placed.failed).toEqual([]);
	});

	it("takes only PNG, JPEG or WebP attachments", async () => {
		const { deps, run } = setup();
		deps.readAttachment.mockResolvedValueOnce({
			filename: "brief.pdf",
			mediaType: "application/pdf",
			data: new Uint8Array([1]),
		});
		await expect(run.saveImage({ attachmentId: "attachment-2" })).rejects.toThrow("PNG, JPEG or WebP");
		expect(deps.addImage).not.toHaveBeenCalled();
	});

	it("loads again after a failed load", async () => {
		const { deps, run } = setup();
		deps.load.mockRejectedValueOnce(new Error("gone"));
		await expect(run.read()).rejects.toThrow("gone");
		await expect(run.read()).resolves.toMatchObject({ name: "Portfolio" });
		expect(deps.load).toHaveBeenCalledTimes(2);
	});
});

describe("private details on the page", () => {
	const set = (path: string, value: unknown) => ({ op: "set" as const, path, value });

	it("never switches a hidden detail on, and lets the user's own switch stay theirs", async () => {
		const state = savedState();
		state.data.hero.showLocation = false;
		const { run } = setup(state);
		const output = await run.edit({
			title: "Contact",
			edits: [
				set("contact.phone", true),
				set("contact.whatsapp", { show: true, number: "447700900123" }),
				set("hero.showLocation", true),
				set("contact.phone", null),
			],
		});
		expect(output.edits).toEqual([]);
		expect(output.failed.map((failure) => failure.index)).toEqual([0, 1, 2, 3]);
		expect(output.failed[0]?.error).toContain("Ask the user to switch it on themselves in Content → Contact");
		expect(output.failed[2]?.error).toContain("Content → Intro");
		expect(state.data.contact.phone).toBe(false);
		expect(state.data.contact.whatsapp.show).toBe(false);
		expect(state.data.hero.showLocation).toBe(false);
	});

	it("switches details off, and refuses switching them back on in the same call", async () => {
		const { run } = setup();
		const output = await run.edit({
			title: "Hide email",
			edits: [set("contact.email", false), set("contact.website", false), set("contact.email", true)],
		});
		expect(output.edits).toHaveLength(2);
		expect(output.failed).toEqual([{ index: 2, error: expect.stringContaining("contact.email") }]);
	});

	it("refuses another WhatsApp number even while WhatsApp stays off, and allows turning it off", async () => {
		const state = savedState();
		state.data.contact.whatsapp = { show: true, number: "6281234567890" };
		const { run } = setup(state);
		const output = await run.edit({
			title: "WhatsApp",
			edits: [
				set("contact.whatsapp", { show: true, number: "447700900123" }),
				set("contact.whatsapp", { show: false, number: "6281234567890" }),
				set("contact.whatsapp", { show: false, number: "447700900123" }),
			],
		});
		expect(output.edits).toHaveLength(1);
		expect(output.failed.map((failure) => failure.index)).toEqual([0, 2]);
		expect(state.data.contact.whatsapp).toEqual({ show: false, number: "6281234567890" });
	});

	it("keeps each edit's place in the call around refused ones", async () => {
		const { run } = setup();
		const output = await run.edit({
			title: "Mixed",
			edits: [
				addWork("Lumen"),
				set("contact.phone", true),
				{ op: "remove", list: "works", id: "nope" },
				{ op: "update", list: "works", id: "new-work", fields: { summary: "Calmer checkout." } },
			],
		});
		expect(output.edits).toHaveLength(2);
		expect(output.failed.map((failure) => failure.index)).toEqual([1, 2]);
		expect(output.failed[1]?.error).not.toContain("switch it on");
	});
});

describe("saving attached pictures", () => {
	it("stores an attachment once per reply, however often it's asked for", async () => {
		const { deps, run } = setup();
		const [first, second] = await Promise.all([
			run.saveImage({ attachmentId: "a1", alt: "Cover" }),
			run.saveImage({ attachmentId: "a1", alt: "Gallery shot" }),
		]);
		const third = await run.saveImage({ attachmentId: "a1" });
		expect(deps.addImage).toHaveBeenCalledTimes(1);
		expect(first.image.key).toBe(SAVED);
		expect(second.image).toMatchObject({ key: SAVED, alt: "Gallery shot" });
		expect(third.image).toMatchObject({ key: SAVED, alt: "Cover" });
	});

	it(`stores at most ${MAX_SAVED_IMAGES_PER_REPLY} new pictures per reply`, async () => {
		const { deps, run } = setup();
		for (let index = 0; index < MAX_SAVED_IMAGES_PER_REPLY; index++) await run.saveImage({ attachmentId: `a${index}` });
		await expect(run.saveImage({ attachmentId: "one-more" })).rejects.toThrow(
			`already saved ${MAX_SAVED_IMAGES_PER_REPLY} pictures`,
		);
		expect(deps.addImage).toHaveBeenCalledTimes(MAX_SAVED_IMAGES_PER_REPLY);
		// One already saved still comes back.
		await expect(run.saveImage({ attachmentId: "a0" })).resolves.toMatchObject({ image: { key: SAVED } });
	});

	it("doesn't count a refused attachment toward the cap", async () => {
		const { deps, run } = setup();
		deps.readAttachment.mockResolvedValueOnce({
			filename: "a.pdf",
			mediaType: "application/pdf",
			data: new Uint8Array(),
		});
		await expect(run.saveImage({ attachmentId: "pdf" })).rejects.toThrow("PNG, JPEG or WebP");
		for (let index = 0; index < MAX_SAVED_IMAGES_PER_REPLY; index++) await run.saveImage({ attachmentId: `a${index}` });
		expect(deps.addImage).toHaveBeenCalledTimes(MAX_SAVED_IMAGES_PER_REPLY);
	});

	it("uses a picture an earlier reply saved while the portfolio still has it", async () => {
		const earlier = new Map([
			["kept", { key: UPLOAD, width: 800, height: 600, alt: "Earlier" }],
			["cleaned-up", { key: "uploads/user-1/pictures/portfolio/gone.webp", width: 10, height: 10, alt: "" }],
		]);
		const { deps, run } = setup(savedState(), earlier);
		await expect(run.saveImage({ attachmentId: "kept" })).resolves.toEqual({
			image: { key: UPLOAD, width: 800, height: 600, alt: "Earlier" },
		});
		expect(deps.addImage).not.toHaveBeenCalled();
		await run.saveImage({ attachmentId: "cleaned-up" });
		expect(deps.addImage).toHaveBeenCalledTimes(1);
	});

	it("finds the pictures earlier replies saved in the conversation", () => {
		const image = { key: UPLOAD, width: 800, height: 600, alt: "Cover" };
		const messages = [
			{ id: "u", role: "user", parts: [{ type: "text", text: "Here" }] },
			{
				id: "r",
				role: "assistant",
				parts: [
					{
						type: "tool-save_attachment_image",
						state: "output-available",
						input: { attachmentId: "a1" },
						output: { image },
					},
					{
						type: "tool-save_attachment_image",
						state: "output-error",
						input: { attachmentId: "a2" },
						errorText: "Too big",
					},
				],
			},
		] as UIMessage[];
		expect(savedAttachmentImages(messages)).toEqual(new Map([["a1", image]]));
	});
});

describe("edit_portfolio as the model reads it", () => {
	const output: EditPortfolioOutput = {
		title: "Add Lumen",
		edits: [
			{
				id: "card-1",
				edit: { op: "add", list: "works", item: { id: "w1", title: "Lumen" } },
				summary: 'Added work "Lumen"',
				status: "accepted",
				itemId: "w1",
				ref: "lumen",
			},
			{
				id: "card-2",
				edit: { op: "set", path: "theme", value: "prima" },
				summary: "Theme: prima",
				status: "rejected",
			},
		],
		failed: [{ index: 2, error: "works › summary: at most 240 characters" }],
	};

	it("leaves the resolved edits out and keeps summaries, new ids and failures", () => {
		const compact = editPortfolioModelOutput(output);
		expect(compact).toEqual({
			title: "Add Lumen",
			applied: [{ summary: 'Added work "Lumen"', id: "w1", ref: "lumen" }, { summary: "Theme: prima" }],
			failed: output.failed,
			note: expect.any(String),
		});
		expect(JSON.stringify(compact)).not.toContain('"op"');
	});

	it("tells the model in later turns what the user did with each change", () => {
		const message: UIMessage = {
			id: "reply-1",
			role: "assistant",
			parts: [
				{ type: "text", text: "Added it." },
				{
					type: "tool-edit_portfolio",
					toolCallId: "call-1",
					state: "output-available",
					input: { title: "Add Lumen", edits: [] },
					output,
				} as UIMessage["parts"][number],
			],
		};
		const compact = withCompactPortfolioEdits(message);
		const part = compact.parts[1] as { output: { applied: Array<{ status: string }> } };
		expect(part.output.applied.map((edit) => edit.status)).toEqual(["applied", "undone by the user"]);
		expect(compact.parts[0]).toBe(message.parts[0]);
		const plain: UIMessage = { id: "m", role: "user", parts: [{ type: "text", text: "Hi" }] };
		expect(withCompactPortfolioEdits(plain)).toBe(plain);
	});
});
