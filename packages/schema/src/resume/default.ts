import type { ResumeData } from "./data";
import { defaultIconDesign } from "./data";

/** The shared fields every section starts with, minus its items or content. */
export const sectionDefaults = (icon: string) => ({
	title: "",
	icon,
	columns: 1,
	hidden: false,
	showHeading: true,
	keepTogether: false,
	startOnNewPage: false,
});

const section = (icon: string) => ({ ...sectionDefaults(icon), items: [] as never[] });

export const defaultResumeData: ResumeData = {
	picture: {
		hidden: false,
		fit: "cover",
		url: "",
		size: 80,
		rotation: 0,
		aspectRatio: 1,
		borderRadius: 0,
		borderColor: "rgba(0, 0, 0, 0.5)",
		borderWidth: 0,
		shadowColor: "rgba(0, 0, 0, 0.5)",
		shadowWidth: 0,
	},
	basics: {
		name: "",
		headline: "",
		email: "",
		phone: "",
		location: "",
		website: { url: "", label: "" },
		customFields: [],
	},
	summary: { ...sectionDefaults("newspaper"), content: "" },
	sections: {
		profiles: section("link-01"),
		experience: section("briefcase-01"),
		education: section("mortarboard-01"),
		projects: section("source-code"),
		skills: { ...section("drafting-compass"), layout: "default", keywordLayout: "inline" },
		languages: section("translate"),
		interests: section("football"),
		awards: section("trophy"),
		certifications: section("certificate-01"),
		publications: section("library"),
		volunteer: section("hand-heart"),
		references: section("call-02"),
	},
	customSections: [],
	metadata: {
		template: "meridian",
		layout: {
			sidebarWidth: 35,
			pages: [
				{
					fullWidth: false,
					main: ["profiles", "summary", "education", "experience", "projects", "volunteer", "references"],
					sidebar: ["skills", "certifications", "awards", "languages", "interests", "publications"],
				},
			],
		},
		page: {
			gapX: 4,
			gapY: 6,
			marginX: 36,
			marginY: 32,
			format: "a4",
			locale: "en-US",
			dateFormat: "short",
			hideLinkUnderline: true,
		},
		design: {
			colors: {
				primary: "rgba(31, 58, 104, 1)",
				text: "rgba(0, 0, 0, 1)",
				background: "rgba(255, 255, 255, 1)",
			},
			level: {
				icon: "star",
				type: "circle",
			},
			entry: { layout: "stacked", lead: "organization", accent: "none" },
			icons: { ...defaultIconDesign },
		},
		typography: {
			body: {
				fontFamily: "Plus Jakarta Sans",
				fontWeights: ["400", "600"],
				fontSize: 9.5,
				lineHeight: 1.45,
			},
			heading: {
				fontFamily: "Plus Jakarta Sans",
				fontWeights: ["700"],
				fontSize: 13,
				lineHeight: 1.3,
			},
		},
		notes: "",
		styleRules: [],
	},
};
