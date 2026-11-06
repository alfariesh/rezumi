import type { Persona } from "./persona";

/** Sekar: a textile designer and batik researcher who lectures at a design school in Surakarta. */
export const sekar: Persona = {
	name: "Kinanti Prameswari",
	headline: ["Textile Designer & Batik Researcher", "Desainer Tekstil & Peneliti Batik"],
	email: "kinanti.prameswari@email.com",
	phone: "+62 856 5551 3827",
	location: "Surakarta, Indonesia",
	website: { url: "https://kinanti.studio", label: "kinanti.studio" },
	details: [
		{ icon: "instagram", text: "@kinanti.wastra", link: "https://instagram.com/kinanti.wastra" },
		{ icon: "behance-02", text: "behance.net/kinantiprameswari", link: "https://behance.net/kinantiprameswari" },
	],
	summary: [
		"**Textile designer who brings natural-dye batik into contemporary collections.** For ten years I have worked with batik makers in Solo, Lasem and Pekalongan, designing motifs and colourways for fashion and interior brands while documenting the techniques behind them. I also teach textile design and research plant dyes.",
		"**Desainer tekstil yang membawa batik pewarna alam ke dalam koleksi kontemporer.** Selama sepuluh tahun saya bekerja bersama perajin batik di Solo, Lasem dan Pekalongan, merancang motif dan palet warna untuk merek fesyen dan interior sekaligus mendokumentasikan teknik di baliknya. Saya juga mengajar desain tekstil dan meneliti pewarna nabati.",
	],
	experience: [
		{
			company: "Wastra Laras Studio",
			position: ["Founder & Lead Textile Designer", "Pendiri & Lead Textile Designer"],
			location: "Surakarta",
			period: ["Jun 2021 – Present", "Jun 2021 – Sekarang"],
			bullets: [
				[
					"Design four collections a year with 22 batik artisans; studio revenue has tripled since 2022.",
					"Merancang empat koleksi per tahun bersama 22 perajin batik; pendapatan studio naik tiga kali lipat sejak 2022.",
				],
				[
					"Developed a 14-colour natural-dye palette from mahogany, indigo and mango leaf that reaches wash-fastness grade 4.",
					"Mengembangkan palet 14 warna alam dari mahoni, indigo dan daun mangga dengan ketahanan luntur cuci tingkat 4.",
				],
			],
		},
		{
			company: "Sekolah Desain Rupa Nusantara",
			position: ["Part-time Lecturer, Textile Design", "Dosen Tidak Tetap, Desain Tekstil"],
			location: "Surakarta",
			period: ["Feb 2022 – Present", "Feb 2022 – Sekarang"],
			bullets: [
				[
					"Teach Batik Techniques and Surface Design to 60 students each semester.",
					"Mengajar Teknik Batik dan Desain Permukaan untuk 60 mahasiswa per semester.",
				],
				[
					"Lead a two-year study of 120 coastal batik motifs, funded with IDR 350 million.",
					"Memimpin riset dua tahun atas 120 motif batik pesisir dengan dana Rp350 juta.",
				],
			],
		},
		{
			company: "Kain Rasa Indonesia",
			position: ["Textile Designer", "Desainer Tekstil"],
			location: "Jakarta",
			period: ["Aug 2016 – May 2021", "Agu 2016 – Mei 2021"],
			bullets: [
				[
					"Designed prints and batik for 11 ready-to-wear collections sold in 45 stores.",
					"Mendesain motif cetak dan batik untuk 11 koleksi siap pakai yang dijual di 45 toko.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Lasem Motif Archive", "Arsip Motif Lasem"],
			period: "2024 – 2025",
			description: [
				"Photographed and catalogued 340 heirloom batik pieces with five Lasem families; the open online archive has had 18,000 visits.",
				"Memotret dan mengkatalogkan 340 kain batik pusaka bersama lima keluarga di Lasem; arsip daring terbukanya telah dikunjungi 18.000 kali.",
			],
		},
		{
			name: ["“Earth Colours”, solo exhibition", "Pameran tunggal “Tanah Warna”"],
			period: "2023",
			description: [
				"Twenty natural-dye pieces shown for a month at Galeri Rupa Kemang; 12 bought by private collectors.",
				"Dua puluh karya pewarna alam dipamerkan sebulan di Galeri Rupa Kemang; 12 dibeli kolektor pribadi.",
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Master of Design", "Magister Desain (M.Ds.)"],
			area: ["Textile Craft", "Kriya Tekstil"],
			location: "Bandung",
			period: "2014 – 2016",
			description: [
				"Thesis: colour fastness of mangrove-bark dyes on cotton and silk.",
				"Tesis: ketahanan luntur pewarna kulit kayu mangrove pada katun dan sutra.",
			],
		},
		{
			school: "Institut Seni Indonesia Surakarta",
			degree: ["Bachelor of Arts", "Sarjana Seni (S.Sn.)"],
			area: ["Textile Craft", "Kriya Tekstil"],
			grade: ["GPA 3.74", "IPK 3,74"],
			location: "Surakarta",
			period: "2010 – 2014",
		},
	],
	skills: [
		{
			name: ["Textile design", "Desain tekstil"],
			keywords: [
				["Hand-drawn & stamped batik", "Batik tulis & cap"],
				["Motif development", "Pengembangan motif"],
				["Surface design", "Desain permukaan"],
			],
		},
		{
			name: ["Colour", "Warna"],
			keywords: [["Natural dyes", "Pewarna alam"], "Indigo", ["Fastness testing", "Uji ketahanan luntur"]],
		},
		{
			name: ["Research", "Riset"],
			keywords: [
				["Field documentation", "Dokumentasi lapangan"],
				["Oral history", "Sejarah lisan"],
				["Archiving", "Pengarsipan"],
			],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Illustrator", "Photoshop", "NedGraphics", "Procreate"] },
	],
	awards: [
		{ title: ["Gold, Craft Textiles", "Emas, Tekstil Kriya"], awarder: "Penghargaan Kriya Nusantara", date: "2025" },
		{ title: ["Young Designer of the Year", "Desainer Muda Terbaik"], awarder: "Pekan Wastra Indonesia", date: "2022" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	interests: [
		{ name: ["Hand weaving", "Menenun"] },
		{ name: ["Gamelan", "Gamelan"] },
		{ name: ["Dye-plant gardening", "Berkebun tanaman pewarna"] },
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards", "languages", "interests"],
	},
};
