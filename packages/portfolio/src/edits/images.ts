import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";

/** An image portfolio data uses, and where, in words a model reads: `work "Lumen" › cover`. */
export type PlacedPortfolioImage = { image: PortfolioImage; where: string };

const quoted = (text: string, fallback: string) => (text.trim() ? `"${text.trim()}"` : fallback);

/** Every image in portfolio data, with where it's used, in page order. The editor's map pictures are left out. */
export function placedPortfolioImages(data: PortfolioData): PlacedPortfolioImage[] {
	const placed: PlacedPortfolioImage[] = [];
	const add = (image: PortfolioImage | null | undefined, where: string) => {
		if (image) placed.push({ image, where });
	};

	add(data.basics.picture, "basics.picture");
	add(data.hero.background.image, "hero.background");
	for (const work of data.works.items) {
		const name = `work ${quoted(work.title, work.id)}`;
		add(work.cover, `${name} › cover`);
		for (const block of work.blocks) {
			const where = `${name} › ${block.type} block ${block.id}`;
			if (block.type === "images") for (const image of block.images) add(image, where);
			if (block.type === "video" || block.type === "embed") add(block.thumbnail, `${where} › thumbnail`);
			if (block.type === "link") add(block.image, `${where} › image`);
			if (block.type === "pdf") add(block.preview, `${where} › preview`);
		}
	}
	for (const item of data.testimonials.items) add(item.photo, `testimonial ${quoted(item.name, item.id)} › photo`);
	for (const item of data.clients.items)
		if (item.logo && "key" in item.logo) add(item.logo, `client ${quoted(item.name, item.id)} › logo`);
	for (const section of data.custom) add(section.image, `section ${quoted(section.title, section.id)} › image`);
	return placed;
}

/** The stored image itself, without what a place adds to it (a caption, a focus point). */
function bareImage(image: PortfolioImage): PortfolioImage {
	return {
		key: image.key,
		...(image.thumbKey ? { thumbKey: image.thumbKey } : {}),
		width: image.width,
		height: image.height,
		alt: image.alt,
	};
}

/**
 * The images an edit may place, by key: those the data already uses (the editor's map pictures too) and the uploads
 * given. A key used twice keeps its first alternative text.
 */
export function knownImages(data: PortfolioData, uploads: readonly PortfolioImage[] = []): Map<string, PortfolioImage> {
	const known = new Map<string, PortfolioImage>();
	for (const { image } of placedPortfolioImages(data))
		if (!known.has(image.key)) known.set(image.key, bareImage(image));
	for (const image of [data.location.map?.light, data.location.map?.dark, ...uploads])
		if (image && !known.has(image.key)) known.set(image.key, bareImage(image));
	return known;
}
