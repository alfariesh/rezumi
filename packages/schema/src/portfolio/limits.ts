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
	/**
	 * Roles the typewriter effect types after the headline, which it types first and stops on: at most two (owner
	 * decision 2026-11-06, `00-keputusan.md` log).
	 */
	typewriterPhrases: 2,
	services: 12,
	testimonials: 12,
	clients: 24,
	customSections: 10,
	sparklinePoints: { min: 3, max: 12 },
	pdfPages: 5000,
	/** Item IDs one section can hide (CV items hidden on the portfolio only). */
	hiddenItemsPerSection: 500,
	/**
	 * Section keys in `sections.order` or `sections.hidden`: the 16 standard sections, the portfolio's own sections and
	 * the resume's custom sections, with room to spare.
	 */
	sectionKeys: 100,
	/**
	 * The largest pixel side saved data may record for a picture, whatever made it. Uploads are smaller still: the
	 * browser shrinks them to `PORTFOLIO_UPLOAD.imageSide` and the server refuses anything larger.
	 */
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
		/** An IANA time zone name, such as "America/Argentina/Buenos_Aires". */
		timezone: 64,
		/** An item ID: the portfolio's own, or a resume item or section the portfolio refers to. */
		id: 64,
	},
} as const;

/** IDs of the portfolio's own items and sections: UUIDs from `generateId` or other short URL-safe text. */
export const PORTFOLIO_ITEM_ID_PATTERN = new RegExp(`^[\\w-]{1,${PORTFOLIO_LIMITS.text.id}}$`);

/**
 * Whether a portfolio can refer to a resume item or section by this ID (`fromResumeItemId`, `sections.hiddenItems`,
 * `resume:<id>` section keys). The resume takes any text as an ID, so these take any that isn't empty, up to the ID
 * limit. They're data, matched against the resume's own IDs: whatever a page makes from one, such as an anchor, must
 * be made safe first.
 */
export function isResumeReferenceId(id: string): boolean {
	return id.length > 0 && id.length <= PORTFOLIO_LIMITS.text.id;
}

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
	/**
	 * What one account may keep stored for its portfolio, whatever its plan: a technical ceiling, so an account can't
	 * fill storage while plans are off. Plan quotas (`PlanLimits.portfolioStorageBytes`) sit at or below it.
	 */
	accountBytes: 1024 * 1024 * 1024,
	/** How many files one account may keep stored for its portfolio, for the same reason. */
	accountFiles: 3000,
} as const;

/**
 * How long the server keeps a portfolio file no saved data uses before deleting it: an upload not saved yet, or one an
 * undo would bring back. The editor keeps a photo ready to come back for less than this.
 */
export const PORTFOLIO_UNUSED_FILE_GRACE_MS = 24 * 60 * 60 * 1000;

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

/**
 * Characters of visible text in an HTML fragment, never fewer than the page shows once the API's sanitizer has cleaned
 * it. Only real tags (`<` then a letter, or `</` then a letter) are markup: the sanitizer keeps anything else that
 * starts with `<`, such as `<1 x>` or `a <= b`, as text. Numeric entities and the ones editors write (`&amp;`, `&lt;`,
 * `&gt;`, `&quot;`, `&apos;`, `&nbsp;`) count as the character they stand for. Any other `&name;` counts in full: the
 * sanitizer shows a name it doesn't know as it is, and neither the editor nor the sanitizer writes the ones it knows.
 */
export function richTextLength(html: string): number {
	return html
		.replace(/<\/?[a-z][^<>]*>/gi, "")
		.replace(
			/&(?:#(\d+)|#[xX]([\da-fA-F]+)|amp|AMP|lt|LT|gt|GT|quot|QUOT|apos|nbsp);/g,
			(_, decimal?: string, hex?: string) => {
				const code = decimal ? Number(decimal) : hex ? Number.parseInt(hex, 16) : 0;
				// Characters past U+FFFF take two UTF-16 units, as they do typed directly.
				return code > 0xff_ff && code <= 0x10_ff_ff ? "xx" : "x";
			},
		)
		.trim().length;
}

/** Whether rich text fits a field of `max` characters: its visible text, and its markup within the markup factor. */
export function fitsRichText(html: string, max: number): boolean {
	return html.length <= max * RICH_TEXT_MARKUP_FACTOR && richTextLength(html) <= max;
}

/** The size of portfolio data as saved: UTF-8 bytes of its JSON. */
export function portfolioDataBytes(data: unknown): number {
	return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}
