/**
 * Technical limits of a portfolio's data. Plan limits (works on Free, storage quota) are separate and enforced by the
 * API; these only keep one portfolio renderable and its JSON small. Text limits count characters of visible text.
 */
export const PORTFOLIO_LIMITS = {
	/** The saved JSON, after rich text is sanitized. */
	dataBytes: 256 * 1024,
	works: 50,
	blocksPerWork: 30,
	tagsPerWork: 12,
	imagesPerBlock: 12,
	metricsPerBlock: 4,
	highlights: 4,
	heroButtons: 3,
	typewriterPhrases: 3,
	services: 12,
	testimonials: 12,
	clients: 24,
	customSections: 10,
	sparklinePoints: { min: 3, max: 12 },
	pdfPages: 5000,
	/** Item IDs one section can hide (CV items hidden on the portfolio only). */
	hiddenItemsPerSection: 500,
	imageSide: 10_000,
	text: {
		name: 100,
		headline: 140,
		location: 60,
		greeting: 160,
		availability: 60,
		about: 5000,
		blockText: 10_000,
		customContent: 5000,
		workTitle: 100,
		workSummary: 240,
		workRole: 80,
		workDate: 40,
		tag: 40,
		slug: 64,
		alt: 200,
		caption: 140,
		buttonLabel: 40,
		sectionTitle: 60,
		phrase: 40,
		metricLabel: 60,
		metricText: 12,
		metricPrefix: 4,
		metricSuffix: 12,
		metricChange: 12,
		metricContext: 80,
		serviceTitle: 60,
		serviceDescription: 300,
		servicePrice: 40,
		quote: 500,
		personName: 60,
		personRole: 80,
		clientName: 60,
		customTitle: 60,
		linkTitle: 140,
		linkDescription: 300,
		siteName: 60,
		mediaTitle: 140,
		contactNote: 200,
		seoTitle: 70,
		seoDescription: 160,
		url: 2048,
		id: 64,
	},
} as const;

/** Markup may run longer than its text (tags, entities); this bounds one rich-text field's HTML. */
export const RICH_TEXT_MARKUP_FACTOR = 8;

/** Characters of visible text in an HTML fragment, counting each entity as one character. */
export function richTextLength(html: string): number {
	return html
		.replace(/<[^<>]*>/g, "")
		.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);/gi, "x")
		.trim().length;
}

/** The size of portfolio data as saved: UTF-8 bytes of its JSON. */
export function portfolioDataBytes(data: unknown): number {
	return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}
