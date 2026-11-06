import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import type { CSSProperties } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { effectDemoColors } from "@rezumi/portfolio/editor";
import { EFFECT_CSS, EFFECT_RUNNERS, EFFECT_SHARED_CSS } from "@rezumi/portfolio/effects";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { effectDescription, effectLabel } from "../themes";
import { ChoiceSelect, TextInput } from "./fields";
import { editPortfolio, usePortfolioData } from "./store";
import { usePortfolioEditorUi } from "./ui";
import { useEditorView } from "./use-view";

/** The effects' rules, once, for the demos in this panel (they only match `[data-pfx]` elements). */
const DEMO_CSS = [EFFECT_SHARED_CSS, ...Object.values(EFFECT_CSS)].join("\n");

const PHRASE_LIMIT = 40;

type EffectDemoProps = { effect: PortfolioHeroEffect; name: string; headline: string; phrases: string[]; play: number };

/**
 * A small live sample of an effect, drawn with the same rules and script as the page, in the page's colours. It plays
 * again whenever `play` changes (the card is chosen, pointed at or focused); with "reduce motion" it stays still.
 */
function EffectDemo({ effect, name, headline, phrases, play }: EffectDemoProps) {
	const root = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (!play || !root.current) return;
		EFFECT_RUNNERS[effect]?.(root.current.ownerDocument);
	}, [effect, play]);
	const words = name.split(/(\s+)/);
	if (effect === "typewriter") {
		const list = [headline, ...phrases]
			.map((phrase) => phrase.trim())
			.filter(Boolean)
			.slice(0, 3);
		const shown = list.length ? list : [t`Product designer`];
		return (
			<span ref={root} key={play} data-pfx="typewriter" data-pfx-phrases={JSON.stringify(shown)}>
				<span className="pfx-type" aria-hidden="true">
					{shown.map((phrase) => (
						<span key={phrase} className="pfx-type__ghost">
							{phrase}
						</span>
					))}
					<span className="pfx-type__out">{shown[0]}</span>
				</span>
			</span>
		);
	}
	return (
		<span ref={root} key={play} {...(effect === "none" ? {} : { "data-pfx": effect })} className="font-bold">
			{effect === "fade-up" || effect === "vector-hover" ? (
				<span dir="auto">
					{words.map((word, index) =>
						/^\s*$/.test(word) ? (
							word
						) : (
							// oxlint-disable-next-line react/no-array-index-key -- words of one name, in order.
							<span key={index} className="pfx-w" style={{ "--i": index / 2 } as CSSProperties}>
								{word}
							</span>
						),
					)}
				</span>
			) : (
				name
			)}
		</span>
	);
}

/**
 * Design → Intro: the intro's background and its text effect (`01-desain.md` section 18). Each effect the theme offers
 * is a card with a live sample; choosing one replays it in the preview, and "Replay" there plays it again.
 */
export function IntroEffectPicker() {
	const data = usePortfolioData();
	const view = useEditorView();
	const replay = usePortfolioEditorUi((state) => state.replayEffect);
	const [plays, setPlays] = useState<Partial<Record<PortfolioHeroEffect, number>>>({});
	const { theme } = data;
	const effects = PORTFOLIO_THEME_INFO[theme].effects;
	const current = view.design.effect.id;
	const mode = view.design.scheme === "dark" ? "dark" : "light";
	const colors = effectDemoColors(theme, view.design.accent, mode);
	const name = view.basics.name || t`Your name`;
	const phrases = data.hero.effect.phrases;
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

	return (
		<div className="grid gap-3">
			<style>{DEMO_CSS}</style>
			<div role="radiogroup" aria-label={t`Intro effect`} className="grid gap-2">
				{effects.map((effect, index) => {
					const selected = effect === current;
					return (
						<button
							key={effect}
							type="button"
							role="radio"
							aria-checked={selected}
							onClick={() => {
								editPortfolio((draft) => {
									draft.hero.effect.id = effect;
								});
								playDemo(effect);
								replay();
							}}
							onMouseEnter={() => playDemo(effect)}
							onFocus={() => playDemo(effect)}
							className={cn(
								"grid cursor-(--cursor-interactive) gap-2 rounded-2xl border p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-focus",
								selected ? "border-accent bg-accent-soft" : "border-separator hover:bg-default",
							)}
						>
							<span className="flex items-center gap-2 text-sm font-semibold">
								{effectLabel(effect)}
								{index === 0 && <span className="text-xs font-normal text-muted">{t`(theme default)`}</span>}
								{selected && <Icon name="check-circle" size={18} className="ms-auto text-accent" />}
							</span>
							<span
								className="block truncate rounded-xl border border-separator px-3 py-2 text-lg leading-tight"
								style={demoStyle}
								aria-hidden="true"
							>
								<EffectDemo
									effect={effect}
									name={name}
									headline={view.basics.headline}
									phrases={phrases}
									play={plays[effect] ?? 0}
								/>
							</span>
							<span className="text-xs text-muted">{effectDescription(effect)}</span>
						</button>
					);
				})}
			</div>

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
					{[0, 1].map((index) => (
						<TextInput
							key={index}
							label={index === 0 ? t`Second role` : t`Third role`}
							value={phrases[index] ?? ""}
							maxLength={PHRASE_LIMIT}
							placeholder={index === 0 ? t`e.g. UX researcher` : t`e.g. Mentor`}
							onChange={(value) =>
								editPortfolio(
									(draft) => {
										const { phrases: stored } = draft.hero.effect;
										draft.hero.effect.phrases = Array.from({ length: Math.max(stored.length, index + 1) }, (_, at) =>
											at === index ? value : (stored[at] ?? ""),
										).slice(0, 2);
									},
									{ key: `effect-phrase-${index}` },
								)
							}
						/>
					))}
					{!view.basics.headline && !phrases.some((phrase) => phrase.trim()) && (
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
