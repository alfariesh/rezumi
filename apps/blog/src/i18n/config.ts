/**
 * The blog's languages. English is served unprefixed and every other locale under `/<locale>/` (Astro's default
 * `prefix-other-locales` routing; a prefixed default locale would break the EmDash admin). Add a locale here, in
 * `src/i18n/messages.ts` and as a route folder under `src/pages/<locale>/`.
 */
export const locales = ["en", "id"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (locales as readonly string[]).includes(value);
}
