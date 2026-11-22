/** Parse a complete nonnegative amount. Invalid notation must never silently change a saved requirement. */
export function parseAmount(input: string, locale: string): number | null | undefined {
	const digits = new Intl.NumberFormat(locale, { useGrouping: false });
	const { decimal, group } = separators(locale, digits);
	let text = input.trim().replace(/[\u061c\u200e\u200f]/g, "");
	if (!text) return null;
	for (let digit = 0; digit <= 9; digit++) text = text.replaceAll(digits.format(digit), String(digit));
	const pieces = text.split(decimal);
	if (pieces.length > 2) return undefined;
	const [whole = "", fraction] = pieces;
	const ungrouped = group ? whole.replaceAll(group, "") : whole;
	if (!/^\d+$/.test(ungrouped) || (fraction !== undefined && !/^\d{1,2}$/.test(fraction))) return undefined;
	if (group && whole.includes(group)) {
		const expected = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(ungrouped));
		let normalized = expected;
		for (let digit = 0; digit <= 9; digit++) normalized = normalized.replaceAll(digits.format(digit), String(digit));
		if (whole !== normalized) return undefined;
	}
	const value = Number(`${ungrouped}.${fraction ?? "0"}`);
	return Number.isFinite(value) && value <= Number.MAX_SAFE_INTEGER ? value : undefined;
}

/**
 * The locale's decimal and group separators, read from a formatted sample. Hermes on iOS has no
 * `NumberFormat.formatToParts`, so the parts are found in the string itself.
 */
function separators(locale: string, digits: Intl.NumberFormat): { decimal: string; group: string | undefined } {
	let sample = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(12345.6);
	for (let digit = 0; digit <= 9; digit++) sample = sample.replaceAll(digits.format(digit), String(digit));
	const match = /^12(\D*)345(\D+)6$/.exec(sample.replace(/[\u061c\u200e\u200f]/g, ""));
	return { decimal: match?.[2] ?? ".", group: match?.[1] || undefined };
}
