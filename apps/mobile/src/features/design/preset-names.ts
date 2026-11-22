// Names of the shared design presets (`@rezumi/resume/design-presets`) in the app's language. The package keeps plain
// English labels; the resume's and the letter's Design read these instead.
import type { MessageDescriptor } from "@lingui/core";
import type { ACCENTS, FontPairingId, MarginId } from "@rezumi/resume/design-presets";
import type { CareerField } from "@rezumi/schema/templates";
import { msg } from "@lingui/core/macro";

export const PAIRING_NAMES: Record<FontPairingId, MessageDescriptor> = {
	classic: msg`Classic`,
	traditional: msg`Traditional`,
	balanced: msg`Balanced`,
	professional: msg`Professional`,
	clean: msg`Clean`,
};

/** Keyed by the package's English label. */
export const ACCENT_NAMES: Record<(typeof ACCENTS)[number]["label"], MessageDescriptor> = {
	Moss: msg`Moss`,
	"Ink blue": msg`Ink blue`,
	Teal: msg`Teal`,
	Plum: msg`Plum`,
	Rust: msg`Rust`,
	Burgundy: msg`Burgundy`,
	Ochre: msg`Ochre`,
	Graphite: msg`Graphite`,
};

export const MARGIN_NAMES: Record<MarginId, MessageDescriptor> = {
	narrow: msg`Narrow`,
	normal: msg`Normal`,
	wide: msg`Wide`,
};

/** The template gallery's field filter, in `careerFields` order (`templateCareerFields` says which templates suit each). */
export const CAREER_FIELD_NAMES: Record<CareerField, MessageDescriptor> = {
	tech: msg({ comment: "Template gallery filter: technology jobs", message: "Tech" }),
	creative: msg({ comment: "Template gallery filter: creative jobs such as design and writing", message: "Creative" }),
	finance: msg({ comment: "Template gallery filter: finance, banking, law and consulting jobs", message: "Finance" }),
	government: msg({
		comment: "Template gallery filter: civil service and state-owned companies (Indonesian: Pemerintahan & BUMN)",
		message: "Government & state-owned",
	}),
	academic: msg({ comment: "Template gallery filter: research, teaching and scholarships", message: "Academic" }),
	graduate: msg({ comment: "Template gallery filter: a first job or internship", message: "Fresh graduate" }),
};

/** The icon picker's headings (`iconPickerGroups`): "suggested" and the Hugeicons categories. */
export const ICON_GROUP_NAMES: Record<string, MessageDescriptor> = {
	suggested: msg({ comment: "Icon picker category: the icons resumes use most", message: "Suggested" }),
	logos: msg({ comment: "Icon picker category: brand and network logos", message: "Logos" }),
	business: msg`Business`,
	education: msg`Education`,
	programming: msg`Programming`,
	users: msg({ comment: "Icon picker category: people and user icons", message: "People" }),
	award: msg`Awards`,
	maps: msg`Maps and places`,
	ai: msg({ comment: "Icon picker category: artificial intelligence", message: "AI" }),
	"science-technology": msg`Science and technology`,
	media: msg`Music and video`,
	"image-camera": msg`Photos and cameras`,
	presentation: msg`Presentations`,
	dashboard: msg`Charts and dashboards`,
	"notes-tasks": msg`Notes and tasks`,
	hierarchy: msg`Teams and structure`,
	git: msg({ comment: "Icon picker category: the Git version control tool", message: "Git" }),
	"date-time": msg`Date and time`,
	legal: msg({ comment: "Icon picker category: legal and justice icons", message: "Law" }),
	security: msg`Security`,
	medical: msg`Health`,
	buildings: msg`Buildings`,
	games: msg`Games and sports`,
	gym: msg`Fitness`,
	foods: msg`Food and drink`,
	space: msg`Outer space`,
	islamic: msg({ comment: "Icon picker category: Islamic symbols such as mosques", message: "Islam" }),
};
