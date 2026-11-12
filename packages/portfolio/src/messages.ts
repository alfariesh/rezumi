import type { PortfolioViewMessages } from "./view";
import portfolioCatalog from "./portfolio-catalog.json";

/**
 * The interface text on a portfolio page, in English. `portfolio-catalog.json` translates it: `pnpm pdf:translations`
 * copies the translations from the app's Lingui catalogs, where `apps/web/src/features/portfolio/page-text.ts`
 * declares the same strings for translators. Keep both lists in step: that file's test compares them, and the generator
 * fails on a missing string. `{service}`, `{count}`, `{place}`, `{site}`, `{name}` and `{provider}` are filled in at render time with
 * `fillPortfolioMessage`, never `String.replace` (a person's text could hold `$&`). The page has no plural rules, so a
 * count goes after a label ("Pages: {count}") rather than into words that change with it.
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
	role: "My role",
	year: "Year",
	close: "Close",
	previous: "Previous",
	next: "Next",
	otherWork: "Other work",
	pictureViewer: "Picture viewer",
	playVideo: "Play video",
	openPdf: "Open PDF",
	pages: "Pages: {count}",
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
	moreOn: "More on {site}",
	caseStudies: "Case studies",
	yourName: "Your name",
	yourEmail: "Your email",
	yourMessage: "Your message",
	sendMessageNow: "Send message",
	messageSending: "Sending your message…",
	messageSent: "Thank you. Your message was sent.",
	messageFailed: "Your message couldn't be sent. Try again in a moment.",
	messageInvalid: "Check your name, email and message, then try again.",
	messageBlocked: "We couldn't confirm you're not a robot. Try again.",
	messageLimited: "Too many messages for now. Try again later.",
	messageClosed: "This form is closed right now.",
	formNote: "Your message goes to {name}, who will see your email address so they can reply.",
	formNeedsScript: "This form needs JavaScript. You can use the other contact options here.",
	report: "Report",
	reportTitle: "Report this portfolio",
	reportIntro:
		"Tell Rezumi what's wrong with {name}'s portfolio. Only the Rezumi team reads reports, and the portfolio's owner is never told who sent one.",
	reportReason: "What's wrong?",
	reportReasonFraud: "Fraud or a scam",
	reportReasonIllegal: "Illegal content",
	reportReasonRights: "Trademark or copyright, such as a logo or a work",
	reportReasonFakeTestimonial: "A fake testimonial",
	reportReasonOther: "Something else",
	reportDetails: "What should we look at?",
	reportEmail: "Your email (optional)",
	reportEmailNote: "Only if you'd like a reply. The portfolio's owner won't see it.",
	reportSend: "Send report",
	reportSent: "Thank you. Your report was sent to the Rezumi team.",
	reportFailed: "Your report couldn't be sent. Check the form and try again in a moment.",
	reportClosed:
		"Reports can't be sent from this page right now. Email {email} with this page's address and what's wrong.",
	reportNeedsScript: "This form needs JavaScript. You can also email {email}.",
	reportBack: "Back to the portfolio",
	// Phase 13: work pages, Save contact, Open to work, embeds and the password page.
	allWork: "All work",
	viewWork: "View work",
	saveContact: "Save contact",
	lookingFor: "Looking for",
	fullTime: "Full-time",
	partTime: "Part-time",
	contractWork: "Contract",
	freelance: "Freelance",
	internship: "Internship",
	readingTime: "{count} min read",
	showEmbed: "Show {provider} here",
	embedNote: "Loads content from {provider}",
	workMissing: "This work isn't on this portfolio anymore.",
	lockedTitle: "This portfolio is private",
	lockedIntro: "Enter the password you were given to see it.",
	password: "Password",
	unlock: "Open portfolio",
	wrongPassword: "That password isn't right. Check it and try again.",
	tooManyTries: "Too many tries. Wait 10 minutes, then try again.",
};

export type PortfolioPageMessages = typeof ENGLISH;

/** The English source strings, as the catalog generator looks them up. */
export const PORTFOLIO_SOURCE_MESSAGES = Object.values(ENGLISH);

const catalogs: Record<string, Record<string, string>> = portfolioCatalog;

/**
 * Fills the `{name}` placeholders of a page string. Values go in exactly as given, in one pass: a person's text can't
 * add placeholders or `String.replace` patterns such as `$&`.
 */
export function fillPortfolioMessage(message: string, values: Readonly<Record<string, string | number>>): string {
	return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
		Object.hasOwn(values, name) ? String(values[name]) : placeholder,
	);
}

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
			vcard: messages.saveContact,
		},
		openToWork: messages.openToWork,
		serviceInquiry: (service) => fillPortfolioMessage(messages.serviceInquiry, { service }),
	};
}
