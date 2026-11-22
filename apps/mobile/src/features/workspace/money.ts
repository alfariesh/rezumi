/** "€72,000": an offer's amount in its own currency, whole units. An unknown code falls back to "72,000 XYZ". */
export function formatMoney(locale: string, currency: string, amount: number) {
	try {
		return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
	} catch {
		return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
	}
}
