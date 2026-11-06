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
import type { CustomSectionItem, CustomSectionType, ResumeData } from "@rezumi/schema/resume/data";
import type { Locale } from "@rezumi/utils/locale";
import { getWebFont } from "@rezumi/fonts";
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
import { youtubeThumbnailUrl } from "@rezumi/schema/portfolio/video";
import { parseColorString, rgbaStringToHex } from "@rezumi/utils/color";
import { defaultLocale, isLocale, isRTL } from "@rezumi/utils/locale";
import { htmlToText, truncateText } from "./text";

type ButtonKind = (typeof PORTFOLIO_BUTTON_KINDS)[number];

/** Interface text in the page's language. Phase 02 builds it from the portfolio catalog (`02-teknis.md` 5.5). */
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

export type PortfolioViewLink = { label: string; href: string; external: boolean };

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
			thumbnail: string | null;
	  }
	| { id: string; type: "pdf"; title: string; href: string; pages: number; preview: PortfolioViewImage | null }
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
	/** The detail's anchor: #work-<slug>. */
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
	| { [K in PortfolioResumeSection]: SectionBase<K, K> & { items: ResumeSectionItem<K>[] } }[PortfolioResumeSection]
	| (SectionBase<"custom", `custom:${string}`> & {
			html: string;
			image: PortfolioViewImage | null;
			button: PortfolioViewLink | null;
	  })
	| (SectionBase<"resume", `resume:${string}`> & { type: CustomSectionType; items: CustomSectionItem[] })
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
	/** Shown works, for their detail panels. */
	works: PortfolioViewWork[];
	location: PortfolioViewLocation | null;
	seo: { title: string; description: string };
	credit: boolean;
};

/** English interface text; tests and callers without a catalog use it. */
export const englishPortfolioViewMessages: PortfolioViewMessages = {
	sections: {
		about: "About",
		work: "Work",
		services: "Services",
		testimonials: "Testimonials",
		clients: "Clients",
		experience: "Experience",
		education: "Education",
		skills: "Skills",
		languages: "Languages",
		certifications: "Certifications",
		awards: "Awards",
		publications: "Publications",
		volunteer: "Volunteering",
		interests: "Interests",
		profiles: "Profiles",
		contact: "Contact",
	},
	buttons: {
		resume: "View resume",
		pdf: "Download PDF",
		contact: "Send a message",
		whatsapp: "WhatsApp",
		email: "Email",
		profile: "Profile",
		link: "Open link",
	},
	openToWork: "Open to work",
	serviceInquiry: (service) => `Hello, I'm interested in your service: ${service}`,
};

const EXCLUDED_RESUME_CUSTOM_TYPES = new Set<CustomSectionType>(["cover-letter", "references"]);

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
 * Everything a portfolio page shows, resolved once for every theme (`02-teknis.md` 4.3): basics from the portfolio,
 * then the source resume, then the account; career sections read live from the resume without its hidden items, the
 * items the portfolio hides, or references; contact details by the portfolio's own privacy settings; theme defaults
 * wherever the portfolio has made no choice. Pure: the same input always gives the same view.
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

	const resumeLocale = resume?.metadata.page.locale;
	const locale = data.locale ?? (isLocale(resumeLocale) ? resumeLocale : defaultLocale);

	const name =
		data.basics.name?.trim() || resume?.basics.name.trim() || input.owner.name.trim() || input.owner.username;
	const headline = data.basics.headline?.trim() || resume?.basics.headline.trim() || "";
	const basicsLocation = data.basics.location?.trim() || resume?.basics.location.trim() || "";

	let picture: PortfolioViewImage | null = null;
	if (data.basics.picture) picture = image(data.basics.picture, name);
	else if (data.basics.picture === undefined && resume && !resume.picture.hidden && resume.picture.url.trim())
		picture = { src: resume.picture.url.trim(), alt: name };

	// Contact details come from the resume, shown by the portfolio's own settings.
	const email = resume?.basics.email.trim() || "";
	const phone = resume?.basics.phone.trim() || "";
	const website = resume?.basics.website.url.trim() || "";
	const whatsappNumber = data.contact.whatsapp.number;
	const whatsappHref = (text?: string) =>
		`https://wa.me/${whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

	const hiddenItems = (key: PortfolioSectionKey) => new Set(data.sections.hiddenItems[key] ?? []);
	const visible = <T extends { id: string; hidden: boolean }>(key: PortfolioSectionKey, items: readonly T[]) => {
		const hidden = hiddenItems(key);
		return items.filter((item) => !item.hidden && !hidden.has(item.id));
	};

	const location = buildLocation(data.location, basicsLocation, image);
	const contactSection = buildContact();
	const hasContact = contactSection !== null;

	const link = (button: PortfolioButton, fallbackLabel = messages.buttons[button.kind]): PortfolioViewLink | null => {
		const label = button.label?.trim() || fallbackLabel;
		switch (button.kind) {
			case "resume":
				return input.links?.resume ? { label, href: input.links.resume, external: false } : null;
			case "pdf":
				return input.links?.resumePdf ? { label, href: input.links.resumePdf, external: false } : null;
			case "contact":
				return hasContact ? { label, href: "#contact", external: false } : null;
			case "whatsapp":
				return whatsappNumber ? { label, href: whatsappHref(), external: true } : null;
			case "email":
				return email ? { label, href: `mailto:${email}`, external: false } : null;
			case "profile":
			case "link":
				return button.url ? { label, href: button.url, external: !button.url.startsWith("mailto:") } : null;
		}
	};

	const works = data.works.items.filter((work) => !work.hidden).map((work) => buildWork(work));
	const aboutText = htmlToText(data.about.content);

	const sections = resolveSectionOrder(data, theme, resume)
		.filter((key) => !data.sections.hidden.includes(key))
		.map((key) => buildSection(key))
		.filter((section): section is PortfolioViewSection => section !== null);

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
			picture: data.hero.showPicture ? picture : null,
			availability: data.hero.availability.show ? data.hero.availability.text.trim() || messages.openToWork : null,
			highlights: data.hero.highlights,
			buttons: data.hero.buttons.map((button) => link(button)).filter((item): item is PortfolioViewLink => !!item),
			background: {
				kind:
					data.hero.background.kind === "image" && !data.hero.background.image ? "plain" : data.hero.background.kind,
				image: data.hero.background.kind === "image" ? image(data.hero.background.image) : null,
			},
		},
		sections,
		works,
		location,
		seo: {
			title: data.seo.title?.trim() || (headline ? `${name} — ${headline}` : name),
			description:
				data.seo.description?.trim() ||
				data.hero.greeting.trim() ||
				(aboutText ? truncateText(aboutText, 160) : "") ||
				headline,
		},
		credit: data.credit.show || !input.entitlements.hidePortfolioCredit,
	};

	function resolveAccent(): string {
		const { accent } = data.design;
		if (accent.source === "custom") return accent.color.toUpperCase();
		if (accent.source === "preset") return PORTFOLIO_ACCENTS[accent.id].color;
		const fromResume = resume ? toHex(resume.metadata.design.colors.primary) : null;
		return fromResume ?? PORTFOLIO_ACCENTS[fallbackPortfolioAccent].color;
	}

	function resolveFonts(): PortfolioView["design"]["fonts"] {
		const pairFonts = (id: PortfolioFontPairId) => {
			const pair: { heading: string; body: string; nameStretch?: string; nameUppercase?: boolean } =
				PORTFOLIO_FONT_PAIRS[id];
			return {
				heading: pair.heading,
				body: pair.body,
				mono: PORTFOLIO_MONO_FONT,
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
				return { heading, body, mono: PORTFOLIO_MONO_FONT, pair: null, nameStretch: null, nameUppercase: false };
		}
		return pairFonts(themeFontPair(theme, undefined));
	}

	function buildWork(work: PortfolioWork): PortfolioViewWork {
		const metrics = work.blocks.flatMap((block) => (block.type === "metrics" ? block.items : []));
		const cover = image(work.cover, work.title);
		return {
			id: work.id,
			slug: work.slug,
			anchor: `work-${work.slug}`,
			title: work.title,
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
			case "metrics":
				return block.items.length ? block : null;
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
					thumbnail: block.thumbnailUrl ?? (provider === "youtube" ? youtubeThumbnailUrl(videoId) : null),
				};
			}
			case "pdf":
				return {
					id: block.id,
					type: "pdf",
					title: block.title,
					href: input.fileUrl(block.file),
					pages: block.pages,
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
		const profiles =
			contact.profiles && resume
				? visible("profiles", resume.sections.profiles.items)
						.filter((item) => item.network.trim() || item.website.url.trim())
						.map((item) => ({
							id: item.id,
							network: item.network.trim(),
							username: item.username.trim(),
							icon: item.icon,
							href: item.website.url.trim() || null,
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
		const empty =
			!view.email && !view.phone && !view.website && !view.whatsapp && !profiles.length && !view.form && !location;
		return empty ? null : view;
	}

	function buildSection(key: PortfolioSectionKey): PortfolioViewSection | null {
		const anchor = key.replace(":", "-");
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
			const section = resume?.customSections.find((item) => `resume:${item.id}` === key);
			if (!section || EXCLUDED_RESUME_CUSTOM_TYPES.has(section.type)) return null;
			const items = visible(key, section.items as CustomSectionItem[]);
			if (!items.length) return null;
			return {
				kind: "resume",
				key: key as `resume:${string}`,
				anchor,
				title: title(section.title.trim()),
				type: section.type,
				items,
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
				if (!resume) return null;
				const items = visible(standard, resume.sections[standard].items as { id: string; hidden: boolean }[]);
				if (!items.length) return null;
				return { ...base, kind: standard, key: standard, items } as PortfolioViewSection;
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
			point: value.point ?? null,
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
	const extras: PortfolioSectionKey[] = [
		...data.custom.map((section) => `custom:${section.id}` as const),
		...(resume?.customSections ?? [])
			.filter((section) => !EXCLUDED_RESUME_CUSTOM_TYPES.has(section.type))
			.map((section) => `resume:${section.id}` as const),
	];
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
