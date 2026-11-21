import { parseAmount } from "./amount";

describe("parseAmount", () => {
	const formatToParts = Intl.NumberFormat.prototype.formatToParts;
	// Hermes on iOS has no formatToParts: the separators come from the formatted string.
	beforeAll(() => {
		(Intl.NumberFormat.prototype as { formatToParts?: unknown }).formatToParts = undefined;
	});
	afterAll(() => {
		Intl.NumberFormat.prototype.formatToParts = formatToParts;
	});

	it("reads amounts in the locale's notation", () => {
		expect(parseAmount("12,345.5", "en-US")).toBe(12345.5);
		expect(parseAmount("12.345,5", "id-ID")).toBe(12345.5);
		expect(parseAmount("12.345,5", "de-DE")).toBe(12345.5);
		expect(parseAmount("9000", "en-US")).toBe(9000);
	});

	it("rejects notation that would change the value and keeps empty as null", () => {
		expect(parseAmount("", "en-US")).toBeNull();
		expect(parseAmount("12,34,5", "en-US")).toBeUndefined();
		expect(parseAmount("1.2.3", "en-US")).toBeUndefined();
	});
});
