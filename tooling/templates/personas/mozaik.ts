import type { Persona } from "./persona";

/** Mozaik, the bento cards: a brand and visual designer at an independent studio in Bandung. */
export const mozaik: Persona = {
	name: "Kevin Tanujaya",
	headline: [
		"Brand & Visual Designer · Identity, Packaging, Motion",
		"Brand & Visual Designer · Identitas, Kemasan, Motion",
	],
	email: "kevin.tanujaya@email.com",
	phone: "+62 822 5553 1907",
	location: ["Bandung, West Java", "Bandung, Jawa Barat"],
	website: { url: "https://kevintanujaya.design", label: "kevintanujaya.design" },
	details: [
		{ icon: "behance-02", text: "behance.net/kevintanujaya", link: "https://behance.net/kevintanujaya" },
		{ icon: "instagram", text: "@kevin.tanujaya.design", link: "https://instagram.com/kevin.tanujaya.design" },
	],
	summary: [
		"**Brand and visual designer with seven years building identity systems** for food, retail and tech brands across West Java. I take a brand from strategy workshop to logo, type, packaging and short motion pieces, then hand over guidelines that in-house teams actually follow.",
		"**Brand & visual designer dengan tujuh tahun pengalaman membangun sistem identitas** untuk merek kuliner, ritel dan teknologi di Jawa Barat. Saya membawa merek dari lokakarya strategi hingga logo, tipografi, kemasan dan motion singkat, lalu menyerahkan panduan merek yang mudah diikuti tim internal.",
	],
	experience: [
		{
			company: "Kalam Rupa",
			position: "Senior Brand Designer",
			location: "Bandung",
			period: ["Apr 2022 – Present", "Apr 2022 – Sekarang"],
			bullets: [
				[
					"Lead identity work for 18 clients, from a local coffee roaster to a logistics app with 2 million users.",
					"Memimpin proyek identitas untuk 18 klien, dari roastery kopi lokal hingga aplikasi logistik dengan 2 juta pengguna.",
				],
				[
					"Redesigned packaging for a snack brand’s 22 products; shelf sell-through rose 35% in six months.",
					"Mendesain ulang kemasan 22 produk merek camilan; penjualan di rak naik 35% dalam enam bulan.",
				],
			],
		},
		{
			company: "PT Priangan Rasa Sentosa",
			position: ["In-house Graphic Designer", "Desainer Grafis Internal"],
			location: "Bandung",
			period: "Jan 2020 – Mar 2022",
			bullets: [
				[
					"Designed packaging and in-store material for 40 SKUs sold in 1,500 minimarkets.",
					"Merancang kemasan dan materi promosi toko untuk 40 SKU yang dijual di 1.500 minimarket.",
				],
				[
					"Produced 120 short motion ads a year for Instagram and TikTok, saving Rp 420 million in agency fees.",
					"Membuat 120 iklan motion pendek per tahun untuk Instagram dan TikTok, menghemat biaya agensi Rp 420 juta.",
				],
			],
		},
		{
			company: "Lajur Kreatif",
			position: ["Junior Designer", "Desainer Junior"],
			location: "Bandung",
			period: ["Aug 2018 – Dec 2019", "Agu 2018 – Des 2019"],
			bullets: [
				[
					"Drew logos, menus and signage for 30+ cafés and shops; four became the agency’s portfolio case studies.",
					"Membuat logo, menu dan signage untuk lebih dari 30 kafe dan toko; empat di antaranya menjadi studi kasus agensi.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Kopi Lereng Malabar rebrand", "Rebranding Kopi Lereng Malabar"],
			period: "2024",
			description: [
				"Identity, bag system and animated logo for a roaster with 9 outlets; online sales doubled in a year.",
				"Identitas, sistem kemasan dan logo animasi untuk roastery dengan 9 gerai; penjualan daring naik dua kali lipat.",
			],
		},
		{
			name: ["Bandung Craft Fair visual system", "Sistem visual Pekan Kriya Bandung"],
			period: "2023",
			description: [
				"Posters, 60 wayfinding signs and motion stings for a three-day fair with 25,000 visitors.",
				"Poster, 60 papan penunjuk arah dan motion pendek untuk pameran tiga hari dengan 25.000 pengunjung.",
			],
		},
	],
	education: [
		{
			school: "Universitas Kristen Maranatha",
			degree: ["Bachelor of Design", "Sarjana Desain (S.Ds.)"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.66", "IPK 3,66"],
			location: "Bandung",
			period: "2014 – 2018",
		},
	],
	skills: [
		{
			name: ["Identity", "Identitas"],
			keywords: [
				["Logo design", "Desain logo"],
				["Type systems", "Sistem tipografi"],
				["Brand guidelines", "Panduan merek"],
			],
		},
		{
			name: ["Packaging", "Kemasan"],
			keywords: ["Dielines", ["Print production", "Produksi cetak"], "Mockups"],
		},
		{
			name: "Motion",
			keywords: ["After Effects", ["Logo animation", "Animasi logo"], "Lottie"],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Figma", "Illustrator", "InDesign", "Photoshop"] },
	],
	awards: [
		{
			title: ["Best Identity System", "Sistem Identitas Terbaik"],
			awarder: "Pekan Rupa Bandung",
			date: "2024",
		},
		{
			title: ["Gold, Food Packaging", "Emas, Kemasan Pangan"],
			awarder: ["Priangan Packaging Awards", "Anugerah Kemasan Priangan"],
			date: "2023",
		},
	],
	columns: { projects: 2, skills: 2, awards: 2 },
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards"],
	},
};
