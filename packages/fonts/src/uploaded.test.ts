import { describe, expect, it } from "vite-plus/test";
import { parseUploadedFontUrl, readFontFile, sanitizeFontFamily } from "./uploaded";

type FontOptions = {
	signature?: number | string;
	names?: { id: number; text: string; platform?: number }[];
	weightClass?: number;
	fsType?: number;
	fsSelection?: number;
	macStyle?: number;
};

const utf16 = (text: string) => [...text].flatMap((char) => [char.charCodeAt(0) >> 8, char.charCodeAt(0) & 0xff]);

/** A minimal sfnt with just the tables `readFontFile` reads. */
function makeFont({
	signature = 0x00010000,
	names = [{ id: 1, text: "Brand Sans" }],
	weightClass = 400,
	fsType = 0,
	fsSelection = 0,
	macStyle = 0,
}: FontOptions = {}) {
	const strings = names.map((name) =>
		name.platform === 1 ? [...name.text].map((char) => char.charCodeAt(0)) : utf16(name.text),
	);
	const nameTable = new Uint8Array(6 + names.length * 12 + strings.reduce((sum, bytes) => sum + bytes.length, 0));
	const nameView = new DataView(nameTable.buffer);
	nameView.setUint16(2, names.length);
	nameView.setUint16(4, 6 + names.length * 12);
	let stringOffset = 0;
	names.forEach((name, index) => {
		const record = 6 + index * 12;
		const bytes = strings[index] ?? [];
		nameView.setUint16(record, name.platform ?? 3);
		nameView.setUint16(record + 2, name.platform === 1 ? 0 : 1);
		nameView.setUint16(record + 4, name.platform === 1 ? 0 : 0x409);
		nameView.setUint16(record + 6, name.id);
		nameView.setUint16(record + 8, bytes.length);
		nameView.setUint16(record + 10, stringOffset);
		nameTable.set(bytes, 6 + names.length * 12 + stringOffset);
		stringOffset += bytes.length;
	});

	const os2 = new Uint8Array(96);
	const os2View = new DataView(os2.buffer);
	os2View.setUint16(4, weightClass);
	os2View.setUint16(8, fsType);
	os2View.setUint16(62, fsSelection);

	const head = new Uint8Array(54);
	new DataView(head.buffer).setUint16(44, macStyle);

	const tables: [string, Uint8Array][] = [
		["OS/2", os2],
		["head", head],
		["name", nameTable],
	];
	const headerLength = 12 + tables.length * 16;
	const bytes = new Uint8Array(headerLength + tables.reduce((sum, [, table]) => sum + table.length, 0));
	const view = new DataView(bytes.buffer);
	if (typeof signature === "number") view.setUint32(0, signature);
	else
		bytes.set(
			[...signature].map((char) => char.charCodeAt(0)),
			0,
		);
	view.setUint16(4, tables.length);
	let offset = headerLength;
	tables.forEach(([name, table], index) => {
		const record = 12 + index * 16;
		bytes.set(
			[...name].map((char) => char.charCodeAt(0)),
			record,
		);
		view.setUint32(record + 8, offset);
		view.setUint32(record + 12, table.length);
		bytes.set(table, offset);
		offset += table.length;
	});
	return bytes;
}

describe("readFontFile", () => {
	it("reads the family, weight and style of a TrueType font", () => {
		expect(readFontFile(makeFont({ weightClass: 700 }))).toEqual({
			ok: true,
			font: { family: "Brand Sans", weight: "700", italic: false, format: "ttf" },
		});
	});

	it("prefers the typographic family over the legacy one", () => {
		const font = makeFont({
			signature: "OTTO",
			names: [
				{ id: 1, text: "Brand Sans SemiBold" },
				{ id: 16, text: "Brand Sans" },
				{ id: 2, text: "Italic" },
			],
			weightClass: 600,
		});
		expect(readFontFile(font)).toEqual({
			ok: true,
			font: { family: "Brand Sans", weight: "600", italic: true, format: "otf" },
		});
	});

	it("drops weight and style words from a legacy family name", () => {
		const legacy = (text: string) => readFontFile(makeFont({ names: [{ id: 1, text }], weightClass: 600 }));
		expect(legacy("Plex Serif SemiBold")).toMatchObject({ font: { family: "Plex Serif", weight: "600" } });
		expect(legacy("Fira Sans Condensed Medium Italic")).toMatchObject({ font: { family: "Fira Sans Condensed" } });
		expect(legacy("Bold")).toMatchObject({ font: { family: "Bold" } });
	});

	it("reads italic from the style flags and rounds odd weights", () => {
		expect(readFontFile(makeFont({ fsSelection: 1, weightClass: 350 }))).toMatchObject({
			font: { italic: true, weight: "400" },
		});
		expect(readFontFile(makeFont({ macStyle: 2 }))).toMatchObject({ font: { italic: true } });
		expect(readFontFile(makeFont({ weightClass: 7 }))).toMatchObject({ font: { weight: "700" } });
	});

	it("falls back to Mac Roman names", () => {
		expect(readFontFile(makeFont({ names: [{ id: 1, text: "Old Face", platform: 1 }] }))).toMatchObject({
			font: { family: "Old Face" },
		});
	});

	it("refuses fonts that forbid embedding", () => {
		expect(readFontFile(makeFont({ fsType: 0x0002 }))).toEqual({ ok: false, problem: "no-embedding" });
		expect(readFontFile(makeFont({ fsType: 0x0004 }))).toMatchObject({ ok: true });
		expect(readFontFile(makeFont({ fsType: 0x0008 }))).toMatchObject({ ok: true });
	});

	it("refuses web fonts, collections and other files", () => {
		expect(readFontFile(makeFont({ signature: "wOF2" }))).toEqual({ ok: false, problem: "unsupported-format" });
		expect(readFontFile(makeFont({ signature: "ttcf" }))).toEqual({ ok: false, problem: "unsupported-format" });
		expect(readFontFile(new TextEncoder().encode("<html>not a font</html>"))).toEqual({
			ok: false,
			problem: "invalid",
		});
		expect(readFontFile(makeFont({ names: [{ id: 4, text: "Full Name Only" }] }))).toEqual({
			ok: false,
			problem: "invalid",
		});
		expect(readFontFile(makeFont().subarray(0, 40))).toEqual({ ok: false, problem: "invalid" });
	});
});

it("sanitizes family names for CSS and the PDF engine", () => {
	expect(sanitizeFontFamily('  Brand\u0000 "Sans";{}  ')).toBe("Brand Sans");
	expect(sanitizeFontFamily("x".repeat(80))).toHaveLength(64);
});

describe("parseUploadedFontUrl", () => {
	const url = "https://rezumi.app/api/uploads/user_1-a/fonts/0b6c3f4e-1d2a-4f8e-9c1b-7a5d2e3f4a5b.ttf";

	it("accepts the app's own font uploads", () => {
		expect(parseUploadedFontUrl(url)).toEqual({
			userId: "user_1-a",
			key: "uploads/user_1-a/fonts/0b6c3f4e-1d2a-4f8e-9c1b-7a5d2e3f4a5b.ttf",
		});
		expect(parseUploadedFontUrl(url, "https://rezumi.app")).not.toBeNull();
	});

	it.each([
		["another origin", "https://evil.example/api/uploads/u/fonts/a.ttf", "https://rezumi.app"],
		["a picture", "https://rezumi.app/api/uploads/u/pictures/a.jpeg", undefined],
		["path traversal", "https://rezumi.app/api/uploads/u/fonts/../pictures/a.ttf", undefined],
		["a query string", `${url}?x=1`, undefined],
		["credentials", "https://a:b@rezumi.app/api/uploads/u/fonts/a.ttf", undefined],
		["another scheme", "file:///api/uploads/u/fonts/a.ttf", undefined],
		["not a URL", "Brand Sans", undefined],
	])("refuses %s", (_, source, origin) => {
		expect(parseUploadedFontUrl(source, origin)).toBeNull();
	});
});
