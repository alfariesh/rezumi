import type { PortfolioViewMessages } from "./view";
import portfolioCatalog from "./portfolio-catalog.json";

/**
 * The interface text on a portfolio page, in English. `portfolio-catalog.json` translates it: `pnpm pdf:translations`
 * copies the translations from the app's Lingui catalogs, where `apps/web/src/features/portfolio/page-text.ts`
 * declares the same strings for translators. Keep both lists in step; the generator fails on a missing string.
 * `{service}`, `{count}` and `{place}` are filled in at render time.
 */
const ENGLISH = {
	about: "About me",
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
	viewResume: "View resume",
	downloadPdf: "Download PDF",
	sendMessage: "Send a message",
	whatsapp: "WhatsApp",
	email: "Email",
	profile: "Profile",
	openLink: "Open link",
	openToWork: "Open to work",
	serviceInquiry: "Hello, I'm interested in your service: {service}",
	skipToContent: "Skip to content",
	pageNavigation: "Page navigation",
	menu: "Menu",
	intro: "Intro",
	role: "Role",
	year: "Year",
	close: "Close",
	previous: "Previous",
	next: "Next",
	otherWork: "Other work",
	pictureViewer: "Picture viewer",
	playVideo: "Play video",
	openPdf: "Open PDF",
	onePage: "1 page",
	pageCount: "{count} pages",
	openMap: "Open in map",
	mapAround: "Map around {place}",
	phone: "Phone",
	website: "Website",
	location: "Location",
	localTime: "Local time",
	remote: "Remote",
	hybrid: "Hybrid",
	onsite: "On-site",
	relocate: "Open to relocation",
	before: "Before",
	after: "After",
	progress: "Progress",
	upGood: "Up, a good change:",
	upBad: "Up, a bad change:",
	downGood: "Down, a good change:",
	downBad: "Down, a bad change:",
	unchanged: "No change:",
	credit: "Made with Rezumi",
};

export type PortfolioPageMessages = typeof ENGLISH;

/** The English source strings, as the catalog generator looks them up. */
export const PORTFOLIO_SOURCE_MESSAGES = Object.values(ENGLISH);

const catalogs: Record<string, Record<string, string>> = portfolioCatalog;

/** A portfolio page's interface text in `locale`, falling back to English string by string. */
export function portfolioMessages(locale: string): PortfolioPageMessages {
	const catalog = Object.hasOwn(catalogs, locale) ? catalogs[locale] : undefined;
	return Object.fromEntries(
		Object.entries(ENGLISH).map(([key, english]) => [key, catalog?.[english] || english]),
	) as PortfolioPageMessages;
}

/** The part of the page text `buildPortfolioView` needs: section titles, button labels and the WhatsApp greeting. */
export function portfolioViewMessages(messages: PortfolioPageMessages): PortfolioViewMessages {
	return {
		sections: {
			about: messages.about,
			work: messages.work,
			services: messages.services,
			testimonials: messages.testimonials,
			clients: messages.clients,
			experience: messages.experience,
			education: messages.education,
			skills: messages.skills,
			languages: messages.languages,
			certifications: messages.certifications,
			awards: messages.awards,
			publications: messages.publications,
			volunteer: messages.volunteer,
			interests: messages.interests,
			profiles: messages.profiles,
			contact: messages.contact,
		},
		buttons: {
			resume: messages.viewResume,
			pdf: messages.downloadPdf,
			contact: messages.sendMessage,
			whatsapp: messages.whatsapp,
			email: messages.email,
			profile: messages.profile,
			link: messages.openLink,
		},
		openToWork: messages.openToWork,
		serviceInquiry: (service) => messages.serviceInquiry.replace("{service}", service),
	};
}
