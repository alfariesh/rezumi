import type { PortfolioAiViewInput, PortfolioPlanFeature } from "./types";
import type { PortfolioBlock } from "@rezumi/schema/portfolio/blocks";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioImage } from "@rezumi/schema/portfolio/files";
import type { PortfolioResumeSection, PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { FREE_PORTFOLIO_HERO_EFFECTS } from "@rezumi/schema/billing";
import { embedPageUrl } from "@rezumi/schema/portfolio/embed";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_RESUME_SECTIONS } from "@rezumi/schema/portfolio/sections";
import {
	PORTFOLIO_ACCENTS,
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_THEMES,
} from "@rezumi/schema/portfolio/themes";
import { portfolioMessages, portfolioViewMessages } from "../messages";
import { customSectionEntries, isResumeEntryKind, resumeEntries } from "../resume-entries";
import { buildPortfolioView, portfolioPageLocale, resolveSectionOrder } from "../view";
import { placedPortfolioImages } from "./images";

/** Each theme's character in one line, for a model choosing one (`01-desain.md` sections 5, 20, 21, 26, 27). */
export const PORTFOLIO_THEME_CHARACTER: Record<PortfolioTheme, string> = {
	lugas: "Clean and calm, fits any field; the default theme.",
	prima: "Formal, like an annual report with KPI figures: finance, consulting, corporate roles, formal graduates.",
	kanvas: "Dark gallery with a giant name and big pictures: designers, photographers, architects, creators.",
	mozaik: "Bento tiles with a living gradient: creators, freelancers, students.",
	paper: "Warm paper texture with ruled cells and corner marks: calm and editorial.",
	brutal: "Neobrutalist: thick borders, hard shadows, loud colour; bold and playful.",
	sintaks: "Dark, code-like with monospace labels: developers, data and IT.",
	warta: "Newspaper style with serif headlines: writers, PR, marketing, researchers.",
};

const RESUME_SECTIONS = new Set<string>(PORTFOLIO_RESUME_SECTIONS);

/** An image as a model places it again: its key and alternative text. */
const imageRef = (image: PortfolioImage | null | undefined) => (image ? { key: image.key, alt: image.alt } : undefined);

/** Drops undefined fields, so the JSON stays short. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function videoUrl(block: Extract<PortfolioBlock, { type: "video" }>): string {
	return block.provider === "youtube"
		? `https://www.youtube.com/watch?v=${block.videoId}`
		: `https://vimeo.com/${block.videoId}${block.hash ? `/${block.hash}` : ""}`;
}

function blockView(block: PortfolioBlock): Record<string, unknown> {
	switch (block.type) {
		case "text":
			return { id: block.id, type: "text", html: block.html };
		case "images":
			return {
				id: block.id,
				type: "images",
				layout: block.layout,
				images: block.images.map((image) => compact({ ...imageRef(image), caption: image.caption })),
			};
		case "metrics":
			return { id: block.id, type: "metrics", items: block.items };
		case "video":
			return compact({ id: block.id, type: "video", url: videoUrl(block), title: block.title });
		case "embed":
			return compact({
				id: block.id,
				type: "embed",
				url: embedPageUrl({ provider: block.provider, ref: block.ref }),
				title: block.title,
			});
		case "pdf":
			return { id: block.id, type: "pdf", title: block.title, pages: block.pages };
		case "link":
			return compact({
				id: block.id,
				type: "link",
				url: block.url,
				title: block.title,
				description: block.description,
				siteName: block.siteName,
				brandIcon: block.brandIcon,
				image: imageRef(block.image),
			});
	}
}

function worksView(data: PortfolioData) {
	return data.works.items.map((work) =>
		compact({
			id: work.id,
			slug: work.slug,
			title: work.title,
			summary: work.summary,
			role: work.role,
			date: work.date,
			tags: work.tags,
			featured: work.featured,
			hidden: work.hidden,
			cover: work.cover ? compact({ ...imageRef(work.cover), focus: work.cover.focus }) : undefined,
			primaryLink: work.primaryLink,
			highlightMetricId: work.highlightMetricId,
			fromResume: work.fromResumeItemId ? true : undefined,
			blocks: work.blocks.map(blockView),
		}),
	);
}

type CareerItem = { id: string; hidden: boolean };

/** A career section's items as a model hides them: a label, when, and where each is hidden. */
function careerItems(
	key: PortfolioSectionKey,
	items: readonly CareerItem[],
	entries: readonly { title: string; subtitle: string; when: string }[],
	data: PortfolioData,
) {
	const hidden = new Set(data.sections.hiddenItems[key] ?? []);
	return items.map((item, index) => {
		const entry = entries[index];
		const label = key === "profiles" ? entry?.title : [entry?.title, entry?.subtitle].filter(Boolean).join(" · ");
		return compact({
			id: item.id,
			label: label || undefined,
			when: entry?.when || undefined,
			hidden: hidden.has(item.id) ? true : undefined,
			hiddenInSource: item.hidden ? true : undefined,
		});
	});
}

function sectionsView(input: PortfolioAiViewInput, shown: ReadonlySet<string>, defaultTitles: Record<string, string>) {
	const { data } = input;
	const resume = input.source.resume;
	return resolveSectionOrder(data, data.theme, resume).map((key) => {
		const customTitle = data.sections.titles[key];
		const base = {
			key,
			hidden: data.sections.hidden.includes(key) ? true : undefined,
			onPage: shown.has(key),
			customTitle: customTitle ? true : undefined,
		};
		if (key.startsWith("custom:")) {
			const section = data.custom.find((item) => `custom:${item.id}` === key);
			return compact({ ...base, title: customTitle || section?.title, from: "portfolio" });
		}
		if (key.startsWith("resume:")) {
			const section = resume?.customSections.find((item) => `resume:${item.id}` === key);
			const kind = section && isResumeEntryKind(section.type) ? section.type : null;
			return compact({
				...base,
				title: customTitle || section?.title,
				from: input.source.from,
				hiddenInSource: section?.hidden ? true : undefined,
				items: section && kind ? careerItems(key, section.items, customSectionEntries(kind, section.items), data) : [],
			});
		}
		const title = customTitle || defaultTitles[key];
		if (!RESUME_SECTIONS.has(key)) return compact({ ...base, title, from: "portfolio" });
		const standard = key as PortfolioResumeSection;
		const section = resume?.sections[standard];
		const items = (section?.items ?? []) as readonly CareerItem[];
		return compact({
			...base,
			title,
			from: input.source.from,
			hiddenInSource: section?.hidden ? true : undefined,
			items: careerItems(key, items, resumeEntries(standard, items as never), data),
		});
	});
}

function basicsView(data: PortfolioData, resume: ResumeData | null) {
	const effective = (field: "name" | "headline" | "location") => {
		const own = data.basics[field];
		const fromSource = resume?.basics[field].trim() ?? "";
		// The source's location may be a street address the person keeps off the page: it's read only when shown.
		if (own === undefined && field === "location" && !data.hero.showLocation)
			return { value: null, override: false, hidden: true };
		return { value: own ?? fromSource, override: own !== undefined };
	};
	const picture = data.basics.picture;
	return {
		name: effective("name"),
		headline: effective("headline"),
		location: effective("location"),
		picture:
			picture === null
				? { source: "none" }
				: picture
					? { source: "upload", ...imageRef(picture) }
					: {
							source: "resume",
							sourceHasPhoto: Boolean(resume && !resume.picture.hidden && resume.picture.url.trim()),
						},
	};
}

function contactView(data: PortfolioData, resume: ResumeData | null) {
	const has = (value: string | undefined) => Boolean(value?.trim());
	const profiles =
		resume && !resume.sections.profiles.hidden ? resume.sections.profiles.items.filter((item) => !item.hidden) : [];
	const { contact } = data;
	return {
		email: { show: contact.email, sourceHas: has(resume?.basics.email) },
		phone: { show: contact.phone, sourceHas: has(resume?.basics.phone) },
		website: { show: contact.website, sourceHas: has(resume?.basics.website.url) },
		profiles: { show: contact.profiles, sourceHas: profiles.length > 0 },
		whatsapp: { show: contact.whatsapp.show, numberSet: contact.whatsapp.number !== "" },
		form: contact.form,
		saveContact: contact.saveContact,
		note: contact.note,
	};
}

function imagesView(data: PortfolioData) {
	const byKey = new Map<string, { key: string; alt: string; usedIn: string[] }>();
	for (const { image, where } of placedPortfolioImages(data)) {
		const entry = byKey.get(image.key) ?? { key: image.key, alt: image.alt, usedIn: [] };
		entry.usedIn.push(where);
		byKey.set(image.key, entry);
	}
	return [...byKey.values()];
}

/**
 * The portfolio as a model reads it (`read_portfolio`, MCP `get_portfolio`): every item with its id, the page's
 * effective basics and section order with the career sections read from the source (items with their ids, for
 * hiding), the images it can place, its limits and what the plan locks. Contact values are left out; only whether the
 * source has them. Fields follow the edit paths (`design.*`, `hero.*`, …) so a value read can be written back.
 */
export function portfolioAiView(input: PortfolioAiViewInput): Record<string, unknown> {
	const { data, plan } = input;
	const resume = input.source.resume;
	const locale = portfolioPageLocale(data, input.source.from === "resume" ? resume : null);
	const messages = portfolioViewMessages(portfolioMessages(locale));
	const page = buildPortfolioView({
		portfolio: { data },
		resume: resume ? { data: resume, from: input.source.from } : null,
		owner: { name: "", username: "portfolio" },
		entitlements: { hidePortfolioCredit: true },
		messages,
		fileUrl: (key) => key,
		contactFormAvailable: true,
	});
	const shown = new Set<string>(page.sections.map((section) => section.key));
	const locked = (feature: PortfolioPlanFeature) => Boolean(plan && !plan.features[feature]);
	const theme = PORTFOLIO_THEME_INFO[data.theme];

	return {
		page: {
			published: input.status.published,
			url: input.status.url,
			language: locale,
			languageFollowsSource: data.locale === undefined,
		},
		source: { from: input.source.from, name: input.source.name, available: resume !== null },
		plan: plan
			? compact({
					name: plan.name,
					maxWorks: plan.maxWorks ?? undefined,
					locked: (["premiumPortfolioThemes", "premiumHeroEffects", "hidePortfolioCredit"] as const).filter(locked),
				})
			: null,
		theme: data.theme,
		themes: PORTFOLIO_THEMES.map((id) =>
			compact({
				id,
				name: PORTFOLIO_THEME_INFO[id].name,
				plan: PORTFOLIO_THEME_INFO[id].plan,
				character: PORTFOLIO_THEME_CHARACTER[id],
				// Keeping a Plus theme the portfolio already has is allowed; choosing one anew isn't.
				locked:
					PORTFOLIO_THEME_INFO[id].plan === "plus" && id !== data.theme && locked("premiumPortfolioThemes")
						? true
						: undefined,
			}),
		),
		design: compact({
			scheme: data.design.scheme,
			themeScheme: theme.defaultScheme,
			accent: data.design.accent,
			fonts: data.design.fonts,
			variants: data.design.variants,
			offered: {
				variants: theme.variants,
				fontPairs: Object.fromEntries(theme.fontPairs.map((id) => [id, PORTFOLIO_FONT_PAIRS[id].label])),
				effects: theme.effects,
				// The effect the portfolio already has stays allowed; choosing another Plus one isn't.
				lockedEffects: locked("premiumHeroEffects")
					? theme.effects.filter(
							(id) => id !== data.hero.effect.id && !(FREE_PORTFOLIO_HERO_EFFECTS as readonly string[]).includes(id),
						)
					: undefined,
				accents: Object.fromEntries(Object.entries(PORTFOLIO_ACCENTS).map(([id, accent]) => [id, accent.color])),
			},
		}),
		basics: basicsView(data, resume),
		hero: compact({
			greeting: data.hero.greeting,
			showPicture: data.hero.showPicture,
			showLocation: data.hero.showLocation,
			availability: data.hero.availability,
			highlights: data.hero.highlights,
			buttons: data.hero.buttons,
			effect: data.hero.effect,
			background: compact({ kind: data.hero.background.kind, image: imageRef(data.hero.background.image) }),
		}),
		about: { content: data.about.content },
		works: worksView(data),
		services: data.services.items,
		testimonials: data.testimonials.items.map((item) => compact({ ...item, photo: imageRef(item.photo) })),
		clients: data.clients.items.map((item) =>
			compact({ ...item, logo: item.logo && "key" in item.logo ? imageRef(item.logo) : item.logo }),
		),
		custom: data.custom.map((item) => compact({ ...item, image: imageRef(item.image) })),
		sections: sectionsView(input, shown, messages.sections),
		location: compact({
			label: data.location.label,
			workModes: data.location.workModes,
			relocate: data.location.relocate,
			timezone: data.location.timezone,
			showLocalTime: data.location.showLocalTime,
			showMap: data.location.showMap,
			hasMapPoint: data.location.point ? true : undefined,
		}),
		contact: contactView(data, resume),
		seo: data.seo,
		credit: compact({ show: data.credit.show, hidingLocked: locked("hidePortfolioCredit") ? true : undefined }),
		images: imagesView(data),
		uploads: input.uploads.map((upload) =>
			compact({ key: upload.key, alt: upload.alt, uploadedAt: upload.uploadedAt }),
		),
		limits: {
			works: {
				used: data.works.items.length,
				max: Math.min(plan?.maxWorks ?? PORTFOLIO_LIMITS.works, PORTFOLIO_LIMITS.works),
			},
			services: { used: data.services.items.length, max: PORTFOLIO_LIMITS.services },
			testimonials: { used: data.testimonials.items.length, max: PORTFOLIO_LIMITS.testimonials },
			clients: { used: data.clients.items.length, max: PORTFOLIO_LIMITS.clients },
			custom: { used: data.custom.length, max: PORTFOLIO_LIMITS.customSections },
			highlights: { used: data.hero.highlights.length, max: PORTFOLIO_LIMITS.highlights },
			heroButtons: { used: data.hero.buttons.length, max: PORTFOLIO_LIMITS.heroButtons },
			blocksPerWork: PORTFOLIO_LIMITS.blocksPerWork,
			metricsPerBlock: PORTFOLIO_LIMITS.metricsPerBlock,
			imagesPerBlock: PORTFOLIO_LIMITS.imagesPerBlock,
		},
	};
}
