import type { IconName } from "@rezumi/schema/icons";

// Whole words only: a substring match gave "Xing", "Dropbox" and "Stack Exchange" the X logo.
const NETWORK_ICON_MAP: Array<{ match: RegExp; icon: IconName }> = [
	{ match: /\bgithub\b/, icon: "github" },
	{ match: /\bgitlab\b/, icon: "gitlab" },
	{ match: /\blinkedin\b/, icon: "linkedin-02" },
	{ match: /\b(?:twitter|x)\b/, icon: "new-twitter" },
	{ match: /\bfacebook\b/, icon: "facebook-01" },
	{ match: /\binstagram\b/, icon: "instagram" },
	{ match: /\bthreads\b/, icon: "threads" },
	{ match: /\btiktok\b/, icon: "tiktok" },
	{ match: /\byoutube\b/, icon: "youtube" },
	{ match: /\bmedium\b/, icon: "medium" },
	{ match: /\bdribbble\b/, icon: "dribbble" },
	{ match: /\bbehance\b/, icon: "behance-01" },
	{ match: /\bfigma\b/, icon: "figma" },
	{ match: /\bcodepen\b/, icon: "codepen" },
	{ match: /\bleetcode\b/, icon: "leetcode" },
	{ match: /\bhackerrank\b/, icon: "hackerrank" },
	{ match: /\bdiscord\b/, icon: "discord" },
	{ match: /\btelegram\b/, icon: "telegram" },
	{ match: /\bwhatsapp\b/, icon: "whatsapp" },
	{ match: /\bmastodon\b/, icon: "mastodon" },
	{ match: /\bbluesky\b/, icon: "bluesky" },
	{ match: /\bpinterest\b/, icon: "pinterest" },
	{ match: /\bupwork\b/, icon: "upwork" },
	{ match: /\bfiverr\b/, icon: "fiverr" },
	{ match: /\bkaggle\b/, icon: "database" },
	{ match: /\bdev\.?to\b/, icon: "developer" },
	{ match: /\bstack-?overflow\b/, icon: "source-code" },
];

/**
 * The logo for a social network or profile site, by its name ("LinkedIn", "My GitHub"). Returns "" (no icon) for a
 * network without one.
 */
export function getNetworkIcon(network?: string): IconName {
	if (!network) return "";
	const networkLower = network.toLowerCase();
	return NETWORK_ICON_MAP.find((entry) => entry.match.test(networkLower))?.icon ?? "";
}

/**
 * Tools and technologies with a logo in the resume icon set, by the words people write for them. Keys are lower
 * case with spaces, dots and dashes removed; see `getBrandIcon`.
 */
export const BRAND_ICONS: Readonly<Record<string, IconName>> = {
	aftereffects: "adobe-after-effect",
	adobeaftereffects: "adobe-after-effect",
	illustrator: "adobe-illustrator",
	adobeillustrator: "adobe-illustrator",
	indesign: "adobe-indesign",
	adobeindesign: "adobe-indesign",
	photoshop: "adobe-photoshop",
	adobephotoshop: "adobe-photoshop",
	premiere: "adobe-premier",
	premierepro: "adobe-premier",
	adobepremiere: "adobe-premier",
	adobepremierepro: "adobe-premier",
	adobexd: "adobe-xd",
	xd: "adobe-xd",
	android: "android",
	ios: "apple",
	macos: "apple",
	swift: "apple",
	awslambda: "aws-lambda",
	bash: "bash",
	shell: "bash",
	bootstrap: "bootstrap",
	c: "c-programming",
	"c++": "c++",
	cpp: "c++",
	capcut: "capcut",
	chatgpt: "chat-gpt",
	openai: "chat-gpt",
	claude: "claude",
	css: "css-3",
	css3: "css-3",
	copilot: "copilot",
	githubcopilot: "copilot",
	figma: "figma",
	framer: "framer",
	git: "git-branch",
	github: "github",
	gitlab: "gitlab",
	gemini: "google-gemini",
	googledocs: "google-doc",
	googledrive: "google-drive",
	googlesheets: "google-sheet",
	sheets: "google-sheet",
	html: "html-5",
	html5: "html-5",
	java: "java",
	javascript: "java-script",
	js: "java-script",
	jsx: "jsx-01",
	excel: "office-365",
	msexcel: "office-365",
	microsoftexcel: "office-365",
	word: "office-365",
	msword: "office-365",
	powerpoint: "office-365",
	microsoftoffice: "office-365",
	msoffice: "office-365",
	office: "office-365",
	office365: "office-365",
	microsoft365: "office-365",
	notion: "notion-01",
	npm: "npm",
	php: "php",
	python: "python",
	react: "react",
	reactjs: "react",
	reactnative: "react",
	shadcn: "shadcn",
	shadcnui: "shadcn",
	shopify: "shopify",
	sketch: "sketch",
	slack: "slack",
	sql: "sql",
	mysql: "sql",
	postgresql: "sql",
	postgres: "sql",
	stripe: "stripe",
	tailwind: "tailwindcss",
	tailwindcss: "tailwindcss",
	trello: "trello",
	typescript: "typescript-01",
	ts: "typescript-01",
	vscode: "visual-studio-code",
	visualstudiocode: "visual-studio-code",
	webflow: "webflow",
	wordpress: "wordpress",
	wps: "wps-office",
	wpsoffice: "wps-office",
	zoom: "zoom",
	loom: "loom",
	dropbox: "dropbox",
	zsh: "zsh",
};

/**
 * The logo of a tool or technology a skill names ("React", "MS Excel", "Adobe Photoshop"), or "" when the resume icon
 * set has none. Logos only ever sit beside the text, which applicant tracking systems read.
 */
export function getBrandIcon(text: string): IconName {
	const key = text
		.toLowerCase()
		.replace(/\.js$/, "")
		.replace(/[\s.\-_/]+/g, "");
	return BRAND_ICONS[key] ?? "";
}
