import { westernDigits } from "@rezumi/portfolio/metric";
import { truncateText } from "@rezumi/portfolio/text";
import { PORTFOLIO_AI_PLACEHOLDER } from "@rezumi/schema/portfolio/ai";

/**
 * What AI may say on a public page: only what the person gave it. Prompts ask for that; these checks enforce the part
 * code can see, numbers and capitalized names, over whatever the model answers.
 */

const NUMBER = /\d+(?:[.,]\d+)*/g;
const WORD = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}+)?/gu;
/** Where a sentence ends: Latin, Arabic, Indic and Ethiopic marks take a space after them; Chinese, Japanese and Khmer don't. */
const SENTENCE_END = /(?<=[.!?…؟।॥።۔])\s+|(?<=[。！？។])\s*/u;
const NO_SPACE_AFTER = /[。！？។]$/u;

const joinSentences = (sentences: readonly string[]) =>
	sentences.reduce((text, next) => (!text || NO_SPACE_AFTER.test(text) ? `${text}${next}` : `${text} ${next}`), "");

/** Text without its places left to fill in. One that holds a number is a claim, so it stays and gets checked. */
const withoutPlaceholders = (text: string) =>
	text.replace(PORTFOLIO_AI_PLACEHOLDER, (place) => (/\p{Nd}/u.test(place) ? place : " "));

/** Western digits, with the Arabic decimal separator (٫) as a point. */
const plainDigits = (text: string) => westernDigits(text).replace(/\u066b/g, ".");

/**
 * A number by what it says: "1.200", "1,200" and "1200" are the same, and so are 2,8 and 2.8, but not 1.5 and 15. A
 * separator before exactly three digits groups thousands; any other is the decimal point.
 */
const digitsOf = (token: string) =>
	token
		.replace(/[.,](?=\d{3}(?!\d))/g, "")
		.replace(/,/g, ".")
		.replace(/^0+(?=\d)/, "");

const numbersIn = (text: string) => (plainDigits(text).match(NUMBER) ?? []).map(digitsOf);

/** A word without its possessive or contraction ("Kopi's" is Kopi, "I'm" is I), in lower case. */
const stem = (word: string) => word.replace(/['’].*$/, "").toLowerCase();

const wordsIn = (text: string) => text.match(WORD) ?? [];

type KnownFacts = { numbers: Set<string>; words: Set<string> };

/** The numbers and words of the input, for checking what came back. */
export function knownFacts(...texts: string[]): KnownFacts {
	const all = texts.join("\n");
	return { numbers: new Set(numbersIn(all)), words: new Set(wordsIn(all).map(stem)) };
}

/** The numbers in `text` the input doesn't have. A place left to fill in says nothing, so it isn't counted. */
export function newNumbers(text: string, facts: KnownFacts): string[] {
	return numbersIn(withoutPlaceholders(text)).filter((number) => !facts.numbers.has(number));
}

/**
 * Capitalized words in `text` the input doesn't have, in any spelling: a new name, most likely. A sentence's first word
 * is capitalized anyway, and scripts without capitals have nothing to find, so this only ever under-reports.
 */
export function newNames(text: string, facts: KnownFacts): string[] {
	return withoutPlaceholders(text)
		.split(SENTENCE_END)
		.flatMap((sentence) => wordsIn(sentence).slice(1))
		.filter((word) => /^\p{Lu}/u.test(word) && stem(word) !== "i" && !facts.words.has(stem(word)));
}

/**
 * The sentences of `text` the input backs up. A sentence goes whole, since half of one reads worse than none; the
 * person sees the rest and can add what they know. `names` is off when the answer's language
 * isn't the input's, where every translated place or month would look like a new name.
 */
export function supportedSentences(text: string, facts: KnownFacts, options: { names: boolean }): string {
	return joinSentences(
		text
			.split(SENTENCE_END)
			.filter(
				(sentence) => !newNumbers(sentence, facts).length && !(options.names && newNames(sentence, facts).length),
			),
	);
}

/**
 * Whole sentences of `text` up to `max` characters. When even the first is too long, it ends at its last comma or colon
 * in range, which still reads as a sentence; only with none does it get cut mid-thought with "…".
 */
export function fitSentences(text: string, max: number): string {
	if (text.length <= max) return text;
	let fitted = "";
	for (const sentence of text.split(SENTENCE_END)) {
		const next = joinSentences([fitted, sentence]);
		if (next.length > max) break;
		fitted = next;
	}
	if (fitted) return fitted;
	const head = text.slice(0, max);
	const clause = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "));
	return clause > max / 2 ? `${head.slice(0, clause)}.` : truncateText(text, max);
}

/** Text compared as written: spacing, case and the shape of quote marks don't matter. */
const comparable = (text: string) =>
	text
		.replace(/\s+/g, " ")
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.trim()
		.toLowerCase();

/** Whether `quote` is word for word in `text`, whatever its spacing and quote marks. */
export function quoteIsIn(quote: string, text: string): boolean {
	const wanted = comparable(quote);
	return wanted.length > 0 && comparable(text).includes(wanted);
}

/**
 * What a number written with separators can mean. "1,2" is only 1.2; "1.200" is 1200 in Indonesian and 1.2 in English.
 */
function readings(token: string): number[] {
	const parts = token.split(/[.,]/);
	const last = parts.pop() ?? "";
	if (!parts.length) return [Number(last)];
	const decimal = Number(`${parts.join("")}.${last}`);
	return last.length === 3 ? [Number(`${parts.join("")}${last}`), decimal] : [decimal];
}

/** The scales a word after a number stands for. "M" is a million in English and a billion (miliar) in Indonesian. */
const SCALE_WORDS: Record<string, readonly number[]> = {
	k: [1e3],
	rb: [1e3],
	ribu: [1e3],
	thousand: [1e3],
	jt: [1e6],
	juta: [1e6],
	mn: [1e6],
	mio: [1e6],
	million: [1e6],
	m: [1e6, 1e9],
	b: [1e9],
	bn: [1e9],
	miliar: [1e9],
	milyar: [1e9],
	billion: [1e9],
	t: [1e12],
	tn: [1e12],
	triliun: [1e12],
	trillion: [1e12],
};

/**
 * Whether `quote` holds `value`. An amount may be written with a word ("1,2 juta", "2 million"), and only then does it
 * count at that scale; every other value must be the number as written.
 */
export function quoteHoldsValue(quote: string, value: number, format: string): boolean {
	const scaled = format === "compact" || format === "currency";
	const target = Math.abs(value);
	const same = (a: number) => Math.abs(a - target) <= Math.max(1e-9, target * 1e-9);
	return [...plainDigits(quote).matchAll(/(\d+(?:[.,]\d+)*)\s*(\p{L}*)/gu)].some(([, token = "", word = ""]) => {
		const scales = [1, ...(scaled ? (SCALE_WORDS[word.toLowerCase()] ?? []) : [])];
		return readings(token).some((reading) => scales.some((scale) => same(reading * scale)));
	});
}
