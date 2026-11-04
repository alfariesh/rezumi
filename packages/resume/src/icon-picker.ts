import type { IconName } from "@rezumi/schema/icons";
import { iconCategories } from "@rezumi/schema/icons";

/** One heading of an icon picker: a Hugeicons category, or "suggested". Apps translate the id. */
export type IconPickerGroup = { id: string; icons: readonly IconName[] };

/** Icons resumes reach for most: contact and personal details, section defaults, then the common networks. */
const SUGGESTED: readonly IconName[] = [
	"mail-01",
	"call-02",
	"location-01",
	"globe-02",
	"link-01",
	"at-sign",
	"whatsapp",
	"user",
	"birthday-cake",
	"calendar-03",
	"flag-01",
	"identity-card",
	"passport-01",
	"house-01",
	"wedding",
	"briefcase-01",
	"mortarboard-01",
	"university",
	"certificate-01",
	"award-01",
	"trophy",
	"medal-01",
	"translate",
	"language-skill",
	"source-code",
	"drafting-compass",
	"paint-brush-01",
	"library",
	"newspaper",
	"book-open-01",
	"hand-heart",
	"user-group",
	"mentoring",
	"presentation-01",
	"idea-01",
	"target-02",
	"rocket-01",
	"star",
	"football",
	"music-note-01",
	"camera-01",
	"travel-bag",
	"coffee-01",
	"linkedin-02",
	"github-01",
	"behance-01",
	"dribbble",
	"instagram",
	"new-twitter",
	"youtube",
	"medium",
];

// Work first, pastimes last. A category synced later and missing here follows, by name.
const ORDER = [
	"logos",
	"business",
	"education",
	"programming",
	"users",
	"award",
	"maps",
	"ai",
	"science-technology",
	"media",
	"image-camera",
	"presentation",
	"dashboard",
	"notes-tasks",
	"hierarchy",
	"git",
	"date-time",
	"legal",
	"security",
	"medical",
	"buildings",
	"games",
	"gym",
	"foods",
	"space",
	"islamic",
];

// Categories smaller than this hold a few general icons (mail, link, star): they join Suggested instead.
const MIN_GROUP_SIZE = 5;

const rank = (id: string) => {
	const index = ORDER.indexOf(id);
	return index === -1 ? ORDER.length : index;
};

const categories = Object.entries(iconCategories);

/** Every resume icon, by picker heading: Suggested, then each category. An icon can sit under two headings. */
export const iconPickerGroups: readonly IconPickerGroup[] = [
	{
		id: "suggested",
		icons: [
			...new Set([
				...SUGGESTED,
				...categories.filter(([, icons]) => icons.length < MIN_GROUP_SIZE).flatMap(([, icons]) => icons),
			]),
		],
	},
	...categories
		.filter(([, icons]) => icons.length >= MIN_GROUP_SIZE)
		.toSorted(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
		.map(([id, icons]) => ({ id, icons })),
];

/**
 * Words people type for an icon, in English and Indonesian, and the parts of icon names they mean. Icon names are
 * English and literal ("mortarboard-01"), so "education" or "pendidikan" would otherwise find little.
 */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
	email: ["mail"],
	phone: ["call", "whatsapp"],
	telephone: ["call"],
	mobile: ["call", "whatsapp"],
	address: ["location", "house", "map"],
	website: ["globe", "web", "link"],
	home: ["house"],
	job: ["briefcase", "work", "job"],
	work: ["briefcase", "work"],
	experience: ["briefcase", "work-history"],
	education: ["mortarboard", "school", "university", "graduat"],
	degree: ["mortarboard", "graduat"],
	college: ["university", "mortarboard"],
	certification: ["certificate"],
	prize: ["award", "trophy", "medal"],
	achievement: ["award", "trophy", "medal"],
	language: ["translat", "language"],
	skill: ["star", "skill"],
	birth: ["birthday", "cake"],
	nationality: ["flag", "passport"],
	married: ["wedding"],
	volunteer: ["hand-heart", "charity"],
	hobby: ["football", "music", "camera", "game"],
	interest: ["football", "music", "camera", "game"],
	photo: ["camera", "image"],
	design: ["paint", "pen", "design", "drafting"],
	developer: ["code", "developer", "programming"],
	publication: ["library", "newspaper", "book"],
	project: ["drafting", "folder", "project"],
	finance: ["money", "bank", "chart"],
	health: ["medical", "health", "hospital", "stethoscope"],
	travel: ["travel", "plane", "map", "globe"],
	sport: ["football", "sport", "workout", "gym"],
	religion: ["mosque", "church", "pray"],
	surel: ["mail"],
	telepon: ["call", "whatsapp"],
	ponsel: ["call", "whatsapp"],
	alamat: ["location", "house", "map"],
	lokasi: ["location", "map"],
	rumah: ["house"],
	situs: ["globe", "web", "link"],
	tautan: ["link"],
	kerja: ["briefcase", "work"],
	pekerjaan: ["briefcase", "work"],
	pengalaman: ["briefcase", "work-history"],
	pendidikan: ["mortarboard", "school", "university", "graduat"],
	sekolah: ["school", "mortarboard"],
	kuliah: ["university", "mortarboard"],
	kampus: ["university"],
	sertifikat: ["certificate"],
	penghargaan: ["award", "trophy", "medal"],
	prestasi: ["award", "trophy", "medal"],
	bahasa: ["translat", "language"],
	keahlian: ["star", "skill"],
	lahir: ["birthday", "cake"],
	tanggal: ["calendar"],
	kewarganegaraan: ["flag", "passport"],
	negara: ["flag", "globe"],
	menikah: ["wedding"],
	relawan: ["hand-heart", "charity"],
	hobi: ["football", "music", "camera", "game"],
	minat: ["football", "music", "camera", "game"],
	musik: ["music"],
	foto: ["camera", "image"],
	desain: ["paint", "pen", "design", "drafting"],
	kode: ["code"],
	publikasi: ["library", "newspaper", "book"],
	buku: ["book"],
	proyek: ["drafting", "folder", "project"],
	uang: ["money", "bank", "coin"],
	keuangan: ["money", "bank", "chart"],
	kesehatan: ["medical", "health", "hospital", "stethoscope"],
	perjalanan: ["travel", "plane", "map"],
	olahraga: ["football", "sport", "workout", "gym"],
	agama: ["mosque", "church", "pray"],
};

// Where each icon first shows in the picker, so equal matches keep the picker's order (Suggested first).
const position = new Map<IconName, number>();
for (const icon of iconPickerGroups.flatMap((group) => group.icons))
	if (!position.has(icon)) position.set(icon, position.size);

const groupsOf = new Map<IconName, string[]>();
for (const group of iconPickerGroups)
	for (const icon of group.icons) groupsOf.set(icon, [...(groupsOf.get(icon) ?? []), group.id]);

const synonymsOf = (term: string) =>
	Object.entries(SYNONYMS)
		.filter(([word]) => word === term || (term.length >= 3 && word.startsWith(term)))
		.flatMap(([, parts]) => parts);

type IconSearchOptions = {
	/** Only icons under this heading ("suggested", a category); all icons when missing. */
	group?: string | undefined;
	/** The headings' names as the app shows them, so typing "Pendidikan" finds that category's icons. */
	labels?: Readonly<Partial<Record<string, string>>> | undefined;
};

/**
 * Icons whose name matches every word typed, best first: the word as a whole part of the name ("mail" → mail-01),
 * then as its start or inside it, then through a synonym ("email", "surel") and last through the icon's heading.
 * An empty query lists the icons in picker order.
 */
export function searchIcons(query: string, { group, labels = {} }: IconSearchOptions = {}): IconName[] {
	const scope = group
		? (iconPickerGroups.find((candidate) => candidate.id === group)?.icons ?? [])
		: [...position.keys()];
	const terms = query
		.toLowerCase()
		.split(/[\s,]+/)
		.filter(Boolean);
	if (terms.length === 0) return [...scope];

	const termSynonyms = terms.map(synonymsOf);
	const scored: { icon: IconName; score: number }[] = [];
	for (const icon of scope) {
		const parts = icon.split("-");
		const headings = (groupsOf.get(icon) ?? []).map((id) => `${id} ${labels[id] ?? ""}`.toLowerCase());
		let score = 0;
		for (const [index, term] of terms.entries()) {
			const termScore = parts.includes(term)
				? 6
				: icon.startsWith(term)
					? 5
					: parts.some((part) => part.startsWith(term))
						? 4
						: icon.includes(term)
							? 3
							: termSynonyms[index]?.some((part) => icon.includes(part))
								? 2
								: headings.some((heading) => heading.includes(term))
									? 1
									: 0;
			if (termScore === 0) {
				score = 0;
				break;
			}
			score += termScore;
		}
		if (score > 0) scored.push({ icon, score });
	}

	return scored
		.toSorted((a, b) => b.score - a.score || (position.get(a.icon) ?? 0) - (position.get(b.icon) ?? 0))
		.map(({ icon }) => icon);
}
