import { describe, expect, it } from "vite-plus/test";
import { businessCardAddress, businessCardPrintSheet, cardFileName, CARDS_PER_SHEET } from "./qr";

describe("the business card's address", () => {
	it("tags the QR with utm_source=qr and prints the address bare", () => {
		expect(businessCardAddress("https://rezumi.app/nadia")).toEqual({
			qr: "https://rezumi.app/nadia?utm_source=qr",
			shown: "rezumi.app/nadia",
		});
	});

	it("uses the person's own domain at its root", () => {
		expect(businessCardAddress("https://nadia.dev")).toEqual({
			qr: "https://nadia.dev/?utm_source=qr",
			shown: "nadia.dev",
		});
	});

	it("drops whatever query or hash the page address had", () => {
		expect(businessCardAddress("http://127.0.0.1:3260/nadia?x=1#work").qr).toBe(
			"http://127.0.0.1:3260/nadia?utm_source=qr",
		);
	});
});

describe("the printable sheet", () => {
	it("holds ten cards and escapes what the person typed", () => {
		const html = businessCardPrintSheet({
			name: "Nadia <script>",
			headline: 'PM & "lead"',
			qrSvg: "<svg></svg>",
			address: "rezumi.app/nadia",
			caption: "Scan to see my portfolio",
			title: "Business card",
			lang: "id-ID",
		});
		expect(html.match(/class="card"/g)).toHaveLength(CARDS_PER_SHEET);
		expect(html).not.toContain("<script>");
		expect(html).toContain("Nadia &#60;script&#62;");
		expect(html).toContain("PM &#38; &#34;lead&#34;");
		expect(html).toContain("size:A4");
	});

	it("names files after the username", () => {
		expect(cardFileName("Nadia.R", "png")).toBe("nadia-r-qr.png");
		expect(cardFileName("", "svg")).toBe("portfolio-qr.svg");
	});
});
