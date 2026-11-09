import type { PortfolioViewEntry, ResumeEntryKind } from "./resume-entries";
import type { PortfolioBlock } from "@rezumi/schema/portfolio/blocks";
import type {
	PORTFOLIO_BUTTON_KINDS,
	PortfolioButton,
	PortfolioData,
	PortfolioLocation,
	PortfolioWork,
} from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import type {
	PortfolioResumeSection,
	PortfolioSectionKey,
	PortfolioStandardSection,
} from "@rezumi/schema/portfolio/sections";
import type {
	PortfolioFontPairId,
	PortfolioHeroEffect,
	PortfolioScheme,
	PortfolioTheme,
	PortfolioVariantKey,
	PortfolioVariantValue,
} from "@rezumi/schema/portfolio/themes";
import type { CustomSectionItem, ResumeData } from "@rezumi/schema/resume/data";
import type { Locale } from "@rezumi/utils/locale";
import { getWebFont } from "@rezumi/fonts";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { isAllowedPortfolioUrl, PORTFOLIO_WEB_PROTOCOLS } from "@rezumi/schema/portfolio/links";
import { isPortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import {
	fallbackPortfolioAccent,
	PORTFOLIO_ACCENTS,
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_MONO_FONT,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_VARIANT_KEYS,
	themeEffect,
	themeFontPair,
	themeScheme,
	themeVariant,
} from "@rezumi/schema/portfolio/themes";
import { parseColorString, rgbaStringToHex } from "@rezumi/utils/color";
import { defaultLocale, isLocale, isRTL } from "@rezumi/utils/locale";
import { customSectionEntries, isResumeEntryKind, resumeEntries } from "./resume-entries";
import { htmlToText, truncateText } from "./text";

export type { PortfolioViewEntry } from "./resume-entries";

type ButtonKind = (typeof PORTFOLIO_BUTTON_KINDS)[number];

/** Whether a metric has what the page needs to show it: a label and a value. */
function isMetricComplete(metric: PortfolioMetric): boolean {
	return metric.label.trim() !== "" && (metric.value.kind === "number" || metric.value.text.trim() !== "");
}

/** Interface text in the page's language, from the portfolio catalog (`portfolioViewMessages`, `02-teknis.md` 5.5). */
export type PortfolioViewMessages = {
	sections: Record<PortfolioStandardSection, string>;
	buttons: Record<ButtonKind, string>;
	openToWork: string;
	/** The WhatsApp message a service's order button starts with. */
	serviceInquiry: (service: string) => string;
};

export type PortfolioViewInput = {
	portfolio: { data: PortfolioData };
	/** The source resume while it's active (not in Trash); null when the portfolio has none. */
	resume: { data: ResumeData } | null;
	owner: { name: string; username: string };
	entitlements: { hidePortfolioCredit: boolean };
	messages: PortfolioViewMessages;
	/** The public address of a stored file (an image or PDF key). */
	fileUrl: (key: string) => string;
	/** The source resume's web page and PDF, when they are shared; buttons to them are left out otherwise. */
	links?: { resume?: string | null; resumePdf?: string | null };
	/** Whether the contact form can work here (Turnstile is set up). */
	contactFormAvailable?: boolean;
	/**
	 * The editor's preview only: the work being edited. Its detail stays in the page even while the Work section is
	 * hidden or the work is still untitled, so the preview can show it open. Public pages leave it out: there a detail
	 * exists only for a work the shown Work section lists.
	 */
	openWorkId?: string | null;
};

export type PortfolioViewImage = {
	src: string;
	/** An 800 px copy for cards, when there is one. */
	srcSmall?: string;
	width?: number;
	height?: number;
	alt: string;
	focus?: { x: number; y: number };
};

export type PortfolioViewLink = {
	label: string;
	href: string;
	external: boolean;
	/** What the button does, for its icon; absent on links that aren't buttons. */
	kind?: ButtonKind;
};

export type PortfolioViewBlock =
	| { id: string; type: "text"; html: string }
	| {
			id: string;
			type: "images";
			layout: "full" | "grid" | "carousel";
			images: (PortfolioViewImage & { caption?: string })[];
	  }
	| { id: string; type: "metrics"; items: PortfolioMetric[] }
	| {
			id: string;
			type: "video";
			provider: "youtube" | "vimeo";
			title: string;
			/** The video's own page, for visitors without JavaScript. */
			href: string;
			/** The player, loaded only after the visitor presses play. */
			embedUrl: string;
			/** The thumbnail's copy in the portfolio's storage; the page never loads YouTube's or Vimeo's. */
			thumbnail: PortfolioViewImage | null;
	  }
	| {
			id: string;
			type: "pdf";
			title: string;
			href: string;
			pages: number;
			bytes: number | null;
			preview: PortfolioViewImage | null;
	  }
	| {
			id: string;
			type: "link";
			href: string;
			title: string;
			description: string;
			siteName: string;
			image: PortfolioViewImage | null;
			brandIcon: string | null;
	  };

export type PortfolioViewWork = {
	id: string;
	slug: string;
	/** The detail's anchor: #work-<slug>. Slugs never hold `--`, so heading ids (`<anchor>--title`) can't match one. */
	anchor: string;
	title: string;
	summary: string;
	role: string;
	date: string;
	tags: string[];
	cover: PortfolioViewImage | null;
	featured: boolean;
	highlight: PortfolioMetric | null;
	primaryLink: PortfolioViewLink | null;
	blocks: PortfolioViewBlock[];
};

export type PortfolioViewLocation = {
	label: string;
	point: PortfolioLocation["point"] | null;
	map: { light: PortfolioViewImage; dark: PortfolioViewImage } | null;
	workModes: PortfolioLocation["workModes"];
	relocate: boolean;
	timezone: string | null;
	showLocalTime: boolean;
};

export type PortfolioViewContact = {
	note: string;
	email: string | null;
	phone: string | null;
	website: PortfolioViewLink | null;
	whatsapp: { number: string; href: string } | null;
	profiles: { id: string; network: string; username: string; icon: string; href: string | null }[];
	form: boolean;
	location: PortfolioViewLocation | null;
};

type ResumeSectionItem<K extends PortfolioResumeSection> = ResumeData["sections"][K]["items"][number];
type SectionBase<Kind extends string, Key extends PortfolioSectionKey> = {
	kind: Kind;
	key: Key;
	/** The id its `#link` targets, unique on the page and safe as written (`sectionAnchor`). */
	anchor: string;
	title: string;
};

export type PortfolioViewSection =
	| (SectionBase<"about", "about"> & { html: string })
	| (SectionBase<"work", "work"> & { works: PortfolioViewWork[] })
	| (SectionBase<"services", "services"> & {
			services: {
				id: string;
				title: string;
				description: string;
				price: string;
				icon: string | null;
				cta: PortfolioViewLink | null;
			}[];
	  })
	| (SectionBase<"testimonials", "testimonials"> & {
			testimonials: {
				id: string;
				quote: string;
				name: string;
				role: string;
				photo: PortfolioViewImage | null;
				/** Up to two letters for the avatar when there's no photo. */
				initials: string;
				sourceUrl: string | null;
			}[];
	  })
	| (SectionBase<"clients", "clients"> & {
			clients: {
				id: string;
				name: string;
				logo: PortfolioViewImage | null;
				brandIcon: string | null;
				href: string | null;
			}[];
	  })
	| {
			[K in PortfolioResumeSection]: SectionBase<K, K> & {
				/** The resume's items as they are, without the hidden ones and with their links made safe. */
				items: ResumeSectionItem<K>[];
				/** The same items as the page draws them. */
				entries: PortfolioViewEntry[];
			};
	  }[PortfolioResumeSection]
	| (SectionBase<"custom", `custom:${string}`> & {
			html: string;
			image: PortfolioViewImage | null;
			button: PortfolioViewLink | null;
	  })
	| (SectionBase<"resume", `resume:${string}`> & {
			type: ResumeEntryKind;
			items: CustomSectionItem[];
			entries: PortfolioViewEntry[];
	  })
	| (SectionBase<"contact", "contact"> & { contact: PortfolioViewContact });

export type PortfolioView = {
	theme: PortfolioTheme;
	locale: Locale;
	dir: "ltr" | "rtl";
	design: {
		scheme: PortfolioScheme;
		/** The accent as chosen, #rrggbb; the renderer derives contrast-safe tones from it. */
		accent: string;
		fonts: {
			heading: string;
			body: string;
			mono: string;
			/** Null when the fonts follow the resume. */
			pair: PortfolioFontPairId | null;
			nameStretch: string | null;
			nameUppercase: boolean;
		};
		variants: { [K in PortfolioVariantKey]: PortfolioVariantValue<K> };
		effect: { id: PortfolioHeroEffect; target: "name" | "headline"; phrases: string[] };
	};
	basics: {
		name: string;
		headline: string;
		location: string;
		/** The photo, everywhere it shows (intro, share card, search engines); null when the intro shows none. */
		picture: PortfolioViewImage | null;
		initials: string;
		/** Letters in the name's longest word, to size very long names (`--name-word`). */
		longestWord: number;
	};
	hero: {
		greeting: string;
		/** The photo, unless the intro hides it. */
		picture: PortfolioViewImage | null;
		availability: string | null;
		highlights: PortfolioMetric[];
		buttons: PortfolioViewLink[];
		background: { kind: PortfolioData["hero"]["background"]["kind"]; image: PortfolioViewImage | null };
	};
	/** Sections in order, without hidden or empty ones. The intro isn't one: it is always first. */
	sections: PortfolioViewSection[];
	/**
	 * The works whose details the page holds: the shown Work section's, in its order, and none when that section is
	 * hidden or empty (plus the work being edited, in the editor's preview; `openWorkId`).
	 */
	works: PortfolioViewWork[];
	location: PortfolioViewLocation | null;
	seo: { title: string; description: string };
	credit: boolean;
};

/** Work layouts that draw the first work larger: a featured work goes there (`PortfolioWork.featured`). */
const FEATURED_WORK_VARIANTS = new Set<string>(["featured-grid", "bento"]);

/** Letters and digits with single dashes between them: safe in an id, a `#fragment` and a CSS selector as written. */
const SAFE_ANCHOR_PART = /^[\da-z]+(?:-[\da-z]+)*$/i;

/** A short, stable hash of text in base 36 (32-bit FNV-1a): the same text always gives the same anchor. */
function hashText(text: string): string {
	let hash = 0x81_1c_9d_c5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01_00_01_93);
	}
	return (hash >>> 0).toString(36);
}

/**
 * A section's anchor: a standard section's own name, or `custom-<id>` and `resume-<id>` for the portfolio's and the
 * resume's own sections. An ID that isn't letters and digits with single dashes (a resume takes any text as an ID)
 * becomes `x` and a hash of itself, so every anchor is safe in a `#fragment`, an HTML id and a CSS selector, and none
 * holds the `--` that heading ids are made with (`<anchor>--title`).
 */
function sectionAnchor(key: PortfolioSectionKey): string {
	const separator = key.indexOf(":");
	if (separator < 0) return key;
	const id = key.slice(separator + 1);
	return `${key.slice(0, separator)}-${SAFE_ANCHOR_PART.test(id) ? id : `x${hashText(id)}`}`;
}

/** A domain written without its scheme, as resumes often hold it: `github.com/nadia`, `nadia.design`. */
const BARE_DOMAIN = /^[\da-z][\da-z-]*(?:\.[\da-z-]+)+(?::\d+)?(?:[/?#]|$)/i;

/**
 * A web address from the resume as the page may link to it: absolute http or https only. The resume takes any text,
 * so a bare domain gets `https://`, and anything else (`javascript:`, `data:`, a relative path, `//host`) is left out.
 */
function resumeWebUrl(value: unknown): string | null {
	const url = typeof value === "string" ? value.trim() : "";
	if (!url) return null;
	const absolute = BARE_DOMAIN.test(url) ? `https://${url}` : url;
	return isAllowedPortfolioUrl(absolute, PORTFOLIO_WEB_PROTOCOLS) ? absolute : null;
}

/** A resume item with its website made safe (`resumeWebUrl`, empty when it isn't); items without one stay as they are. */
function withSafeWebsite<T extends object>(item: T): T {
	if (!("website" in item)) return item;
	const website = item.website as { url?: unknown } | null | undefined;
	if (!website || typeof website !== "object") return item;
	return { ...item, website: { ...website, url: resumeWebUrl(website.url) ?? "" } } as T;
}

/**
 * Decimals a location's point keeps at each precision: about a kilometre for a city (as the editor rounds a moved pin),
 * whole degrees (about 100 km) for a region or a country, so neither can name a city, even one that's alone in its
 * province, where older data may hold that city's own point.
 */
const POINT_DECIMALS = { city: 2, region: 0, country: 0 } as const;

/**
 * A location's point rounded to its precision, so the page (its "Open in map" link, the data the renderer gets) never
 * says more than the person chose to show, whatever the editor saved.
 */
function roundPoint(point: NonNullable<PortfolioLocation["point"]>): NonNullable<PortfolioLocation["point"]> {
	const factor = 10 ** POINT_DECIMALS[point.precision];
	const round = (value: number, limit: number) =>
		Math.max(-limit, Math.min(limit, Math.round(value * factor) / factor)) || 0;
	return { lat: round(point.lat, 90), lng: round(point.lng, 180), precision: point.precision };
}

function toHex(color: string): string | null {
	return parseColorString(color) ? rgbaStringToHex(color).toUpperCase() : null;
}

function longestWord(name: string): number {
	return Math.max(1, ...name.split(/\s+/).map((word) => [...word].length));
}

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => [...word][0] ?? "")
		.join("")
		.toUpperCase();
}

/**
 * The page's language: the portfolio's own, else the source resume's, else the default. The one rule the page, its
 * interface text, the editor and the preview tools all use.
 */
export function portfolioPageLocale(
	data: Pick<PortfolioData, "locale">,
	resume: ResumeData | null | undefined,
): Locale {
	const resumeLocale = resume?.metadata.page.locale;
	return data.locale ?? (isLocale(resumeLocale) ? resumeLocale : defaultLocale);
}

/**
 * Everything a portfolio page shows, resolved once for every theme (`02-teknis.md` 4.3): basics from the portfolio,
 * then the source resume, then the account; career sections read live from the resume without the sections and items
 * it hides, the items the portfolio hides, or references, with their links made safe and each item read once into
 * the entry every theme draws (`resumeEntries`); contact details by the portfolio's own privacy settings; theme
 * defaults wherever the portfolio has made no choice. Pure: the same input always gives the same view.
 */
export function buildPortfolioView(input: PortfolioViewInput): PortfolioView {
	const { data } = input.portfolio;
	const resume = input.resume?.data ?? null;
	const { messages } = input;
	const theme = data.theme;

	const image = (value: PortfolioImage | null | undefined, alt?: string): PortfolioViewImage | null => {
		if (!value) return null;
		return {
			src: input.fileUrl(value.key),
			...(value.thumbKey ? { srcSmall: input.fileUrl(value.thumbKey) } : {}),
			width: value.width,
			height: value.height,
			alt: value.alt || alt || "",
		};
	};

	const locale = portfolioPageLocale(data, resume);

	const name =
		data.basics.name?.trim() || resume?.basics.name.trim() || input.owner.name.trim() || input.owner.username;
	const headline = data.basics.headline?.trim() || resume?.basics.headline.trim() || "";
	const basicsLocation = data.hero.showLocation
		? data.basics.location?.trim() || resume?.basics.location.trim() || ""
		: "";

	// "No photo" in the intro means no photo anywhere: not on the share card or for search engines either.
	let picture: PortfolioViewImage | null = null;
	if (!data.hero.showPicture) picture = null;
	else if (data.basics.picture) picture = image(data.basics.picture, name);
	else if (data.basics.picture === undefined && resume && !resume.picture.hidden && resume.picture.url.trim())
		picture = { src: resume.picture.url.trim(), alt: name };

	// Contact details come from the resume, shown by the portfolio's own settings.
	const email = resume?.basics.email.trim() || "";
	const phone = resume?.basics.phone.trim() || "";
	const website = resumeWebUrl(resume?.basics.website.url);
	const whatsappNumber = data.contact.whatsapp.number;
	const whatsappHref = (text?: string) =>
		`https://wa.me/${whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

	const hiddenItems = (key: PortfolioSectionKey) => new Set(data.sections.hiddenItems[key] ?? []);
	// Items hidden in the resume or on the portfolio stay off the page; the rest have their website made safe.
	const visible = <T extends { id: string; hidden: boolean }>(key: PortfolioSectionKey, items: readonly T[]) => {
		const hidden = hiddenItems(key);
		return items.filter((item) => !item.hidden && !hidden.has(item.id)).map((item) => withSafeWebsite(item));
	};

	const location = buildLocation(data.location, basicsLocation, image);
	const contactSection = buildContact();
	// Buttons lead to Contact only when the page shows it.
	const hasContact = contactSection !== null && !data.sections.hidden.includes("contact");

	const link = (button: PortfolioButton, fallbackLabel = messages.buttons[button.kind]): PortfolioViewLink | null => {
		const label = button.label?.trim() || fallbackLabel;
		const { kind } = button;
		switch (kind) {
			case "resume":
				return input.links?.resume ? { label, href: input.links.resume, external: false, kind } : null;
			case "pdf":
				return input.links?.resumePdf ? { label, href: input.links.resumePdf, external: false, kind } : null;
			case "contact":
				return hasContact ? { label, href: "#contact", external: false, kind } : null;
			case "whatsapp":
				return whatsappNumber ? { label, href: whatsappHref(), external: true, kind } : null;
			case "email":
				return email ? { label, href: `mailto:${email}`, external: false, kind } : null;
			case "profile":
			case "link":
				return button.url ? { label, href: button.url, external: !button.url.startsWith("mailto:"), kind } : null;
		}
	};

	// Works the page lists: shown and titled (an untitled work is still being written). Layouts that draw the first work
	// larger put featured works first, keeping their order.
	const listed = data.works.items.filter((work) => !work.hidden && work.title.trim()).map((work) => buildWork(work));
	const works = FEATURED_WORK_VARIANTS.has(themeVariant(theme, "work", data.design.variants.work))
		? [...listed.filter((work) => work.featured), ...listed.filter((work) => !work.featured)]
		: listed;
	const aboutText = htmlToText(data.about.content);

	const sections = resolveSectionOrder(data, theme, resume)
		.filter((key) => !data.sections.hidden.includes(key))
		.map((key) => buildSection(key))
		.filter((section): section is PortfolioViewSection => section !== null);
	// Anchors are unique by construction; a hash collision between two odd IDs still can't give two elements one id.
	const anchors = new Set<string>();
	for (const section of sections) {
		let anchor = section.anchor;
		for (let count = 2; anchors.has(anchor); count++) anchor = `${section.anchor}-${count}`;
		anchors.add(anchor);
		section.anchor = anchor;
	}

	// Details exist only for the works the shown Work section lists, so a hidden section publishes none of them.
	const workSection = sections.find((section) => section.kind === "work");
	const detailWorks = workSection?.kind === "work" ? [...workSection.works] : [];
	const editing = input.openWorkId ? data.works.items.find((work) => work.id === input.openWorkId) : undefined;
	if (editing && !editing.hidden && !detailWorks.some((work) => work.id === editing.id))
		detailWorks.push(buildWork(editing));

	const fonts = resolveFonts();
	const accent = resolveAccent();
	const effect = themeEffect(theme, data.hero.effect.id);

	return {
		theme,
		locale,
		dir: isRTL(locale) ? "rtl" : "ltr",
		design: {
			scheme: themeScheme(theme, data.design.scheme),
			accent,
			fonts,
			variants: Object.fromEntries(
				PORTFOLIO_VARIANT_KEYS.map((key) => [key, themeVariant(theme, key, data.design.variants[key])]),
			) as PortfolioView["design"]["variants"],
			effect: {
				id: effect,
				target: data.hero.effect.target,
				phrases: data.hero.effect.phrases.map((phrase) => phrase.trim()).filter(Boolean),
			},
		},
		basics: {
			name,
			headline,
			location: basicsLocation,
			picture,
			initials: initials(name),
			longestWord: longestWord(name),
		},
		hero: {
			greeting: data.hero.greeting.trim(),
			picture,
			availability: data.hero.availability.show ? data.hero.availability.text.trim() || messages.openToWork : null,
			highlights: data.hero.highlights.filter(isMetricComplete),
			buttons: data.hero.buttons.map((button) => link(button)).filter((item): item is PortfolioViewLink => !!item),
			background: {
				kind:
					data.hero.background.kind === "image" && !data.hero.background.image ? "plain" : data.hero.background.kind,
				image: data.hero.background.kind === "image" ? image(data.hero.background.image) : null,
			},
		},
		sections,
		works: detailWorks,
		location,
		seo: {
			title: data.seo.title?.trim() || (headline ? `${name} — ${headline}` : name),
			description:
				data.seo.description?.trim() ||
				data.hero.greeting.trim() ||
				(aboutText ? truncateText(aboutText, PORTFOLIO_LIMITS.text.seoDescription) : "") ||
				headline,
		},
		credit: data.credit.show || !input.entitlements.hidePortfolioCredit,
	};

	function resolveAccent(): string {
		const { accent } = data.design;
		if (accent.source === "custom") return accent.color.toUpperCase();
		if (accent.source === "preset") return PORTFOLIO_ACCENTS[accent.id].color;
		const fromResume = resume ? toHex(resume.metadata.design.colors.primary) : null;
		return fromResume ?? PORTFOLIO_THEME_INFO[theme].fallbackAccent ?? PORTFOLIO_ACCENTS[fallbackPortfolioAccent].color;
	}

	function resolveFonts(): PortfolioView["design"]["fonts"] {
		const mono = PORTFOLIO_THEME_INFO[theme].monoFont ?? PORTFOLIO_MONO_FONT;
		const pairFonts = (id: PortfolioFontPairId) => {
			const pair: { heading: string; body: string; nameStretch?: string; nameUppercase?: boolean } =
				PORTFOLIO_FONT_PAIRS[id];
			return {
				heading: pair.heading,
				body: pair.body,
				mono,
				pair: id,
				nameStretch: pair.nameStretch ?? null,
				nameUppercase: pair.nameUppercase ?? false,
			};
		};
		const { fonts } = data.design;
		if (fonts.source === "pair") return pairFonts(themeFontPair(theme, fonts.id));
		if (fonts.source === "resume" && resume) {
			const uploaded = new Set((resume.metadata.typography.customFonts ?? []).map((font) => font.family));
			// Uploaded fonts and the PDF-only standard ones (Helvetica, Times) can't load on the page.
			const usable = (family: string) => !uploaded.has(family) && Boolean(getWebFont(family));
			const heading = resume.metadata.typography.heading.fontFamily;
			const body = resume.metadata.typography.body.fontFamily;
			if (usable(heading) && usable(body))
				return { heading, body, mono, pair: null, nameStretch: null, nameUppercase: false };
		}
		return pairFonts(themeFontPair(theme, undefined));
	}

	function buildWork(work: PortfolioWork): PortfolioViewWork {
		const metrics = work.blocks
			.flatMap((block) => (block.type === "metrics" ? block.items : []))
			.filter(isMetricComplete);
		const cover = image(work.cover, work.title);
		return {
			id: work.id,
			slug: work.slug,
			anchor: `work-${work.slug}`,
			title: work.title.trim(),
			summary: work.summary,
			role: work.role,
			date: work.date,
			tags: work.tags.filter((tag) => tag.trim()),
			cover: cover && work.cover?.focus ? { ...cover, focus: work.cover.focus } : cover,
			featured: work.featured,
			highlight: metrics.find((metric) => metric.id === work.highlightMetricId) ?? null,
			primaryLink: work.primaryLink
				? {
						label: work.primaryLink.label.trim() || messages.buttons.link,
						href: work.primaryLink.url,
						external: !work.primaryLink.url.startsWith("mailto:"),
					}
				: null,
			blocks: work.blocks.map((block) => buildBlock(block)).filter((block): block is PortfolioViewBlock => !!block),
		};
	}

	function buildBlock(block: PortfolioBlock): PortfolioViewBlock | null {
		switch (block.type) {
			case "text":
				return htmlToText(block.html) ? block : null;
			case "images": {
				const images = block.images.flatMap((item) => {
					const view = image(item);
					return view ? [{ ...view, ...(item.caption?.trim() ? { caption: item.caption.trim() } : {}) }] : [];
				});
				return images.length ? { id: block.id, type: "images", layout: block.layout, images } : null;
			}
			case "metrics": {
				// A metric still being filled in (no label yet) stays off the page.
				const items = block.items.filter(isMetricComplete);
				return items.length ? { ...block, items } : null;
			}
			case "video": {
				const { provider, videoId, hash } = block;
				return {
					id: block.id,
					type: "video",
					provider,
					title: block.title?.trim() ?? "",
					href:
						provider === "youtube"
							? `https://www.youtube.com/watch?v=${videoId}`
							: `https://vimeo.com/${videoId}${hash ? `/${hash}` : ""}`,
					embedUrl:
						provider === "youtube"
							? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`
							: `https://player.vimeo.com/video/${videoId}?dnt=1&autoplay=1${hash ? `&h=${hash}` : ""}`,
					thumbnail: image(block.thumbnail, block.title),
				};
			}
			case "pdf":
				return {
					id: block.id,
					type: "pdf",
					title: block.title,
					href: input.fileUrl(block.file),
					pages: block.pages,
					bytes: block.bytes ?? null,
					preview: image(block.preview, block.title),
				};
			case "link":
				return {
					id: block.id,
					type: "link",
					href: block.url,
					title: block.title.trim() || block.url,
					description: block.description?.trim() ?? "",
					siteName: block.siteName?.trim() ?? "",
					image: image(block.image, block.title),
					brandIcon: block.brandIcon ?? null,
				};
		}
	}

	function buildContact(): PortfolioViewContact | null {
		const { contact } = data;
		// Profiles hidden in the resume, as a whole section or one by one, stay hidden here too.
		const profiles =
			contact.profiles && resume && !resume.sections.profiles.hidden
				? visible("profiles", resume.sections.profiles.items)
						.filter((item) => item.network.trim() || item.website.url)
						.map((item) => ({
							id: item.id,
							network: item.network.trim(),
							username: item.username.trim(),
							icon: item.icon,
							href: item.website.url || null,
						}))
				: [];
		const view: PortfolioViewContact = {
			note: contact.note.trim(),
			email: contact.email && email ? email : null,
			phone: contact.phone && phone ? phone : null,
			website:
				contact.website && website
					? { label: resume?.basics.website.label.trim() || website, href: website, external: true }
					: null,
			whatsapp: contact.whatsapp.show && whatsappNumber ? { number: whatsappNumber, href: whatsappHref() } : null,
			profiles,
			form: contact.form && (input.contactFormAvailable ?? false),
			location,
		};
		// A profile without an address draws nothing in Contact, so it doesn't keep an otherwise empty section.
		const empty =
			!view.email &&
			!view.phone &&
			!view.website &&
			!view.whatsapp &&
			!profiles.some((profile) => profile.href) &&
			!view.form &&
			!location;
		return empty ? null : view;
	}

	function buildSection(key: PortfolioSectionKey): PortfolioViewSection | null {
		const anchor = sectionAnchor(key);
		const custom = data.sections.titles[key]?.trim();
		const title = (fallback: string) => custom || fallback;

		if (key.startsWith("custom:")) {
			const section = data.custom.find((item) => `custom:${item.id}` === key);
			if (!section || section.hidden) return null;
			const sectionImage = image(section.image, section.title);
			const html = htmlToText(section.content) ? section.content : "";
			if (!html && !sectionImage) return null;
			return {
				kind: "custom",
				key: key as `custom:${string}`,
				anchor,
				title: title(section.title.trim()),
				html,
				image: sectionImage,
				button: section.button ? link(section.button) : null,
			};
		}

		if (key.startsWith("resume:")) {
			// What's hidden in the resume stays hidden on the portfolio: the section as a whole, and its items.
			const section = resume?.customSections.find((item) => `resume:${item.id}` === key);
			if (!section || section.hidden || !isResumeEntryKind(section.type)) return null;
			const items = visible(key, section.items);
			if (!items.length) return null;
			return {
				kind: "resume",
				key: key as `resume:${string}`,
				anchor,
				title: title(section.title.trim()),
				type: section.type,
				items,
				entries: customSectionEntries(section.type, items),
			};
		}

		const standard = key as PortfolioStandardSection;
		const base = { anchor, title: title(messages.sections[standard]) };
		switch (standard) {
			case "about":
				return aboutText ? { ...base, kind: "about", key: "about", html: data.about.content } : null;
			case "work":
				return works.length ? { ...base, kind: "work", key: "work", works } : null;
			case "services": {
				const services = data.services.items
					.filter((item) => item.title.trim())
					.map((item) => ({
						id: item.id,
						title: item.title.trim(),
						description: item.description.trim(),
						price: item.price?.trim() ?? "",
						icon: item.icon ?? null,
						cta:
							item.cta.kind === "whatsapp"
								? whatsappNumber
									? {
											label: item.cta.label?.trim() || messages.buttons.whatsapp,
											href: whatsappHref(messages.serviceInquiry(item.title.trim())),
											external: true,
										}
									: null
								: link(item.cta),
					}));
				return services.length ? { ...base, kind: "services", key: "services", services } : null;
			}
			case "testimonials": {
				const testimonials = data.testimonials.items
					.filter((item) => item.consent && item.quote.trim())
					.map((item) => ({
						id: item.id,
						quote: item.quote.trim(),
						name: item.name.trim(),
						role: item.role.trim(),
						photo: image(item.photo, item.name),
						initials: initials(item.name.trim()),
						sourceUrl: item.sourceUrl ?? null,
					}));
				return testimonials.length ? { ...base, kind: "testimonials", key: "testimonials", testimonials } : null;
			}
			case "clients": {
				const clients = data.clients.items
					.filter((item) => item.name.trim() || item.logo)
					.map((item) => ({
						id: item.id,
						name: item.name.trim(),
						logo: item.logo && "key" in item.logo ? image(item.logo, item.name) : null,
						brandIcon: item.logo && "brandIcon" in item.logo ? item.logo.brandIcon : null,
						href: item.url ?? null,
					}));
				return clients.length ? { ...base, kind: "clients", key: "clients", clients } : null;
			}
			case "contact":
				return contactSection ? { ...base, kind: "contact", key: "contact", contact: contactSection } : null;
			default: {
				if (!resume || resume.sections[standard].hidden) return null;
				const items = visible<ResumeSectionItem<typeof standard>>(standard, resume.sections[standard].items);
				if (!items.length) return null;
				// One object for whichever resume section this is: TypeScript can't pair the key with its items' type.
				return {
					...base,
					kind: standard,
					key: standard,
					items,
					entries: resumeEntries(standard, items),
				} as PortfolioViewSection;
			}
		}
	}

	function buildLocation(
		value: PortfolioLocation,
		fallbackLabel: string,
		toImage: typeof image,
	): PortfolioViewLocation | null {
		const label = value.label.trim() || fallbackLabel;
		const map =
			value.showMap && value.map
				? {
						light: toImage(value.map.light, label) as PortfolioViewImage,
						dark: toImage(value.map.dark, label) as PortfolioViewImage,
					}
				: null;
		if (!label && !map && !value.workModes.length && !value.relocate) return null;
		return {
			label,
			point: value.point ? roundPoint(value.point) : null,
			map,
			workModes: value.workModes,
			relocate: value.relocate,
			timezone: value.timezone ?? null,
			showLocalTime: value.showLocalTime && Boolean(value.timezone),
		};
	}
}

/**
 * The order sections appear in: the portfolio's own order, with sections it doesn't mention placed where the theme
 * puts them (after the nearest earlier one), and its free sections and the resume's custom sections before Contact.
 */
export function resolveSectionOrder(
	data: PortfolioData,
	theme: PortfolioTheme,
	resume: ResumeData | null,
): PortfolioSectionKey[] {
	const themeOrder = PORTFOLIO_THEME_INFO[theme].sectionOrder;
	// Each key once (nothing stops a resume from giving two of its custom sections one ID), and only keys the portfolio
	// can store: a resume section whose ID no key can hold (empty, too long) never reaches an order the server refuses.
	const extras: PortfolioSectionKey[] = [
		...new Set<PortfolioSectionKey>([
			...data.custom.map((section) => `custom:${section.id}` as const),
			...(resume?.customSections ?? [])
				.filter((section) => isResumeEntryKind(section.type))
				.map((section) => `resume:${section.id}` as const),
		]),
	].filter((key) => isPortfolioSectionKey(key));
	const known = new Set<PortfolioSectionKey>([...themeOrder, ...extras]);
	const result = data.sections.order.filter((key) => known.has(key));

	themeOrder.forEach((key, index) => {
		if (result.includes(key)) return;
		let position = 0;
		for (let earlier = index - 1; earlier >= 0; earlier--) {
			const found = result.indexOf(themeOrder[earlier] as PortfolioStandardSection);
			if (found >= 0) {
				position = found + 1;
				break;
			}
		}
		result.splice(position, 0, key);
	});

	const missing = extras.filter((key) => !result.includes(key));
	const contact = result.indexOf("contact");
	result.splice(contact >= 0 ? contact : result.length, 0, ...missing);
	return result;
}
