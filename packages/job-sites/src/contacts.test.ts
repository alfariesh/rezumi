import { describe, expect, it } from "vite-plus/test";
import { MAX_SUGGESTED_CONTACTS, suggestContacts } from "./contacts";

describe("suggestContacts", () => {
	it("finds emails and Indonesian numbers in the order they appear", () => {
		const text = "Kirim CV ke HR@Lumen.example atau WhatsApp 0812-3456-7890.\nTelp kantor: +62 21 5550 0100";
		expect(suggestContacts(text)).toEqual([
			{ type: "email", value: "hr@lumen.example" },
			{ type: "phone", value: "+6281234567890" },
			{ type: "phone", value: "+622155500100" },
		]);
	});

	it.each([
		["+62 812 3456 7890", "+6281234567890"],
		["62812.3456.7890", "+6281234567890"],
		["0857 1234 5678", "+6285712345678"],
		["https://wa.me/6281234567890", "+6281234567890"],
		["https://api.whatsapp.com/send?phone=6281234567890&text=hi", "+6281234567890"],
		["WhatsApp: +65 9123 4567", "+6591234567"],
	])("reads %s", (text, value) => {
		expect(suggestContacts(text)).toEqual([{ type: "phone", value }]);
	});

	it.each([
		["pay", "Gaji Rp 8.000.000 - Rp 12.000.000 per bulan"],
		["pay without a space", "Salary IDR8000000 to IDR 62.800.000"],
		["a date", "Lamar sebelum 2026-08-12, mulai 01/09/2026"],
		["a count", "Lebih dari 1200 karyawan di 18 kota, 3 tahun pengalaman"],
		["a picture name", "logo@2x.png"],
		["a plain long number without a label", "Ref 123456789012"],
	])("skips %s", (_, text) => {
		expect(suggestContacts(text)).toEqual([]);
	});

	it("keeps each contact once and at most five", () => {
		const emails = Array.from({ length: 8 }, (_, index) => `hr${index}@acme.example`).join(" ");
		expect(suggestContacts(`${emails} hr0@acme.example`)).toHaveLength(MAX_SUGGESTED_CONTACTS);
		expect(suggestContacts("0812 3456 7890 / +62 812-3456-7890")).toEqual([{ type: "phone", value: "+6281234567890" }]);
	});
});
