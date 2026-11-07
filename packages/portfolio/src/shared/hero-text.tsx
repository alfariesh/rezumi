import type { PortfolioView } from "../view";
import type { ReactNode } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { useRender } from "./context";
import { vars } from "./primitives";

type Effect = PortfolioView["design"]["effect"];

/** Effects drawn word by word: each word is a span the CSS animates in turn. Garis vektor falls back to it on touch. */
const WORD_EFFECTS = new Set(["fade-up", "vector-hover"]);

/**
 * The phrases the typewriter alternates: the headline first (where it ends), then up to
 * `PORTFOLIO_LIMITS.typewriterPhrases` of the person's roles, without repeats.
 */
function typewriterPhrases(headline: string, effect: Effect): string[] {
	const first = headline.trim();
	const roles: string[] = [];
	for (const phrase of effect.phrases) {
		const text = phrase.trim();
		if (text && text !== first && !roles.includes(text)) roles.push(text);
	}
	return [...(first ? [first] : []), ...roles.slice(0, PORTFOLIO_LIMITS.typewriterPhrases)];
}

/** Which element plays the intro effect, if any: the typewriter always types the headline. */
export function effectTarget(view: PortfolioView): "name" | "headline" | null {
	const { effect } = view.design;
	if (effect.id === "none") return null;
	if (effect.id === "typewriter") return typewriterPhrases(view.basics.headline, effect).length > 1 ? "headline" : null;
	if (effect.target === "headline" && !view.basics.headline) return "name";
	return effect.target;
}

/** The text of an element that plays a word or whole-text effect. The text itself stays in the page as it is. */
function effectText(text: string, id: Effect["id"]): ReactNode {
	if (!WORD_EFFECTS.has(id)) return text;
	let index = 0;
	// The words are inline blocks, which bidi treats as neutral: `dir="auto"` keeps a Latin name in order on an
	// Arabic page (`02-teknis.md` section 25).
	return (
		<span dir="auto">
			{text.split(/(\s+)/).map((part, position) =>
				/^\s+$/.test(part) || !part ? (
					part
				) : (
					<span key={position} className="pfx-w" style={vars({ "--i": index++ })}>
						{part}
					</span>
				),
			)}
		</span>
	);
}

type HeroNameProps = { className?: string };

/**
 * The intro's name (`h1`), sized by its longest word (`--name-word`), with the intro effect when the effect plays on
 * the name (`01-desain.md` section 18). The name is always real text in the HTML; an effect only styles it, or the page
 * script draws an `aria-hidden` layer over it.
 */
export function HeroName({ className }: HeroNameProps) {
	const { view } = useRender();
	const target = effectTarget(view);
	const id = target === "name" ? view.design.effect.id : "none";
	return (
		<h1
			className={["pf-name", className].filter(Boolean).join(" ")}
			style={vars({ "--name-word": view.basics.longestWord })}
			{...(id === "none" ? {} : { "data-pfx": id })}
		>
			{effectText(view.basics.name, id)}
		</h1>
	);
}

type HeroHeadlineProps = { className?: string };

/**
 * The intro's headline, with the intro effect when it plays there. The typewriter keeps every phrase in the page: the
 * first one shows (and is what a screen reader reads, with the others), and all of them reserve their space so the
 * line never moves while typing.
 */
export function HeroHeadline({ className }: HeroHeadlineProps) {
	const { view } = useRender();
	const { headline } = view.basics;
	const target = effectTarget(view);
	const { effect } = view.design;
	if (target === "headline" && effect.id === "typewriter") {
		const phrases = typewriterPhrases(headline, effect);
		return (
			<p className={className} data-pfx="typewriter" data-pfx-phrases={JSON.stringify(phrases)}>
				<span className="pfx-type" aria-hidden="true">
					{phrases.map((phrase) => (
						<span key={phrase} className="pfx-type__ghost">
							{phrase}
						</span>
					))}
					<span className="pfx-type__out">{phrases[0]}</span>
				</span>
				<span className="sr-only">{phrases.join(" · ")}</span>
			</p>
		);
	}
	if (!headline) return null;
	const id = target === "headline" ? effect.id : "none";
	return (
		<p className={className} {...(id === "none" ? {} : { "data-pfx": id })}>
			{effectText(headline, id)}
		</p>
	);
}
