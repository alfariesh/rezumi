import { useState } from "react";
import { cn } from "@rezumi/utils/style";

/*
 * Round country flags, served as static files from `/flags/<ISO 3166-1 alpha-2>.svg` (public/flags) and loaded only
 * when one is on screen, so none of them is in the JavaScript bundle. A code with no file shows nothing.
 */

/** Currencies whose code does not start with their country's: the euro's flag is the EU's. */
const CURRENCY_FLAG: Record<string, string> = { EUR: "EU", ANG: "CW", SHP: "SH", XPF: "PF" };

/** The flag a currency is shown with: its country's, from the currency code ("USD" is "US"). */
export function currencyFlagCode(currency: string) {
	const code = currency.toUpperCase();
	return CURRENCY_FLAG[code] ?? code.slice(0, 2);
}

type FlagIconProps = {
	/** A country code, "ID", or a currency's via `currencyFlagCode`. */
	code: string;
	size?: number;
	className?: string;
};

/** A decorative flag: the country or currency is always named in text beside it. */
export function FlagIcon({ code, size = 16, className }: FlagIconProps) {
	const [missing, setMissing] = useState<string | null>(null);
	if (missing === code) return null;
	return (
		<img
			src={`/flags/${code.toUpperCase()}.svg`}
			alt=""
			width={size}
			height={size}
			loading="lazy"
			decoding="async"
			draggable={false}
			onError={() => setMissing(code)}
			className={cn("shrink-0 rounded-full", className)}
		/>
	);
}
