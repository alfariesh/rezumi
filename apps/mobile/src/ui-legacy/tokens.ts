// Legacy tokens (the former Desk & Paper system) for screens not yet rebuilt on src/ui. Values are bridged to the new
// palette and fonts; do not add tokens here: new screens use src/ui and global.css (apps/mobile/DESIGN.md).
import { Easing } from "react-native";

export type ColorScheme = "light" | "dark";

// §1 Colours, bridged to the HeroUI palette the web uses (Phase 02): the oklch values of global.css as sRGB hex, so
// screens not yet rebuilt on src/ui read as the same product. Alpha is the last two hex digits (#RRGGBBAA).
// Old name → new token: bg background, surface surface, raised overlay, sunken surface-secondary, line border,
// line2 border mixed toward muted, lineStrong/ink3 muted, ink foreground, ink2 foreground–muted midpoint, accent accent,
// *Soft the 15% soft fill over the surface, *Text the soft foreground, info the accent soft pair (HeroUI has no info).
const light = {
	bg: "#F5F5F5",
	surface: "#FFFFFF",
	raised: "#FFFFFF",
	sunken: "#EFEFF0",
	line: "#DEDEE0",
	line2: "#B1B1B6",
	lineStrong: "#71717A",
	ink: "#18181B",
	ink2: "#424248",
	ink3: "#71717A",
	accent: "#0485F7",
	accentHover: "#3592F9",
	onAccent: "#FCFCFC",
	accentSoft: "#DFEEFF",
	accentText: "#1E63AE",
	danger: "#FF383C",
	dangerSoft: "#FFE5E2",
	dangerText: "#B43635",
	warn: "#F5A524",
	warnSoft: "#FFF2E3",
	warnText: "#89612E",
	infoSoft: "#DFEEFF",
	infoText: "#1E63AE",
	hover: "#18181B0D",
	press: "#18181B17",
	scrim: "#00000080",
	scrimSheet: "#00000052",
	paper: "#FFFFFF",
	paperInk: "#18181B",
	paperLine: "#DEDEE0",
	paperAccent: "#0485F7",
	paperWarn: "#F5A524",
	paperWarnSoft: "#FFF2E3",
	stageSaved: "#908C7F",
	stageApplied: "#5590CC",
	stageScreen: "#00A0A6",
	stageInterv: "#AF8433",
	stageOffer: "#579F68",
	stageClosed: "#C67067",
	pageSelectFill: "#0485F71F",
	pageSelectLine: "#0485F7",
	pageIssueFill: "#F5A52438",
	pageProposalFill: "#0485F71F",
	selectedFill: "#DFEEFF",
};

export type ColorToken = keyof typeof light;
export type Colors = Record<ColorToken, string>;

const dark: Colors = {
	bg: "#060607",
	surface: "#18181B",
	raised: "#18181B",
	sunken: "#232325",
	line: "#28282C",
	line2: "#55555B",
	lineStrong: "#9F9FA9",
	ink: "#FCFCFC",
	ink2: "#CCCCD2",
	ink3: "#9F9FA9",
	accent: "#0485F7",
	accentHover: "#3592F9",
	onAccent: "#FCFCFC",
	accentSoft: "#1D2737",
	accentText: "#509FFA",
	danger: "#DB3B3E",
	dangerSoft: "#332021",
	dangerText: "#EC7D77",
	warn: "#F7B750",
	warnSoft: "#342D25",
	warnText: "#FAD7A4",
	infoSoft: "#1D2737",
	infoText: "#509FFA",
	hover: "#FCFCFC0D",
	press: "#FCFCFC17",
	scrim: "#00000099",
	scrimSheet: "#00000080",
	paper: "#FFFFFF",
	paperInk: "#18181B",
	paperLine: "#DEDEE0",
	paperAccent: "#0485F7",
	paperWarn: "#F5A524",
	paperWarnSoft: "#FFF2E3",
	stageSaved: "#908C7F",
	stageApplied: "#5590CC",
	stageScreen: "#00A0A6",
	stageInterv: "#AF8433",
	stageOffer: "#579F68",
	stageClosed: "#C67067",
	pageSelectFill: "#0485F71F",
	pageSelectLine: "#0485F7",
	pageIssueFill: "#F5A52438",
	pageProposalFill: "#0485F71F",
	selectedFill: "#1D2737",
};

export const colors: Record<ColorScheme, Colors> = { light, dark };

// §2 Type. Custom fonts select weight by family name (Android ignores fontWeight for them), so each weight is its
// own family, loaded by src/ui/fonts.ts.
export const fonts = {
	ui: {
		400: "GoogleSans-Regular",
		500: "GoogleSans-Medium",
		600: "GoogleSans-SemiBold",
		700: "GoogleSans-Bold",
	},
	/** Bridged to Google Sans semibold (Phase 02): one family, never paired with fontWeight. */
	display: {
		400: "GoogleSans-SemiBold",
	},
	mono: {
		400: "GoogleSansCode-Regular",
	},
} as const;

type TextStyleToken = {
	fontFamily: string;
	fontSize: number;
	lineHeight: number;
	letterSpacing: number;
	maxFontSizeMultiplier?: number;
};

export const type = {
	largeIOS: { fontFamily: fonts.display[400], fontSize: 34, lineHeight: 41, letterSpacing: -0.3 },
	largeAnd: { fontFamily: fonts.display[400], fontSize: 28, lineHeight: 34, letterSpacing: 0 },
	display: { fontFamily: fonts.display[400], fontSize: 28, lineHeight: 34, letterSpacing: -0.2 },
	heading: { fontFamily: fonts.display[400], fontSize: 22, lineHeight: 28, letterSpacing: 0 },
	title: { fontFamily: fonts.ui[600], fontSize: 17, lineHeight: 22, letterSpacing: 0 },
	bodyLarge: { fontFamily: fonts.ui[400], fontSize: 16, lineHeight: 22, letterSpacing: 0 },
	body: { fontFamily: fonts.ui[400], fontSize: 15, lineHeight: 21, letterSpacing: 0 },
	label: { fontFamily: fonts.ui[600], fontSize: 15, lineHeight: 20, letterSpacing: 0 },
	callout: { fontFamily: fonts.ui[400], fontSize: 13, lineHeight: 18, letterSpacing: 0 },
	caption: { fontFamily: fonts.ui[500], fontSize: 12, lineHeight: 16, letterSpacing: 0 },
	micro: { fontFamily: fonts.ui[600], fontSize: 11, lineHeight: 13, letterSpacing: 0.1, maxFontSizeMultiplier: 1.6 },
	mono: { fontFamily: fonts.mono[400], fontSize: 13, lineHeight: 18, letterSpacing: 0 },
	/** Section labels and eyebrows, in sentence case. */
	eyebrow: {
		fontFamily: fonts.ui[600],
		fontSize: 12,
		lineHeight: 16,
		letterSpacing: 0,
		maxFontSizeMultiplier: 1.6,
	},
} satisfies Record<string, TextStyleToken>;

/** `pageThumb`: The display face that scales with the letter card, 3.3% of its width. */
export const pageThumb = { fontFamily: fonts.display[400], widthRatio: 0.033 } as const;

// §3 Spacing, 4 pt grid.
export const space = { s0: 2, s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s12: 48 } as const;

// §3.1 Sizes.
export const size = {
	hit: 44,
	row: 52,
	input: 46,
	button: 48,
	chip: 32,
	tabBar: 52,
	topBar: 44,
	editorBar: 56,
	newPill: { width: 34, height: 26 },
	grabber: { width: 36, height: 5 },
	sidebar: 240,
	panel: 400,
	formSheet: 540,
	sheetShare: 440,
	sheetDetail: 480,
	/** Phosphor sizes: inline meta 16, list rows 20, toolbars 22, tab bar and nav bar 24. */
	icon: { meta: 16, row: 20, toolbar: 22, bar: 24 },
} as const;

// §4 Radii.
export const radius = {
	/** Bridged to HeroUI's radii (Phase 02): small controls 4, fields and buttons 8, cards and sheets 12. */
	rSm: 4,
	rMd: 8,
	rLg: 12,
} as const;

// §5 Shadows. `boxShadow` first; `ios` and `elevation` are the legacy fallback for Android below API 28.
type ShadowToken = {
	boxShadow: string;
	ios: {
		shadowColor: string;
		shadowOffset: { width: number; height: number };
		shadowOpacity: number;
		shadowRadius: number;
	};
	elevation: number;
};

export const shadows: Record<ColorScheme, Record<"e1" | "e2" | "e3" | "ePage", ShadowToken>> = {
	light: {
		e1: {
			boxShadow: "0 1px 2px #17161112",
			ios: { shadowColor: "#171611", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 1 },
			elevation: 1,
		},
		e2: {
			boxShadow: "0 1px 2px #1716110F, 0 10px 28px -8px #1716112E",
			ios: { shadowColor: "#171611", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 12 },
			elevation: 4,
		},
		e3: {
			boxShadow: "0 2px 6px #17161114, 0 28px 64px -16px #1716114D",
			ios: { shadowColor: "#171611", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.22, shadowRadius: 28 },
			elevation: 12,
		},
		ePage: {
			boxShadow: "0 1px 2px #17161114, 0 12px 36px -12px #17161140",
			ios: { shadowColor: "#171611", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14 },
			elevation: 3,
		},
	},
	dark: {
		e1: {
			boxShadow: "0 1px 2px #00000066",
			ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1 },
			elevation: 1,
		},
		e2: {
			boxShadow: "0 1px 2px #00000066, 0 12px 32px -8px #0000008C",
			ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12 },
			elevation: 4,
		},
		e3: {
			boxShadow: "0 2px 6px #00000066, 0 28px 64px -12px #000000B3",
			ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.6, shadowRadius: 28 },
			elevation: 12,
		},
		ePage: {
			boxShadow: "0 1px 2px #00000066, 0 12px 36px -12px #00000099",
			ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14 },
			elevation: 3,
		},
	},
};

// §6 Motion. With reduced motion on, d1–d3 become 0 for movement.
export const motion = {
	d1: 120,
	d2: 200,
	d3: 320,
	ease: Easing.bezier(0.23, 1, 0.32, 1),
	easeMove: Easing.bezier(0.77, 0, 0.175, 1),
	easeDrawer: Easing.bezier(0.32, 0.72, 0, 1),
} as const;
