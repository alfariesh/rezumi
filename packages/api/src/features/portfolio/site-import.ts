import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { SiteWorksEvent, WebsiteImportImage, WorkDraft } from "@rezumi/schema/profile/website-import";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { db } from "@rezumi/db/client";
import * as schema from "@rezumi/db/schema";
import { readPortfolioImageHeader } from "@rezumi/portfolio/image-header";
import { hasWork, workFromDraft } from "@rezumi/portfolio/site-import";
import { parsePortfolioData } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_UPLOAD } from "@rezumi/schema/portfolio/limits";
import { getEntitlements, isBillingAppliedTo } from "../billing/entitlements";
import { portfolioLimitReached } from "../billing/limits";
import { profileService } from "../profile/service";
import { readWebsiteImportResult } from "../profile/sources/website-import/run";
import { canResizePictures, processImageForUpload } from "../storage/service";
import { requireEnabled } from "./access";
import { portfolioErrors } from "./errors";
import { portfolioMedia } from "./media";
import { portfolioService } from "./service";

/**
 * Saving a website import's chosen works (`.agents/docs/plans/impor-website/02-teknis.md` section 6): each gets a
 * Profile project (so resumes have it too), the portfolio is made if the account has none (unpublished, with the
 * Profile as its source, and only the imported works), the works' pictures are copied to the portfolio's storage, and
 * the works are saved. Pictures are copied before the save; one that is never saved is cleaned up with other unused
 * uploads. Only drafts the server kept for the run are used: the client names them by ID, never by content.
 */

/** Pictures copied at the same time. */
const COPY_CONCURRENCY = 4;
/** A picture larger than the portfolio keeps is shrunk to this: its longest side, and its JPEG quality. */
const PORTFOLIO_PICTURE_SIZE = { side: PORTFOLIO_UPLOAD.imageSide, quality: 82 };

const isStorageRefusal = (error: unknown) =>
	error instanceof ORPCError && (error.code === "PLAN_LIMIT_REACHED" || error.code === "PORTFOLIO_STORAGE_FULL");

/**
 * The picture as the portfolio keeps it: as it is when it already fits (no processing, so nothing is paid for it), else
 * shrunk to 2,000 px. Throws when it can't fit and this server can't shrink it.
 */
async function fitPicture(file: File): Promise<File> {
	const data = new Uint8Array(await file.arrayBuffer());
	const header = readPortfolioImageHeader(data);
	const fits =
		header.ok &&
		Math.max(header.image.width, header.image.height) <= PORTFOLIO_UPLOAD.imageSide &&
		data.byteLength <= PORTFOLIO_UPLOAD.imageBytes;
	if (fits) return file;
	if (!canResizePictures()) throw portfolioErrors.pictureNotResized("dimensions");
	const processed = await processImageForUpload(file, PORTFOLIO_PICTURE_SIZE);
	return new File([processed.data as Uint8Array<ArrayBuffer>], "picture.jpg", { type: processed.contentType });
}

async function copyPicture(userId: string, image: WebsiteImportImage, signal?: AbortSignal): Promise<PortfolioImage> {
	const file = await portfolioMedia.fetchRemoteImage(userId, { url: image.url }, signal);
	return await portfolioMedia.addImage(userId, { source: { file: await fitPicture(file) }, alt: image.alt }, signal);
}

/** The account's portfolio as saved, or null while it has none. */
async function readPortfolio(userId: string) {
	const [row] = await db
		.select({ data: schema.portfolio.data, sourceResumeId: schema.portfolio.sourceResumeId })
		.from(schema.portfolio)
		.where(eq(schema.portfolio.userId, userId));
	return row ? { data: parsePortfolioData(row.data), sourceResumeId: row.sourceResumeId } : null;
}

/** Refuses more works than the plan allows before any picture is copied; the save checks it again. */
async function assertRoom(userId: string, used: number, adding: number) {
	if (!adding || !(await isBillingAppliedTo(userId))) return;
	const entitlements = await getEntitlements(userId);
	const max = entitlements.limits.portfolioWorks;
	if (max !== null && used + adding > max)
		throw portfolioLimitReached({ limit: "portfolioWorks", max, used, planId: entitlements.planId });
}

/** Saves the chosen works of a website import, yielding its progress, then what happened. */
export async function* importSiteWorks(
	userId: string,
	input: { runId: string; workIds: readonly string[] },
	signal?: AbortSignal,
): AsyncGenerator<SiteWorksEvent, void, unknown> {
	await requireEnabled(userId);
	const result = await readWebsiteImportResult(userId, input.runId).catch((error: unknown) => {
		throw error instanceof ORPCError && error.code === "SOURCE_NOT_FOUND" ? portfolioErrors.importGone() : error;
	});
	const wanted = new Set(input.workIds);
	const drafts = result.works.filter((work) => wanted.has(work.id));
	if (!drafts.length) throw new ORPCError("BAD_REQUEST", { message: "Choose at least one work from this import." });
	yield { type: "saving" };

	const projectIds = await profileService.projectsForDrafts(userId, drafts);
	let created = false;
	if (!(await readPortfolio(userId))) {
		try {
			await portfolioService.create(userId, { sourceResumeId: null });
			created = true;
		} catch (error) {
			// Another tab made it in the meantime: add to that one.
			if (!(error instanceof ORPCError && error.code === "PORTFOLIO_EXISTS")) throw error;
		}
	}
	const portfolio = await readPortfolio(userId);
	if (!portfolio) throw portfolioErrors.notFound();
	// Links to Profile projects mean something only while the Profile is the portfolio's source.
	const fromProfile = !portfolio.sourceResumeId && portfolio.data.useProfileSource !== false;
	const projectOf = (draft: WorkDraft) => (fromProfile ? projectIds.get(draft.id) : undefined);
	// A portfolio this import made starts with only its works: the Profile's other projects stay importable.
	const kept = created ? [] : portfolio.data.works.items;
	const pending = drafts.filter((draft) => !hasWork(kept, draft, projectOf(draft)));
	await assertRoom(userId, kept.length, pending.length);

	const images = [
		...new Map(
			pending
				.flatMap((draft) => [draft.cover, ...draft.gallery])
				.flatMap((image) => (image ? [[image.url, image]] : [])),
		).values(),
	] as WebsiteImportImage[];
	const pictures = new Map<string, PortfolioImage>();
	let skipped = 0;
	let storageFull = false;
	let done = 0;
	if (images.length) yield { type: "picture", done, total: images.length };
	for (let start = 0; start < images.length && !storageFull; start += COPY_CONCURRENCY) {
		const batch = images.slice(start, start + COPY_CONCURRENCY);
		const copies = await Promise.allSettled(batch.map((image) => copyPicture(userId, image, signal)));
		signal?.throwIfAborted();
		copies.forEach((copy, index) => {
			const image = batch[index];
			if (copy.status === "fulfilled" && image) pictures.set(image.url, copy.value);
			else if (copy.status === "rejected" && isStorageRefusal(copy.reason)) storageFull = true;
			else skipped++;
		});
		done += batch.length;
		yield { type: "picture", done, total: images.length };
	}
	// Pictures never started because storage ran out count as skipped too.
	const picturesSkipped = images.length - pictures.size;

	let added = 0;
	await portfolioService.saveBuiltWorks(userId, (current) => {
		const works = created ? [] : current.works.items;
		const taken = new Set(works.map((work) => work.slug));
		const additions = pending
			.filter((draft) => !hasWork(works, draft, projectOf(draft)))
			.map((draft) => workFromDraft(draft, pictures, taken, projectOf(draft)));
		added = additions.length;
		if (!additions.length && !created) return null;
		return [...works, ...additions];
	});

	yield {
		type: "done",
		added,
		alreadyThere: drafts.length - added,
		picturesSkipped: Math.max(picturesSkipped, skipped),
		storageFull,
		created,
	};
}
