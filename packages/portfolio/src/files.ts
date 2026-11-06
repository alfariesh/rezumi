import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";

/**
 * Every storage key portfolio data uses: images (with their small copies) and PDFs. The API checks each belongs to the
 * owner before saving; the cleanup job compares them with `portfolio_file` to find files nothing uses.
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
			if (block.type === "video") image(block.thumbnail);
		}
	}
	for (const testimonial of data.testimonials.items) image(testimonial.photo);
	for (const client of data.clients.items) if (client.logo && "key" in client.logo) image(client.logo);
	for (const section of data.custom) image(section.image);
	image(data.location.map?.light);
	image(data.location.map?.dark);
	return [...keys];
}
