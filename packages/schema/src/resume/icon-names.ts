import type { IconName } from "../icons";
import type { ResumeData } from "./data";
import { icons } from "../icons";

const iconNames: ReadonlySet<string> = new Set(icons);

/**
 * Phosphor icons that resumes named before resume icons moved to Hugeicons (November 2026), with the closest icon of
 * the resume icon set. Names missing here draw no icon.
 */
const PHOSPHOR_ICONS: Readonly<Record<string, IconName>> = {
	airplane: "map",
	"airplane-tilt": "map",
	"amazon-logo": "amazon",
	"android-logo": "android",
	"apple-logo": "apple",
	article: "newspaper",
	at: "at-sign",
	atom: "atom-01",
	bank: "bank",
	barbell: "dumbbell-01",
	basketball: "basketball-01",
	"behance-logo": "behance-01",
	bicycle: "bicycle",
	book: "book-01",
	"book-open": "book-open-01",
	books: "library",
	brain: "brain",
	briefcase: "briefcase-01",
	bug: "bug-01",
	building: "office",
	buildings: "office",
	calculator: "calculator-01",
	calendar: "calendar-03",
	"calendar-blank": "calendar-01",
	"calendar-dots": "calendar-03",
	camera: "camera-01",
	certificate: "certificate-01",
	"chalkboard-teacher": "teaching",
	"chart-bar": "chart-bar-big",
	"chart-line": "chart-line",
	"chart-pie": "pie-chart",
	clock: "clock-01",
	code: "source-code",
	"code-simple": "source-code",
	"codepen-logo": "codepen",
	coffee: "coffee-01",
	"compass-tool": "drafting-compass",
	"cooking-pot": "cooking-pot",
	"currency-dollar": "dollar-01",
	database: "database",
	desktop: "laptop-programming",
	"dev-to-logo": "developer",
	"device-mobile": "mobile-programming-01",
	"discord-logo": "discord",
	dna: "dna",
	"dribbble-logo": "dribbble",
	envelope: "mail-01",
	"envelope-simple": "mail-02",
	"facebook-logo": "facebook-01",
	"figma-logo": "figma",
	"film-strip": "film-01",
	"first-aid": "first-aid-kit",
	"first-aid-kit": "first-aid-kit",
	flask: "flask-conical",
	football: "football",
	"game-controller": "game-controller-01",
	gavel: "legal-hammer",
	"git-branch": "git-branch",
	"github-logo": "github",
	"gitlab-logo": "gitlab",
	globe: "globe-02",
	"globe-hemisphere-west": "globe-02",
	"globe-simple": "globe-02",
	"google-logo": "google",
	"graduation-cap": "mortarboard-01",
	guitar: "guitar",
	"hand-heart": "hand-heart",
	"hands-praying": "prayer-rug-01",
	handshake: "handshake",
	headphones: "headphones",
	heart: "health",
	"instagram-logo": "instagram",
	laptop: "laptop-programming",
	leaf: "leafy-green",
	lightbulb: "idea-01",
	link: "link-01",
	"link-simple": "link-01",
	"linkedin-logo": "linkedin-02",
	"map-pin": "location-01",
	"mastodon-logo": "mastodon",
	medal: "medal-01",
	"medium-logo": "medium",
	megaphone: "megaphone-03",
	"messenger-logo": "messenger",
	microphone: "mic-01",
	microscope: "microscope",
	mosque: "mosque-01",
	mountains: "hiking",
	"music-note": "music-note-01",
	"music-notes": "music-note-01",
	newspaper: "newspaper",
	"note-pencil": "notebook-pen",
	notebook: "notebook-01",
	"notion-logo": "notion-01",
	"paint-brush": "paint-brush-01",
	paintbrush: "paint-brush-01",
	palette: "palette",
	"pen-nib": "pencil",
	pencil: "pencil",
	"person-simple-run": "workout-run",
	"person-simple-swim": "swimming",
	phone: "call-02",
	pill: "pill",
	"pinterest-logo": "pinterest",
	plant: "leafy-green",
	"reddit-logo": "reddit",
	robot: "bot",
	rocket: "rocket-01",
	"rocket-launch": "rocket-01",
	scales: "justice-scale-01",
	"seal-check": "certificate-02",
	shield: "shield-01",
	"shield-check": "shield-check",
	"slack-logo": "slack",
	"soccer-ball": "football",
	sparkle: "star",
	"spotify-logo": "spotify",
	"stack-overflow-logo": "source-code",
	star: "star",
	stethoscope: "stethoscope",
	strategy: "strategy",
	student: "student",
	syringe: "syringe",
	target: "target-01",
	"telegram-logo": "telegram",
	"tennis-ball": "tennis-ball",
	terminal: "computer-terminal-01",
	"terminal-window": "computer-terminal-01",
	"test-tube": "test-tube",
	"threads-logo": "threads",
	"tiktok-logo": "tiktok",
	translate: "translate",
	tree: "leafy-green",
	trophy: "trophy",
	"twitch-logo": "twitch",
	"twitter-logo": "new-twitter",
	user: "user",
	"user-circle": "user-circle",
	users: "user-group",
	"users-three": "user-group",
	"video-camera": "video-01",
	"whatsapp-logo": "whatsapp",
	"windows-logo": "windows-new",
	"x-logo": "new-twitter",
	"youtube-logo": "youtube",
};

/**
 * The resume icon an icon field names: the name itself when it is in the resume icon set, the match of a former
 * Phosphor name, or "" (no icon). "none", which hides a section's default icon, stays as it is.
 */
export function upgradeIconName(name: string): IconName | "none" {
	if (name === "none") return "none";
	if (iconNames.has(name)) return name as IconName;
	return PHOSPHOR_ICONS[name] ?? "";
}

type LegacyPage = { hideIcons?: unknown; hideSectionIcons?: unknown } | undefined;

/**
 * Rewrites a parsed resume's icon names into the resume icon set, and turns the icon switches resumes kept under
 * `metadata.page` before November 2026 (`legacyPage`, read from the unparsed data) into `metadata.design.icons`.
 */
export function upgradeResumeIcons(data: ResumeData, legacyPage: LegacyPage) {
	const upgrade = <T extends { icon: string }>(owner: T) => {
		if (owner.icon) owner.icon = upgradeIconName(owner.icon);
	};

	upgrade(data.summary);
	data.basics.customFields.forEach(upgrade);
	upgrade(data.metadata.design.level);
	for (const section of Object.values(data.sections)) {
		upgrade(section);
		for (const item of section.items) if ("icon" in item) upgrade(item);
	}
	for (const section of data.customSections) {
		upgrade(section);
		for (const item of section.items) if (typeof item.icon === "string") upgrade(item as { icon: string });
	}

	const { hideIcons, hideSectionIcons } = legacyPage ?? {};
	if (data.metadata.design.icons || (typeof hideIcons !== "boolean" && typeof hideSectionIcons !== "boolean")) return;
	data.metadata.design.icons = {
		enabled: true,
		style: "standard",
		contact: hideIcons !== true,
		sections: hideSectionIcons === false,
		items: hideIcons !== true,
		logos: false,
	};
}
