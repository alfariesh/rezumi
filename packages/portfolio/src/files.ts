import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import { PORTFOLIO_IMAGE_KEY_PATTERN, PORTFOLIO_PDF_KEY_PATTERN } from "@rezumi/schema/portfolio/files";

/**
 * Every storage key portfolio data refers to: images (with their small copies) and PDFs. The API checks each is the
 * owner's own recorded upload before saving data that uses it. Deciding whether a stored file is still used needs
 * `portfolioFileKeysInStoredData` instead.
 */
export function portfolioFileKeys(data: PortfolioData): string[] {
	const keys = new Set<string>();
	const image = (value: PortfolioImage | null | undefined) => {
		if (!value) return;
		keys.add(value.key);
		if (value.thumbKey) keys.add(value.thumbKey);
	};

	image(data.basics.picture);
	image(data.hero.background.image);
	for (const work of data.works.items) {
		image(work.cover);
		for (const block of work.blocks) {
			if (block.type === "images") block.images.forEach(image);
			if (block.type === "pdf") {
				keys.add(block.file);
				image(block.preview);
			}
			if (block.type === "link") image(block.image);
			if (block.type === "video" || block.type === "embed") image(block.thumbnail);
		}
	}
	for (const testimonial of data.testimonials.items) image(testimonial.photo);
	for (const client of data.clients.items) if (client.logo && "key" in client.logo) image(client.logo);
	for (const section of data.custom) image(section.image);
	image(data.location.map?.light);
	image(data.location.map?.dark);
	return [...keys];
}

const isFileKey = (value: string) => PORTFOLIO_IMAGE_KEY_PATTERN.test(value) || PORTFOLIO_PDF_KEY_PATTERN.test(value);

/**
 * Every string in stored portfolio JSON that is a portfolio file key, wherever it sits: what the cleanup job, the
 * weekly check and file deletion treat as used. Unlike `portfolioFileKeys` it reads the raw JSON, not today's parse
 * of it, so a field a later version adds, an item the lenient read drops, or a list a tightened limit cuts never gets
 * a file deleted that the saved data still names. A superset of `portfolioFileKeys` of the same data.
 */
export function portfolioFileKeysInStoredData(data: unknown): string[] {
	const keys = new Set<string>();
	const pending: unknown[] = [data];
	while (pending.length) {
		const value = pending.pop();
		if (typeof value === "string") {
			if (isFileKey(value)) keys.add(value);
		} else if (Array.isArray(value)) {
			for (const item of value) pending.push(item);
		} else if (typeof value === "object" && value !== null) {
			for (const item of Object.values(value)) pending.push(item);
		}
	}
	return [...keys];
}
