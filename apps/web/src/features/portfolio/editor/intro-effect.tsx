import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import type { CSSProperties } from "react";
import { Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { effectDemoColors } from "@rezumi/portfolio/editor";
import { EFFECT_CSS, EFFECT_SHARED_CSS } from "@rezumi/portfolio/effects";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { effectDescription, effectLabel } from "../themes";
import { EffectDemo } from "./effect-demo";
import { ChoiceSelect, TextInput } from "./fields";
import { editPortfolio, usePortfolioData } from "./store";
import { usePortfolioEditorUi } from "./ui";
import { useEditorView } from "./use-view";

/** The effects' rules, once, for the demos in this panel (they only match `[data-pfx]` elements). */
const DEMO_CSS = [EFFECT_SHARED_CSS, ...Object.values(EFFECT_CSS)].join("\n");

/**
 * What the typewriter types, as the page decides it: the headline, then the roles, without blanks or repeats, the
 * headline and at most `PORTFOLIO_LIMITS.typewriterPhrases` roles.
 */
function typewriterPhrases(headline: string, roles: readonly string[]): string[] {
	const phrases: string[] = [];
	for (const phrase of [headline, ...roles]) {
		const text = phrase.trim();
		if (text && !phrases.includes(text)) phrases.push(text);
	}
	return phrases.slice(0, 1 + PORTFOLIO_LIMITS.typewriterPhrases);
}

/** The label of the typewriter's role field `index` (0 for the first role after the headline; at most two). */
const roleLabel = (index: number) => (index === 0 ? t`Second role` : t`Third role`);

/**
 * Design → Intro: the intro's background and its text effect (`01-desain.md` section 18). Each effect the theme offers
 * is a card with a live sample; choosing one replays it in the preview, and "Replay" there plays it again.
 */
export function IntroEffectPicker() {
	const data = usePortfolioData();
	const view = useEditorView();
	const replay = usePortfolioEditorUi((state) => state.replayEffect);
	const [plays, setPlays] = useState<Partial<Record<PortfolioHeroEffect, number>>>({});
	const id = useId();
	const { theme } = data;
	const effects = PORTFOLIO_THEME_INFO[theme].effects;
	const current = view.design.effect.id;
	const mode = view.design.scheme === "dark" ? "dark" : "light";
	const colors = effectDemoColors(theme, view.design.accent, mode);
	const name = view.basics.name || t`Your name`;
	const roles = data.hero.effect.phrases;
	const typed = typewriterPhrases(view.basics.headline, roles);
	const playDemo = (effect: PortfolioHeroEffect) =>
		setPlays((state) => ({ ...state, [effect]: (state[effect] ?? 0) + 1 }));
	const demoStyle = {
		"--pf-bg": colors.bg,
		"--pf-text": colors.text,
		"--pf-accent-text": colors.accentText,
		"--pf-fx-a": colors.gradient[0],
		"--pf-fx-b": colors.gradient[1],
		"--pf-fx-c": colors.gradient[2],
		backgroundColor: colors.bg,
		color: colors.text,
	} as CSSProperties;

	const choose = (value: string) => {
		const effect = effects.find((candidate) => candidate === value);
		if (!effect) return;
		editPortfolio((draft) => {
			draft.hero.effect.id = effect;
		});
		playDemo(effect);
		replay();
	};

	return (
		<div className="grid gap-3">
			<style>{DEMO_CSS}</style>
			<RadioGroup
				aria-label={t`Intro effect`}
				value={current}
				onChange={choose}
				className="grid gap-2 **:data-[slot=radio]:mt-0"
			>
				{effects.map((effect, index) => (
					<Radio
						key={effect}
						value={effect}
						aria-labelledby={`${id}-${effect}-name`}
						aria-describedby={`${id}-${effect}-description`}
						onFocus={() => playDemo(effect)}
						className="w-full"
					>
						<Radio.Content
							onHoverStart={() => playDemo(effect)}
							className={({ isSelected, isFocusVisible }) =>
								cn(
									"grid w-full gap-2 rounded-2xl border p-3 text-start",
									isSelected ? "border-accent bg-accent-soft" : "border-separator hover:bg-default",
									isFocusVisible && "ring-2 ring-focus",
								)
							}
						>
							<span className="flex items-center gap-2 text-sm font-semibold">
								<span id={`${id}-${effect}-name`}>{effectLabel(effect)}</span>
								{index === 0 && <span className="text-xs font-normal text-muted">{t`(theme default)`}</span>}
								{effect === current && <Icon name="check-circle" size={18} className="ms-auto text-accent" />}
							</span>
							<span
								className="block truncate rounded-xl border border-separator px-3 py-2 text-lg leading-tight"
								style={demoStyle}
								aria-hidden="true"
							>
								<EffectDemo
									effect={effect}
									name={name}
									phrases={typed.length ? typed : [t`Product designer`]}
									play={plays[effect] ?? 0}
								/>
							</span>
							<span id={`${id}-${effect}-description`} className="text-xs text-muted">
								{effectDescription(effect)}
							</span>
						</Radio.Content>
					</Radio>
				))}
			</RadioGroup>

			{current !== "none" && current !== "typewriter" && Boolean(view.basics.headline) && (
				<ChoiceSelect
					label={t`Plays on`}
					value={data.hero.effect.target}
					options={[
						{ id: "name", label: t`Your name` },
						{ id: "headline", label: t`Your headline` },
					]}
					onChange={(target) =>
						editPortfolio((draft) => {
							draft.hero.effect.target = target;
						})
					}
				/>
			)}

			{current === "typewriter" && (
				<div className="grid gap-2">
					<p className="text-xs text-muted">
						<Trans>
							Your headline types first and is where it stops. Add up to two more roles it switches to, in about five
							seconds.
						</Trans>
					</p>
					{Array.from({ length: PORTFOLIO_LIMITS.typewriterPhrases }, (_, index) => (
						<TextInput
							key={index}
							label={roleLabel(index)}
							value={roles[index] ?? ""}
							maxLength={PORTFOLIO_LIMITS.text.phrase}
							placeholder={index === 0 ? t`e.g. UX researcher` : t`e.g. Mentor`}
							onChange={(value) =>
								editPortfolio(
									(draft) => {
										const { phrases: stored } = draft.hero.effect;
										draft.hero.effect.phrases = Array.from({ length: Math.max(stored.length, index + 1) }, (_, at) =>
											at === index ? value : (stored[at] ?? ""),
										).slice(0, PORTFOLIO_LIMITS.typewriterPhrases);
									},
									{ key: `effect-phrase-${index}` },
								)
							}
						/>
					))}
					{typed.length === 0 && (
						<p className="text-xs text-warning">
							<Trans>Add a headline or a role so there is something to type.</Trans>
						</p>
					)}
				</div>
			)}

			<p className="text-xs text-muted">
				<Trans>
					Effects stop by themselves within five seconds and stay still for visitors who ask their device for less
					motion.
				</Trans>
			</p>
		</div>
	);
}
