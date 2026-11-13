import type { GroupItem } from "@/features/resume/editor/chrome/group-nav";
import type { Color } from "@heroui/react";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioScheme, PortfolioVariantKey, PortfolioVariantValue } from "@rezumi/schema/portfolio/themes";
import type { ReactNode } from "react";
import { CellColorPicker, Segment } from "@heroui-pro/react";
import { Chip, ColorArea, ColorField, ColorSlider, parseColor, Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
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
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { rgbaStringToHex } from "@rezumi/utils/color";
import { cn } from "@rezumi/utils/style";
import { ImageField } from "../images/image-field";
import { ThemeGallery } from "../theme-gallery";
import { usePortfolioSource } from "./context";
import { ChoiceSelect, PanelGroup } from "./fields";
import { IntroEffectPicker } from "./intro-effect";
import { editPortfolio, usePortfolioData } from "./store";
import { useEditorView } from "./use-view";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { GroupPanel, useGroupSpy } from "@/features/resume/editor/chrome/group-nav";

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
	const groups = [
		{ id: "theme", icon: "squares-four", label: t`Theme` },
		{ id: "colors", icon: "palette", label: t`Colors` },
		{ id: "intro", icon: "sparkle", label: t`Intro` },
		{ id: "fonts", icon: "text-aa", label: t`Fonts` },
		{ id: "layouts", icon: "sliders-horizontal", label: t`Layouts` },
		{ id: "badge", icon: "seal-check", label: t`Badge` },
	] as const satisfies readonly GroupItem<string>[];
	const { navRef, active, jump } = useGroupSpy(
		groups.map((group) => group.id),
		"portfolio-design-",
	);
	const content = (
		<>
			<ThemeGroup />
			<ColorsGroup />
			<IntroGroup />
			<FontsGroup />
			<LayoutGroup />
			<BadgeGroup />
		</>
	);

	return (
		<GroupPanel label={t`Design groups`} items={groups} active={active} onJump={jump} navRef={navRef}>
			{content}
		</GroupPanel>
	);
}

/** The "Made with Rezumi" badge: paid plans can hide it; on other plans the page always shows it. */
function BadgeGroup() {
	const { credit } = usePortfolioData();
	const plan = usePlan();
	const canHide = hasPlanFeature(plan, "hidePortfolioCredit");
	return (
		<PanelGroup id="portfolio-design-badge" icon="seal-check" title={<Trans>Badge</Trans>}>
			<CellSwitchRow
				label={
					<span className="flex items-center gap-2">
						<Trans>Show Made with Rezumi</Trans>
						{!canHide && (
							<Chip size="sm" variant="soft" color="accent">
								<Icon name="lock" size={12} aria-hidden />
								Plus
							</Chip>
						)}
					</span>
				}
				isSelected={credit.show || !canHide}
				onChange={(show) => {
					if (!show && !canHide) {
						openPlanDialog({ kind: "feature", feature: "hidePortfolioCredit" });
						return;
					}
					editPortfolio((draft) => {
						draft.credit.show = show;
					});
				}}
			/>
		</PanelGroup>
	);
}

function ThemeGroup() {
	const { theme } = usePortfolioData();
	return (
		<PanelGroup id="portfolio-design-theme" icon="squares-four" title={<Trans>Theme</Trans>}>
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
	const source = usePortfolioSource();
	// The Profile has no colors: "Same as my resume" falls back to the theme's.
	const resumeColor = source.designData?.metadata.design.colors.primary;
	const resumeAccent = followsResume ? accent : resumeColor ? rgbaStringToHex(resumeColor).toUpperCase() : undefined;

	const accentLabelId = useId();
	// A stored grey or black has no hue: keep the colour last dragged to while it still matches, so the thumbs stay put.
	const [picked, setPicked] = useState<Color | null>(null);
	const pickerColor = picked?.toString("hex").toUpperCase() === accent.toUpperCase() ? picked : parseColor(accent);
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
		<PanelGroup id="portfolio-design-colors" icon="palette" title={<Trans>Colors</Trans>}>
			<div className="grid gap-2">
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
			</div>

			<div className="grid gap-2">
				<span id={accentLabelId} className="text-sm font-medium">
					<Trans>Accent color</Trans>
				</span>
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
						<AccentSwatch key={id} value={id} label={PORTFOLIO_ACCENTS[id].label} color={PORTFOLIO_ACCENTS[id].color} />
					))}
				</RadioGroup>
			</div>

			<CellColorPicker
				aria-label={t`Your own color`}
				value={pickerColor}
				onChange={(next) => {
					setPicked(next);
					editPortfolio(
						(draft) => {
							draft.design.accent = { source: "custom", color: next.toString("hex").toUpperCase() };
						},
						{ key: "design.accent" },
					);
				}}
			>
				<CellColorPicker.Trigger>
					<CellColorPicker.Label>
						<Trans>Your own color</Trans>
					</CellColorPicker.Label>
					<CellColorPicker.ValueDisplay />
					<CellColorPicker.Swatch />
				</CellColorPicker.Trigger>
				<CellColorPicker.Popover>
					<ColorArea
						aria-label={t`Saturation and brightness`}
						colorSpace="hsb"
						xChannel="saturation"
						yChannel="brightness"
						className="w-full max-w-full"
					>
						<ColorArea.Thumb />
					</ColorArea>
					<ColorSlider aria-label={t`Hue`} channel="hue" colorSpace="hsb">
						<ColorSlider.Track>
							<ColorSlider.Thumb />
						</ColorSlider.Track>
					</ColorSlider>
					<ColorField aria-label={t`Your own color (hex)`}>
						<ColorField.Group variant="secondary" fullWidth>
							<ColorField.Input className="font-mono" />
						</ColorField.Group>
					</ColorField>
				</CellColorPicker.Popover>
			</CellColorPicker>

			{corrected && (
				<p role="status" className="px-1 text-body-xs text-warning">
					<Trans>This color is hard to read as text here, so links and accent text use a deeper shade of it.</Trans>
				</p>
			)}
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
		<PanelGroup id="portfolio-design-intro" icon="sparkle" title={<Trans>Intro</Trans>}>
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
					onChange={(image, typing) =>
						editPortfolio(
							(draft) => {
								if (image) draft.hero.background.image = image;
								else delete draft.hero.background.image;
							},
							typing ? { key: "hero.background.image.alt" } : undefined,
						)
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
		<PanelGroup id="portfolio-design-fonts" icon="text-aa" title={<Trans>Fonts</Trans>}>
			<ChoiceSelect
				label={t`Font pair`}
				value={value}
				options={options}
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
		<PanelGroup id="portfolio-design-layouts" icon="sliders-horizontal" title={<Trans>Layouts</Trans>}>
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
		</PanelGroup>
	);
}
