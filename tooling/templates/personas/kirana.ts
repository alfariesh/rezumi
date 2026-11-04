import type { Persona } from "./persona";

/** Kirana, the soft left sidebar: a brand and visual designer at a studio in Bali. */
export const kirana: Persona = {
	photo: true,
	name: "Citra Maharani",
	headline: ["Brand & Visual Designer", "Brand & Visual Designer"],
	email: "citra.maharani@email.com",
	phone: "+62 817 5550 6125",
	location: "Denpasar, Bali",
	website: { url: "https://citramaharani.design", label: "citramaharani.design" },
	details: [
		{ icon: "behance-02", text: "behance.net/citramaharani", link: "https://behance.net/citramaharani" },
		{ icon: "dribbble", text: "dribbble.com/citramaharani", link: "https://dribbble.com/citramaharani" },
	],
	summary: [
		"**Brand designer with nine years shaping identities for hospitality, food and lifestyle brands.** I turn a brief into a clear visual system, from logo and type to packaging and signage, and keep it consistent as a brand grows. My work for Balinese makers has won two national design awards.",
		"**Brand designer dengan sembilan tahun pengalaman membangun identitas untuk merek hospitality, kuliner dan gaya hidup.** Saya mengubah brief menjadi sistem visual yang jelas, dari logo dan tipografi hingga kemasan dan signage, serta menjaganya tetap konsisten saat merek berkembang. Karya saya untuk perajin Bali meraih dua penghargaan desain nasional.",
	],
	experience: [
		{
			company: "Studio Lontar Kreatif",
			position: "Senior Brand Designer",
			location: "Denpasar",
			period: ["Mar 2022 – Present", "Mar 2022 – Sekarang"],
			bullets: [
				[
					"Lead identity projects for 25+ clients, from boutique villas to a coffee chain with 40 outlets.",
					"Memimpin proyek identitas untuk lebih dari 25 klien, dari vila butik hingga jaringan kedai kopi dengan 40 gerai.",
				],
				[
					"Rebranded a Balinese skincare label; stockists grew from 12 to 85 in a year.",
					"Rebranding skincare lokal Bali; toko penjualnya naik dari 12 ke 85 dalam setahun.",
				],
				[
					"Built the studio’s brand-guideline template; handover fell from three weeks to one.",
					"Menyusun templat panduan merek studio; serah terima dari 3 minggu jadi 1 minggu.",
				],
			],
		},
		{
			company: "Ombak Digital",
			position: "Visual Designer",
			location: "Jakarta",
			period: ["Jul 2019 – Feb 2022", "Jul 2019 – Feb 2022"],
			bullets: [
				[
					"Designed campaigns and social content for 10 retail and F&B brands; one campaign reached 6 million people.",
					"Merancang kampanye dan konten media sosial untuk 10 merek ritel dan F&B; salah satu kampanye menjangkau 6 juta orang.",
				],
				[
					"Created a shared illustration library that halved monthly content production time.",
					"Membuat pustaka ilustrasi bersama; waktu produksi konten bulanan turun separuh.",
				],
			],
		},
		{
			company: "Rumah Kopi Senja",
			position: ["Graphic Designer", "Graphic Designer"],
			location: "Bandung",
			period: ["Aug 2017 – Jun 2019", "Agu 2017 – Jun 2019"],
			bullets: [
				[
					"Designed packaging for 18 coffee products and menus for 6 cafés, in-house.",
					"Merancang kemasan 18 produk kopi dan menu 6 kafe sebagai desainer in-house.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Tenun Lestari identity", "Identitas Tenun Lestari"],
			period: "2024",
			description: [
				"Identity, packaging and pop-up store for a weaving cooperative of 120 artisans; sales doubled at its first Jakarta fair.",
				"Identitas, kemasan dan toko pop-up untuk koperasi tenun beranggotakan 120 perajin; penjualan naik dua kali lipat di pameran pertamanya di Jakarta.",
			],
		},
		{
			name: ["Ubud Food Walk wayfinding", "Penunjuk arah Ubud Food Walk"],
			period: "2023",
			description: [
				"Map, signage and icon set for a 3 km culinary trail used by about 9,000 visitors a month.",
				"Peta, signage dan set ikon untuk jalur kuliner sepanjang 3 km yang dilalui sekitar 9.000 pengunjung per bulan.",
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Design", "Sarjana Desain (S.Ds.)"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.68", "IPK 3,68"],
			location: "Bandung",
			period: "2013 – 2017",
		},
	],
	awards: [
		{
			title: ["Gold, Packaging Design", "Emas, Desain Kemasan"],
			awarder: "Penghargaan Desain Nusantara",
			date: "2024",
		},
		{
			title: ["Best Brand Identity, SME category", "Identitas Merek Terbaik, kategori UMKM"],
			awarder: "Festival Grafis Indonesia",
			date: "2023",
		},
	],
	skills: [
		{
			name: ["Brand", "Merek"],
			keywords: [
				["Identity systems", "Sistem identitas"],
				["Brand guidelines", "Panduan merek"],
				["Art direction", "Art direction"],
			],
		},
		{
			name: ["Design", "Desain"],
			keywords: [
				["Packaging", "Kemasan"],
				["Typography", "Tipografi"],
				["Illustration", "Ilustrasi"],
				["Wayfinding", "Signage"],
			],
		},
		{
			name: ["Production", "Produksi"],
			keywords: [["Print production", "Produksi cetak"], ["Colour management", "Manajemen warna"], "Mockup"],
		},
		{
			name: ["Tools", "Perangkat"],
			keywords: ["Adobe Illustrator", "Photoshop", "InDesign", "Figma", "After Effects"],
		},
	],
	certifications: [
		{ title: "Adobe Certified Professional: Illustrator", issuer: "Adobe", date: "2021" },
		{
			title: ["Brand Strategy Fundamentals", "Dasar-Dasar Strategi Merek"],
			issuer: "Sekolah Merek Nusantara",
			date: "2023",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
		{ language: ["Balinese", "Bahasa Bali"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	interests: [
		{ name: ["Hand lettering", "Hand lettering"] },
		{ name: ["Traditional textiles", "Kain tradisional"] },
		{ name: ["Ceramics", "Keramik"] },
	],
	layout: {
		main: ["summary", "experience", "projects", "education", "awards"],
		sidebar: ["skills", "certifications", "languages", "interests"],
	},
};
