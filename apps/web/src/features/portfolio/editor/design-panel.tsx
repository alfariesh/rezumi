import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioScheme, PortfolioVariantKey, PortfolioVariantValue } from "@rezumi/schema/portfolio/themes";
import type { ReactNode } from "react";
import { Segment } from "@heroui-pro/react";
import { Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId } from "react";
import { accentIsCorrected } from "@rezumi/portfolio/editor";
import { PORTFOLIO_HERO_BACKGROUNDS } from "@rezumi/schema/portfolio/data";
import {
	PORTFOLIO_ACCENT_IDS,
	PORTFOLIO_ACCENTS,
	PORTFOLIO_FONT_PAIRS,
	PORTFOLIO_THEME_INFO,
	PORTFOLIO_VARIANT_KEYS,
	themeFontPair,
	themeScheme,
	themeVariant,
} from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { rgbaStringToHex } from "@rezumi/utils/color";
import { cn } from "@rezumi/utils/style";
import { ImageField } from "../images/image-field";
import { ThemeGallery } from "../theme-gallery";
import { useSourceResume } from "./context";
import { ChoiceSelect, PanelGroup } from "./fields";
import { IntroEffectPicker } from "./intro-effect";
import { editPortfolio, usePortfolioData } from "./store";
import { useEditorView } from "./use-view";
import { ColorPicker } from "@/components/input/color-picker";

const variantGroupLabel = (key: PortfolioVariantKey) =>
	({
		hero: t`Intro layout`,
		work: t`Work layout`,
		services: t`Services layout`,
		testimonials: t`Testimonials layout`,
		clients: t`Client logos`,
		experience: t`Experience layout`,
		education: t`Education layout`,
		skills: t`Skills layout`,
		metric: t`Numbers style`,
	})[key];

const variantLabel = (value: PortfolioVariantValue) =>
	({
		"photo-top": t`Photo on top`,
		"photo-left": t`Photo on the left`,
		"photo-right": t`Photo on the right`,
		"big-name": t`Big name`,
		bento: t`Tiles`,
		list: t`List`,
		"grid-2": t`Grid, 2 columns`,
		"grid-3": t`Grid, 3 columns`,
		"featured-grid": t`Featured + grid`,
		cards: t`Cards`,
		carousel: t`Slider`,
		grayscale: t`Gray, colored on hover`,
		color: t`In color`,
		timeline: t`Timeline`,
		compact: t`Compact`,
		chips: t`Chips`,
		groups: t`Groups`,
		kpi: t`KPI cards`,
		big: t`Big numbers`,
		ba: t`Before → after`,
	})[value];

const backgroundLabel = (kind: PortfolioData["hero"]["background"]["kind"]) =>
	({ plain: t`Plain`, "soft-gradient": t`Soft gradient`, pattern: t`Subtle pattern`, image: t`Picture` })[kind];

/**
 * Design: the theme, light or dark, the accent colour, the intro's background and effect, the fonts and each section's
 * layout.
 * Only what the theme supports is offered; every change shows in the preview at once.
 */
export function DesignPanel() {
	return (
		<div className="grid gap-3 p-3">
			<ThemeGroup />
			<ColorsGroup />
			<IntroGroup />
			<FontsGroup />
			<LayoutGroup />
		</div>
	);
}

function ThemeGroup() {
	const { theme } = usePortfolioData();
	return (
		<PanelGroup icon="squares-four" title={<Trans>Theme</Trans>}>
			<ThemeGallery
				value={theme}
				onChange={(id) =>
					editPortfolio((draft) => {
						draft.theme = id;
					})
				}
			/>
		</PanelGroup>
	);
}

function ColorsGroup() {
	const data = usePortfolioData();
	const view = useEditorView();
	const { design, theme } = data;
	const scheme = themeScheme(theme, design.scheme);
	const accent = view.design.accent;
	const corrected = (["light", "dark"] as const).some(
		(mode) => (scheme === "auto" || scheme === mode) && accentIsCorrected(theme, accent, mode),
	);
	const followsResume = design.accent.source === "resume";
	const source = useSourceResume();
	const resumeColor = source.data?.metadata.design.colors.primary;
	const resumeAccent = followsResume ? accent : resumeColor ? rgbaStringToHex(resumeColor).toUpperCase() : undefined;

	const accentLabelId = useId();
	const accentValue =
		design.accent.source === "resume" ? RESUME_ACCENT : design.accent.source === "preset" ? design.accent.id : "";

	const setScheme = (next: PortfolioScheme) =>
		editPortfolio((draft) => {
			draft.design.scheme = next;
		});

	const chooseAccent = (value: string) =>
		editPortfolio((draft) => {
			if (value === RESUME_ACCENT) draft.design.accent = { source: "resume" };
			else {
				const preset = PORTFOLIO_ACCENT_IDS.find((id) => id === value);
				if (preset) draft.design.accent = { source: "preset", id: preset };
			}
		});

	return (
		<PanelGroup icon="palette" title={<Trans>Colors</Trans>}>
			<div className="grid gap-1.5">
				<span className="text-sm font-medium">
					<Trans>Mode</Trans>
				</span>
				<Segment
					aria-label={t`Mode`}
					selectedKey={scheme}
					onSelectionChange={(key) => setScheme(key as PortfolioScheme)}
				>
					<Segment.Item id="light">
						<Icon name="sun" size={16} />
						<Trans>Light</Trans>
					</Segment.Item>
					<Segment.Item id="dark">
						<Icon name="moon" size={16} />
						<Trans>Dark</Trans>
					</Segment.Item>
					<Segment.Item id="auto">
						<Icon name="desktop" size={16} />
						<Trans>Device</Trans>
					</Segment.Item>
				</Segment>
				<span className="text-xs text-muted">
					{scheme === "auto" ? (
						<Trans>Follows each visitor's light or dark setting.</Trans>
					) : (
						<Trans>Every visitor sees this mode.</Trans>
					)}
				</span>
			</div>

			<div className="grid gap-2">
				<span id={accentLabelId} className="text-sm font-medium">
					<Trans>Accent color</Trans>
				</span>
				<div className="flex flex-wrap items-center gap-2">
					{/* One Tab stop for the swatches, arrow keys between them; your own color is its own control. */}
					<RadioGroup
						aria-labelledby={accentLabelId}
						orientation="horizontal"
						// No swatch is chosen while your own color is: null (not "") keeps every swatch reachable by Tab.
						value={accentValue || null}
						onChange={chooseAccent}
						className="flex flex-wrap items-center gap-2"
					>
						<AccentSwatch value={RESUME_ACCENT} label={t`Same as my resume`} color={resumeAccent}>
							<Icon name="file-text" size={16} />
						</AccentSwatch>
						{PORTFOLIO_ACCENT_IDS.map((id) => (
							<AccentSwatch
								key={id}
								value={id}
								label={PORTFOLIO_ACCENTS[id].label}
								color={PORTFOLIO_ACCENTS[id].color}
							/>
						))}
					</RadioGroup>
					<ColorPicker
						aria-label={t`Your own color`}
						value={accent}
						onChange={(value) =>
							editPortfolio(
								(draft) => {
									draft.design.accent = { source: "custom", color: rgbaStringToHex(value).toUpperCase() };
								},
								{ key: "design.accent" },
							)
						}
						className={cn(
							"grid size-9 shrink-0 cursor-(--cursor-interactive) place-items-center rounded-full border border-separator outline-none focus-visible:ring-2 focus-visible:ring-focus",
							design.accent.source === "custom" && "ring-2 ring-accent ring-offset-2 ring-offset-background",
						)}
					/>
				</div>
				<span className="text-xs text-muted">
					{followsResume ? <Trans>Same as your resume, so both look like a set.</Trans> : null}
					{followsResume && corrected ? " " : null}
					{corrected ? (
						<Trans>This color is hard to read as text here, so links and accent text use a deeper shade of it.</Trans>
					) : null}
				</span>
			</div>
		</PanelGroup>
	);
}

/** The accent swatch that follows the resume's color; the others are the curated accents' ids. */
const RESUME_ACCENT = "resume";

type AccentSwatchProps = {
	value: string;
	label: string;
	color: string | undefined;
	children?: ReactNode;
};

/** One accent color: a round swatch named by its label (the color itself is only seen). */
function AccentSwatch({ value, label, color, children }: AccentSwatchProps) {
	return (
		<Radio value={value} aria-label={label}>
			<Radio.Content
				className={({ isSelected, isFocusVisible }) =>
					cn(
						"grid size-9 shrink-0 cursor-(--cursor-interactive) place-items-center rounded-full border border-separator text-white",
						isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
						isFocusVisible && "ring-2 ring-focus ring-offset-2 ring-offset-background",
						!color && "bg-default text-foreground",
					)
				}
				{...(color ? { style: { backgroundColor: color } } : {})}
			>
				{/* The name on hover; screen readers get it from the radio's label. */}
				<span title={label} className="grid size-full place-items-center">
					{children}
				</span>
			</Radio.Content>
		</Radio>
	);
}

/** The intro's background and its text effect (`01-desain.md` section 18). */
function IntroGroup() {
	const data = usePortfolioData();
	return (
		<PanelGroup icon="sparkle" title={<Trans>Intro</Trans>}>
			<ChoiceSelect
				label={t`Intro background`}
				value={data.hero.background.kind}
				options={PORTFOLIO_HERO_BACKGROUNDS.map((kind) => ({
					id: kind,
					label: backgroundLabel(kind),
				}))}
				onChange={(kind) =>
					editPortfolio((draft) => {
						// The picture stays when switching away, so switching back doesn't upload it again.
						draft.hero.background = { ...draft.hero.background, kind };
					})
				}
			/>
			{data.hero.background.kind === "image" && (
				<ImageField
					label={t`Background picture`}
					value={data.hero.background.image}
					altSuggestion=""
					description={t`A darker layer goes over it so the text stays readable. Wide pictures fit best.`}
					onChange={(image) =>
						editPortfolio((draft) => {
							if (image) draft.hero.background.image = image;
							else delete draft.hero.background.image;
						})
					}
				/>
			)}
			<IntroEffectPicker />
		</PanelGroup>
	);
}

function FontsGroup() {
	const { design, theme } = usePortfolioData();
	const info = PORTFOLIO_THEME_INFO[theme];
	const themeDefault = PORTFOLIO_FONT_PAIRS[themeFontPair(theme, undefined)];
	const value = design.fonts.source === "pair" ? design.fonts.id : design.fonts.source;
	const options = [
		{ id: "theme", label: t`Theme default (${themeDefault.label})` },
		{ id: "resume", label: t`Same as my resume` },
		...info.fontPairs.slice(1).map((id) => ({ id, label: PORTFOLIO_FONT_PAIRS[id].label })),
	];

	return (
		<PanelGroup icon="text-aa" title={<Trans>Fonts</Trans>}>
			<ChoiceSelect
				label={t`Font pair`}
				value={value}
				options={options}
				description={
					design.fonts.source === "resume"
						? t`Uses your resume's fonts when they're available on the web; otherwise the theme's.`
						: t`One for headings, one for text.`
				}
				onChange={(next) =>
					editPortfolio((draft) => {
						draft.design.fonts =
							next === "theme" || next === "resume"
								? { source: next }
								: { source: "pair", id: next as keyof typeof PORTFOLIO_FONT_PAIRS };
					})
				}
			/>
		</PanelGroup>
	);
}

function LayoutGroup() {
	const { design, theme } = usePortfolioData();
	const keys = PORTFOLIO_VARIANT_KEYS.filter(
		(key) => (PORTFOLIO_THEME_INFO[theme].variants[key] as readonly string[]).length > 1,
	);
	if (keys.length === 0) return null;

	return (
		<PanelGroup icon="sliders-horizontal" title={<Trans>Layouts</Trans>}>
			{keys.map((key) => {
				const supported = PORTFOLIO_THEME_INFO[theme].variants[key] as readonly PortfolioVariantValue[];
				return (
					<ChoiceSelect
						key={key}
						label={variantGroupLabel(key)}
						value={themeVariant(theme, key, design.variants[key])}
						options={supported.map((value, index) => ({
							id: value,
							label: index === 0 ? t`${variantLabel(value)} (theme default)` : variantLabel(value),
						}))}
						onChange={(value) =>
							editPortfolio((draft) => {
								draft.design.variants[key] = value;
							})
						}
					/>
				);
			})}
			<p className="text-xs text-muted">
				<Trans>The numbers style applies to results in your work once you add them.</Trans>
			</p>
		</PanelGroup>
	);
}
