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

/**
 * Pictures uploaded to a portfolio (`02-teknis.md` section 8). The browser shrinks and re-encodes every picture before
 * it's sent (the server can't resize on Workers): the longest side at most `imageSide`, a small copy at `thumbSide` for
 * cards, client logos at `logoSide`. The server checks the bytes and pixel size again and refuses anything bigger.
 */
export const PORTFOLIO_UPLOAD = {
	imageBytes: 2.5 * 1024 * 1024,
	imageSide: 2000,
	thumbSide: 800,
	logoSide: 600,
	/** One PDF in a work's PDF block (`02-teknis.md` section 19). */
	pdfBytes: 10 * 1024 * 1024,
	/**
	 * A picture fetched from another site for a pasted link (`02-teknis.md` section 20). The browser shrinks it like any
	 * other picture before it's uploaded, so it may start larger than `imageBytes`.
	 */
	remoteImageBytes: 10 * 1024 * 1024,
} as const;

/**
 * A new account's portfolio stays out of search engines for this many days, even with "Show in search engines" on
 * (owner decision #5, 2026-11-06): a fresh account is the likeliest to be spam.
 */
export const PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS = 7;

/** When an account's portfolio may first be indexed. */
export function portfolioIndexableFrom(accountCreatedAt: Date): Date {
	return new Date(accountCreatedAt.getTime() + PORTFOLIO_NEW_ACCOUNT_NOINDEX_DAYS * 86_400_000);
}

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
