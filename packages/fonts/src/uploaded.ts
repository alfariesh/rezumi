import type { FontWeight } from "./index";

/** The largest font file a user may upload. Résumé faces are rarely over 1 MB; CJK faces are the exception. */
export const MAX_UPLOADED_FONT_BYTES = 8 * 1024 * 1024;
/** How many uploaded faces one document may carry. */
export const MAX_DOCUMENT_FONT_FACES = 24;

export type UploadedFontFormat = "ttf" | "otf";

export const UPLOADED_FONT_CONTENT_TYPES: Record<UploadedFontFormat, string> = {
	ttf: "font/ttf",
	otf: "font/otf",
};

export type FontFileInfo = { family: string; weight: FontWeight; italic: boolean; format: UploadedFontFormat };

export type FontFileProblem =
	/** WOFF, WOFF2 or a collection: the user should export a single TTF or OTF file. */
	| "unsupported-format"
	/** Not a font, or a font too damaged to read its name. */
	| "invalid"
	/** The font's licence flag forbids embedding it in documents. */
	| "no-embedding";

export type FontFileResult = { ok: true; font: FontFileInfo } | { ok: false; problem: FontFileProblem };

const tag = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));

function decodeUtf16(bytes: Uint8Array) {
	let text = "";
	for (let index = 0; index + 1 < bytes.length; index += 2)
		text += String.fromCharCode(((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0));
	return text;
}

/** Strips characters that would break CSS or the PDF engine's font lookup, and squeezes whitespace. */
export function sanitizeFontFamily(family: string) {
	return family
		.replace(/[\p{Cc}\p{Cf}"\\<>{};]/gu, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 64)
		.trim();
}

type Tables = Map<string, { offset: number; length: number }>;

function readTables(view: DataView, bytes: Uint8Array): Tables | null {
	const count = view.getUint16(4);
	if (count === 0 || count > 512 || 12 + count * 16 > bytes.length) return null;
	const tables: Tables = new Map();
	for (let index = 0; index < count; index++) {
		const record = 12 + index * 16;
		const offset = view.getUint32(record + 8);
		const length = view.getUint32(record + 12);
		if (offset + length > bytes.length) return null;
		tables.set(tag(bytes, record), { offset, length });
	}
	return tables;
}

// Windows Unicode names first (US English preferred), then Unicode-platform names, then Mac Roman.
function readName(view: DataView, bytes: Uint8Array, table: { offset: number; length: number }, nameIds: number[]) {
	if (table.length < 6) return null;
	const count = view.getUint16(table.offset + 2);
	const storage = table.offset + view.getUint16(table.offset + 4);
	if (table.offset + 6 + count * 12 > table.offset + table.length) return null;

	let best: { score: number; text: string } | null = null;
	for (let index = 0; index < count; index++) {
		const record = table.offset + 6 + index * 12;
		const platform = view.getUint16(record);
		const encoding = view.getUint16(record + 2);
		const language = view.getUint16(record + 4);
		const nameId = view.getUint16(record + 6);
		const length = view.getUint16(record + 8);
		const start = storage + view.getUint16(record + 10);
		const rank = nameIds.indexOf(nameId);
		if (rank === -1 || start + length > bytes.length) continue;

		const raw = bytes.subarray(start, start + length);
		let platformScore: number;
		let text: string;
		if (platform === 3 && (encoding === 1 || encoding === 10)) {
			platformScore = language === 0x409 ? 0 : 1;
			text = decodeUtf16(raw);
		} else if (platform === 0) {
			platformScore = 2;
			text = decodeUtf16(raw);
		} else if (platform === 1 && encoding === 0) {
			platformScore = 3;
			text = String.fromCharCode(...raw);
		} else continue;

		const family = sanitizeFontFamily(text);
		const score = rank * 10 + platformScore;
		if (family && (!best || score < best.score)) best = { score, text: family };
	}
	return best?.text ?? null;
}

const styleWords =
	/(?:\s+(?:thin|hairline|extra[- ]?light|ultra[- ]?light|light|book|regular|normal|medium|semi[- ]?bold|demi[- ]?bold|bold|extra[- ]?bold|ultra[- ]?bold|black|heavy|italic|oblique))+$/i;

/** A legacy family name without trailing weight and style words; the whole name when nothing else is left. */
function stripStyleWords(family: string | null) {
	if (!family) return null;
	return family.replace(styleWords, "").trim() || family;
}

function toFontWeight(weightClass: number): FontWeight {
	// Some old fonts store 1–9 instead of 100–900.
	const weight = weightClass > 0 && weightClass < 10 ? weightClass * 100 : weightClass;
	const rounded = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
	return String(rounded) as FontWeight;
}

/**
 * Reads what an uploaded font file is: its family name (the typographic family when the font names one), weight,
 * whether it's italic, and its format. Only single TrueType or OpenType files are accepted; fonts whose licence flag
 * says "restricted licence embedding" are refused because they may not be embedded in a PDF.
 */
export function readFontFile(bytes: Uint8Array): FontFileResult {
	if (bytes.length < 12) return { ok: false, problem: "invalid" };
	const signature = tag(bytes, 0);
	if (["wOFF", "wOF2", "ttcf"].includes(signature)) return { ok: false, problem: "unsupported-format" };

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const format: UploadedFontFormat | null =
		view.getUint32(0) === 0x00010000 || signature === "true" ? "ttf" : signature === "OTTO" ? "otf" : null;
	if (!format) return { ok: false, problem: "invalid" };

	const tables = readTables(view, bytes);
	const name = tables?.get("name");
	if (!tables || !name) return { ok: false, problem: "invalid" };
	// Without a typographic family (name 16), older fonts put the weight in the family ("Plex Serif SemiBold").
	const family = readName(view, bytes, name, [16]) ?? stripStyleWords(readName(view, bytes, name, [1]));
	if (!family) return { ok: false, problem: "invalid" };
	const subfamily = readName(view, bytes, name, [17, 2]) ?? "";

	let weight: FontWeight = /bold/i.test(subfamily) ? "700" : "400";
	let italic = /italic|oblique/i.test(subfamily);
	const os2 = tables.get("OS/2");
	if (os2 && os2.length >= 64) {
		weight = toFontWeight(view.getUint16(os2.offset + 4));
		const fsType = view.getUint16(os2.offset + 8);
		// Bit 1 alone means "restricted licence embedding": the font must not leave the machine it's installed on.
		if ((fsType & 0x000f) === 0x0002) return { ok: false, problem: "no-embedding" };
		if (view.getUint16(os2.offset + 62) & 0x0001) italic = true;
	}
	const head = tables.get("head");
	if (head && head.length >= 46 && view.getUint16(head.offset + 44) & 0x0002) italic = true;

	return { ok: true, font: { family, weight, italic, format } };
}

type UploadedFace = { family: string; weight: FontWeight; italic: boolean };

/** The families a document's uploaded faces belong to, in upload order. */
export const uploadedFontFamilies = (faces: readonly UploadedFace[] | undefined) => [
	...new Set((faces ?? []).map((face) => face.family)),
];

/** The weights uploaded for `family`, lightest first: its upright faces, or its italic ones when it has only those. */
export function uploadedFontWeights(faces: readonly UploadedFace[] | undefined, family: string): FontWeight[] | null {
	const own = (faces ?? []).filter((face) => face.family === family);
	if (own.length === 0) return null;
	const upright = own.filter((face) => !face.italic);
	const weights = new Set((upright.length > 0 ? upright : own).map((face) => face.weight));
	return [...weights].sort((a, b) => Number(a) - Number(b));
}

const uploadedFontPath = /^\/api\/uploads\/([A-Za-z0-9_-]+)\/fonts\/([A-Za-z0-9-]+)\.(ttf|otf)$/;

/** Where an uploaded font file is stored. */
export const uploadedFontKey = (userId: string, id: string, format: UploadedFontFormat) =>
	`uploads/${userId}/fonts/${id}.${format}`;

/**
 * The owner and storage key of a font file uploaded to Rezumi, or null for any other address. Documents may only
 * draw with fonts at these addresses, so a renderer never fetches a URL a user typed. Pass `origin` to also require
 * the app's own origin (the server does; browsers and the app trust the address the server handed out).
 */
export function parseUploadedFontUrl(source: string, origin?: string): { userId: string; key: string } | null {
	let url: URL;
	try {
		url = new URL(source);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) return null;
	if (origin !== undefined && url.origin !== new URL(origin).origin) return null;
	const match = uploadedFontPath.exec(url.pathname);
	if (!match) return null;
	const [, userId, id, format] = match as unknown as [string, string, string, UploadedFontFormat];
	return { userId, key: uploadedFontKey(userId, id, format) };
}
