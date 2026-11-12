import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";

/**
 * The phrases the typewriter alternates, the one rule the page and the editor share: the headline first (where it
 * ends), then up to `PORTFOLIO_LIMITS.typewriterPhrases` of the person's roles, trimmed, without blanks or repeats.
 * The effect plays only when this gives at least two phrases.
 */
export function typewriterPhrases(headline: string, roles: readonly string[]): string[] {
	const first = headline.trim();
	const rest: string[] = [];
	for (const phrase of roles) {
		const text = phrase.trim();
		if (text && text !== first && !rest.includes(text)) rest.push(text);
	}
	return [...(first ? [first] : []), ...rest.slice(0, PORTFOLIO_LIMITS.typewriterPhrases)];
}
