import type { PortfolioDataInput } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { createSampleResumeData } from "@rezumi/schema/resume/sample";

/**
 * The Lugas persona from the Phase 00 mockup: Nadia Rahmawati, a fictional payments product manager in Jakarta. Names,
 * companies, clients and testimonials are invented (`01-desain.md` section 14). Pictures are the mockup's own
 * drawings under `.agents/docs/plans/portfolio/mockups/img`.
 */
export const MOCKUP_IMAGES = new URL("../../.agents/docs/plans/portfolio/mockups/img/", import.meta.url);

/** A stored picture's key, in the shape the schema accepts, and the mockup file it stands for. */
export type PersonaFile = { key: string; file: string; width: number; height: number };

const USER = "persona-nadia";
const picture = (name: string, file: string, width = 1200, height = 900): PersonaFile => ({
	key: `uploads/${USER}/pictures/portfolio/${name}.png`,
	file,
	width,
	height,
});

export const PERSONA_FILES = {
	cover1: picture("cover-qr", "lugas-1.svg"),
	cover2: picture("cover-split", "lugas-2.svg"),
	cover3: picture("cover-merchant", "lugas-3.svg"),
	cover4: picture("cover-dashboard", "lugas-4.svg"),
	cover5: picture("cover-experiments", "lugas-5.svg"),
	cover6: picture("cover-courier", "lugas-6.svg"),
	gallery1: picture("gallery-1", "lugas-g1.svg"),
	gallery2: picture("gallery-2", "lugas-g2.svg"),
	gallery3: picture("gallery-3", "lugas-g3.svg"),
} satisfies Record<string, PersonaFile>;

const image = (file: PersonaFile, alt = "") => ({ key: file.key, width: file.width, height: file.height, alt });

export function personaResume(): ResumeData {
	const data = structuredClone(createSampleResumeData());
	data.metadata.page.locale = "id-ID";
	data.metadata.design.colors.primary = "rgba(31, 58, 104, 1)";
	data.basics = {
		...data.basics,
		name: "Nadia Rahmawati",
		headline: "Senior Product Manager · Payments",
		email: "nadia.rahmawati@email.com",
		phone: "+62 812 5550 1824",
		location: "Jakarta, Indonesia",
		website: { url: "https://nadiarahmawati.id", label: "nadiarahmawati.id" },
	};
	data.picture.url = "";
	data.picture.hidden = false;
	data.summary.content =
		"<p>Product manager dengan delapan tahun pengalaman di pembayaran digital, dari pendaftaran merchant hingga pembayaran QR.</p>";
	data.sections.experience.items = [
		{
			id: "exp-1",
			hidden: false,
			company: "Kilau Pay",
			position: "Senior Product Manager",
			location: "Jakarta",
			period: "Mar 2022 – Sekarang",
			website: { url: "", label: "", inlineLink: false },
			description:
				"<ul><li>Memimpin tim QR checkout berisi 11 engineer dan desainer; menaikkan tingkat keberhasilan pembayaran dari 91% menjadi 97,5% dalam empat kuartal.</li><li>Meluncurkan fitur patungan dan kartu tersimpan, kini 18% dari volume transaksi bulanan.</li></ul>",
			roles: [],
		},
		{
			id: "exp-2",
			hidden: false,
			company: "Kilau Pay",
			position: "Product Manager, Merchant Platform",
			location: "Jakarta",
			period: "Jan 2019 – Feb 2022",
			website: { url: "", label: "", inlineLink: false },
			description:
				"<ul><li>Memangkas waktu pendaftaran merchant dari lima hari menjadi kurang dari satu jam dengan verifikasi dokumen otomatis.</li></ul>",
			roles: [],
		},
		{
			id: "exp-3",
			hidden: false,
			company: "Rantai Logistik",
			position: "Associate Product Manager",
			location: "Bandung",
			period: "Jul 2016 – Des 2018",
			website: { url: "", label: "", inlineLink: false },
			description: "<ul><li>Merilis pelacakan kurir langsung untuk 1.200 pengemudi.</li></ul>",
			roles: [],
		},
	] as ResumeData["sections"]["experience"]["items"];
	data.sections.education.items = [
		{
			id: "edu-1",
			hidden: false,
			school: "Institut Teknologi Bandung",
			degree: "Sarjana Teknik",
			area: "Teknik Industri",
			grade: "IPK 3,71",
			location: "",
			period: "2012 – 2016",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["education"]["items"];
	data.sections.skills.items = [
		["sk-1", "Produk", ["Discovery", "Roadmapping", "Penetapan harga", "OKR"]],
		["sk-2", "Data", ["SQL", "A/B testing", "Amplitude", "Looker"]],
		["sk-3", "Eksekusi", ["Scrum", "Menulis spesifikasi", "Figma"]],
	].map(([id, name, keywords]) => ({
		id,
		hidden: false,
		icon: "",
		iconColor: "",
		name,
		proficiency: "",
		level: 0,
		keywords,
	})) as ResumeData["sections"]["skills"]["items"];
	data.sections.certifications.items = [
		{
			id: "cert-1",
			hidden: false,
			title: "Certified Scrum Product Owner",
			issuer: "Scrum Alliance",
			date: "2021",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
		{
			id: "cert-2",
			hidden: false,
			title: "Manajemen Risiko Pembayaran",
			issuer: "Akademi Pembayaran Nusantara",
			date: "2023",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		},
	] as ResumeData["sections"]["certifications"]["items"];
	data.sections.languages.items = [
		{ id: "lang-1", hidden: false, language: "Bahasa Indonesia", fluency: "Bahasa ibu", level: 5 },
		{ id: "lang-2", hidden: false, language: "Bahasa Inggris", fluency: "Profesional", level: 4 },
	] as ResumeData["sections"]["languages"]["items"];
	data.sections.profiles.items = [
		{
			id: "pro-1",
			hidden: false,
			icon: "linkedin-02",
			iconColor: "",
			network: "LinkedIn",
			username: "nadiarahmawati",
			website: { url: "https://www.linkedin.com/in/nadiarahmawati", label: "", inlineLink: false },
		},
	] as ResumeData["sections"]["profiles"]["items"];
	for (const key of ["projects", "awards", "publications", "volunteer", "interests", "references"] as const)
		data.sections[key].items = [];
	data.customSections = [];
	return data;
}

type WorkInput = NonNullable<NonNullable<PortfolioDataInput["works"]>["items"]>[number];
type BlockInput = NonNullable<WorkInput["blocks"]>[number];

const metric = (id: string, label: string, value: number | string, extra: Record<string, unknown> = {}) => ({
	id,
	label,
	value:
		typeof value === "number" ? { kind: "number" as const, number: value } : { kind: "text" as const, text: value },
	...extra,
});

/** Everything the portfolio adds on top of the resume: intro, works with blocks, services, testimonials, clients. */
export function personaPortfolio(): PortfolioDataInput {
	const work = (
		id: string,
		slug: string,
		title: string,
		summary: string,
		role: string,
		date: string,
		cover: PersonaFile,
		highlight: { id: string; label: string; value: number | string; extra?: Record<string, unknown> },
		blocks: unknown[] = [],
	): WorkInput => ({
		id,
		slug,
		title,
		summary,
		role,
		date,
		tags: [],
		cover: image(cover, `Sampul: ${title}`),
		highlightMetricId: highlight.id,
		// The highlighted metric's block follows the first text block, where a reader expects the result.
		blocks: [
			...blocks.slice(0, 1),
			{
				id: `${id}-m`,
				type: "metrics",
				items: [metric(highlight.id, highlight.label, highlight.value, highlight.extra)],
			},
			...blocks.slice(1),
		] as BlockInput[],
		featured: false,
		hidden: false,
	});
	return {
		theme: "lugas",
		hero: {
			greeting:
				"Saya membangun produk pembayaran yang dipakai jutaan orang setiap hari, dan memastikan setiap rilis bisa diukur.",
			showPicture: true,
			availability: { show: true, text: "Terbuka untuk peran Lead PM" },
			highlights: [
				metric("hl-1", "pengguna QR per bulan", 4_000_000, { format: "compact" }),
				metric("hl-2", "pembayaran berhasil", 97.5, { format: "percent" }),
				metric("hl-3", "uji A/B per tahun", 40, { suffix: "+" }),
			],
			buttons: [{ kind: "resume" }, { kind: "pdf" }, { kind: "contact" }],
		},
		about: {
			content:
				"<p><strong>Product manager dengan delapan tahun pengalaman di pembayaran digital</strong>, dari pendaftaran merchant hingga pembayaran QR yang dipakai 4 juta orang setiap bulan.</p><p>Saya mengubah riset dan data menjadi roadmap yang dipercaya tim engineering, lalu merilis dalam langkah kecil yang terukur. Di luar kantor, saya membimbing PM pemula dan menulis catatan produk setiap Jumat.</p>",
		},
		works: {
			items: [
				work(
					"w-qr",
					"qr-checkout",
					"QR checkout yang jarang gagal",
					"Menata ulang alur bayar QR untuk 4 juta pengguna: dari 91% menjadi 97,5% pembayaran berhasil dalam empat kuartal.",
					"Senior PM · tim 11 orang",
					"2022–2024",
					PERSONA_FILES.cover1,
					{
						id: "m-qr",
						label: "Pembayaran berhasil",
						value: 97.5,
						extra: {
							format: "percent",
							change: { direction: "up", text: "+6,5 poin", good: true },
							before: 91,
							series: [91, 92.4, 93.1, 95, 95.9, 97.2, 97.5],
							context: "4 kuartal setelah rilis",
						},
					},
					[
						{
							id: "w-qr-t",
							type: "text",
							html: "<h3>Masalah</h3><p>Satu dari sebelas pembayaran QR gagal di layar terakhir. Pengguna mencoba lagi, lalu menyerah dan membayar tunai.</p><h3>Peran saya</h3><ul><li>Memimpin discovery bersama 2 desainer dan 1 peneliti.</li><li>Menulis spesifikasi dan rencana eksperimen untuk 9 engineer.</li><li>Melaporkan hasil mingguan ke tim risiko dan direksi.</li></ul>",
						},
						{
							id: "w-qr-g",
							type: "images",
							layout: "grid",
							images: [
								{ ...image(PERSONA_FILES.gallery1, "Layar konfirmasi pembayaran"), caption: "Layar konfirmasi baru" },
								{ ...image(PERSONA_FILES.gallery2, "Peta titik gagal"), caption: "Peta titik gagal sebelum perbaikan" },
								{ ...image(PERSONA_FILES.gallery3, "Grafik keberhasilan") },
							],
						},
						{
							id: "w-qr-m2",
							type: "metrics",
							items: [
								metric("m-qr-2", "Waktu bayar rata-rata", 38, {
									suffix: " dtk",
									change: { direction: "down", text: "−42%", good: true },
									before: 66,
									series: [66, 61, 55, 49, 44, 40, 38],
								}),
								metric("m-qr-3", "Tiket bantuan soal QR", 1200, {
									format: "compact",
									suffix: "/bln",
									change: { direction: "down", text: "−58%", good: true },
									before: 2860,
								}),
							],
						},
					],
				),
				work(
					"w-split",
					"patungan",
					"Patungan dan kartu tersimpan",
					"Dua fitur yang kini menyumbang 18% volume transaksi bulanan.",
					"Senior PM",
					"2023",
					PERSONA_FILES.cover2,
					{ id: "m-split", label: "Volume transaksi", value: 18, extra: { format: "percent" } },
				),
				work(
					"w-merchant",
					"pendaftaran-merchant",
					"Pendaftaran merchant di bawah satu jam",
					"Verifikasi dokumen otomatis memangkas waktu daftar dari lima hari menjadi 52 menit.",
					"PM, Merchant Platform",
					"2020",
					PERSONA_FILES.cover3,
					{ id: "m-merchant", label: "Waktu daftar", value: "52 mnt" },
				),
				work(
					"w-dashboard",
					"dasbor-merchant",
					"Dasbor swalayan untuk merchant kecil",
					"Dasbor dua bahasa yang menumbuhkan merchant aktif dari 60 ribu menjadi 310 ribu.",
					"PM, Merchant Platform",
					"2019–2021",
					PERSONA_FILES.cover4,
					{ id: "m-dashboard", label: "Merchant aktif", value: 310_000, extra: { format: "compact" } },
				),
				work(
					"w-experiments",
					"ritme-eksperimen",
					"Ritme eksperimen mingguan",
					"Tinjauan bersama data science: lebih dari 40 uji A/B per tahun, semuanya dengan keputusan tertulis.",
					"Senior PM",
					"2022–kini",
					PERSONA_FILES.cover5,
					{ id: "m-experiments", label: "Uji A/B per tahun", value: 40, extra: { suffix: "+" } },
				),
				work(
					"w-courier",
					"pelacakan-kurir",
					"Pelacakan kurir langsung",
					"Peta kurir untuk 1.200 pengemudi; telepon “paket saya di mana” turun sepertiga.",
					"Associate PM · Rantai Logistik",
					"2017",
					PERSONA_FILES.cover6,
					{ id: "m-courier", label: "Telepon ke CS", value: -33, extra: { format: "percent" } },
				),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: "Audit alur pembayaran",
					description: "Saya menelusuri checkout-mu, menandai titik gagal, lalu memberi daftar perbaikan berurutan.",
					price: "Mulai Rp7,5 jt",
					cta: { kind: "whatsapp", label: "Tanya lewat WhatsApp" },
				},
				{
					id: "sv-2",
					title: "Mentoring PM",
					description: "Empat sesi 60 menit untuk PM 0–3 tahun: discovery, prioritas, dan menulis spesifikasi.",
					price: "Rp1,2 jt / sesi",
					cta: { kind: "contact", label: "Kirim pesan" },
				},
				{
					id: "sv-3",
					title: "Pembicara & workshop",
					description: "Topik: eksperimen produk, pembayaran digital, dan kerja PM bersama data.",
					cta: { kind: "contact", label: "Kirim pesan" },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote:
						"Nadia membuat rapat prioritas jadi singkat: datanya jelas, keputusannya tertulis, dan tim tahu alasannya.",
					name: "Damar Wicaksana",
					role: "Engineering Manager, Kilau Pay",
					consent: true,
				},
				{
					id: "ts-2",
					quote: "Spesifikasi dari Nadia paling jarang memicu pertanyaan ulang. Kami bisa langsung membangun.",
					name: "Sinta Halim",
					role: "Lead Designer, Kilau Pay",
					consent: true,
				},
				{
					id: "ts-3",
					quote: "Mentor yang sabar tapi tegas soal data. Setelah empat sesi, saya berani memimpin uji A/B pertama.",
					name: "Yoga Pratama",
					role: "Product Manager, Ladang Digital",
					consent: true,
				},
			],
		},
		clients: {
			items: ["Kilau Pay", "Rantai Logistik", "Ladang Digital", "Pasar Pagi", "Koperasi Arta", "Nusa Kurir"].map(
				(name, index) => ({ id: `cl-${index + 1}`, name }),
			),
		},
		custom: [
			{
				id: "notes",
				title: "Catatan produk",
				content:
					"<p>Setiap Jumat saya menulis satu pelajaran dari eksperimen minggu itu: apa yang diuji, apa yang gagal, dan keputusan yang diambil. Sudah 86 catatan sejak 2024.</p>",
				button: { kind: "link", label: "Baca catatannya", url: "https://nadiarahmawati.id/catatan" },
				hidden: false,
			},
		],
		location: {
			label: "Jakarta, Indonesia",
			workModes: ["hybrid", "remote"],
			relocate: false,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
			showMap: false,
		},
		contact: {
			email: true,
			phone: false,
			website: true,
			whatsapp: { show: true, number: "6281255501824" },
			form: false,
			profiles: true,
			note: "Sedang mencari PM untuk produk pembayaran? Mari ngobrol.",
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	};
}

/** The same person with almost nothing filled in: no photo, no pictures, no works, one sentence. */
export function minimalPortfolio(): PortfolioDataInput {
	return {
		theme: "lugas",
		basics: { picture: null },
		hero: { greeting: "Product manager pembayaran digital di Jakarta.", showPicture: false },
		about: { content: "" },
		works: { items: [] },
		sections: {
			order: [],
			hidden: ["profiles", "experience", "education", "skills", "certifications", "languages"],
			titles: {},
			hiddenItems: {},
		},
	};
}
