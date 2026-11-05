import type { Persona } from "./persona";

/** Fajar: a communication science graduate looking for a first role in public relations or content. */
export const fajar: Persona = {
	name: "Salsabila Tanjung",
	headline: ["Communication Science Graduate · PR & Content", "Lulusan Ilmu Komunikasi · PR & Konten"],
	email: "salsabila.tanjung@email.com",
	phone: "+62 821 5558 3047",
	location: "Bandung, Indonesia",
	website: { url: "https://salsabilatanjung.my.id", label: "salsabilatanjung.my.id" },
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/salsabilatanjung",
			link: "https://linkedin.com/in/salsabilatanjung",
		},
	],
	summary: [
		"**Communication Science graduate ready for a first role in public relations or content.** Two internships taught me to write press releases that editors actually run, plan social media calendars and read the numbers behind a post. Four years in campus media made me quick with deadlines, interviews and short video.",
		"**Lulusan Ilmu Komunikasi yang siap mengisi posisi pertama di bidang humas atau konten.** Dua kali magang mengajarkan saya menulis siaran pers yang benar-benar dimuat redaksi, menyusun kalender media sosial, dan membaca angka di balik sebuah unggahan. Empat tahun di pers kampus membuat saya sigap menghadapi tenggat, wawancara, dan video pendek.",
	],
	education: [
		{
			school: "Universitas Padjadjaran",
			degree: ["Bachelor of Communication", "Sarjana Ilmu Komunikasi (S.I.Kom.)"],
			area: ["Public Relations", "Hubungan Masyarakat"],
			grade: ["GPA 3.72 / 4.00", "IPK 3,72 / 4,00"],
			location: "Jatinangor",
			period: ["Aug 2022 – Sep 2026", "Agu 2022 – Sep 2026"],
			description: [
				"Thesis: how city governments answer complaints on Instagram, a content analysis of 2,400 comments.",
				"Skripsi: cara pemerintah kota menanggapi keluhan warga di Instagram, analisis isi atas 2.400 komentar.",
			],
		},
	],
	experience: [
		{
			company: "Gema Komunika",
			position: ["PR & Content Intern", "PR & Content Intern"],
			location: ["Jakarta (hybrid)", "Jakarta (hybrid)"],
			period: "Feb 2026 – Jun 2026",
			bullets: [
				[
					"Drafted 18 press releases for four FMCG and tourism clients; 12 were picked up by national online media.",
					"Menyusun 18 siaran pers untuk empat klien FMCG dan pariwisata; 12 di antaranya dimuat media daring nasional.",
				],
				[
					"Built a weekly media-monitoring report covering 300+ articles, now used by the account team.",
					"Membuat laporan pemantauan media mingguan atas 300+ artikel yang kini dipakai tim akun.",
				],
				[
					"Helped run a product launch for 120 guests and 35 journalists.",
					"Membantu pelaksanaan peluncuran produk untuk 120 tamu dan 35 jurnalis.",
				],
			],
		},
		{
			company: "Sabana Trip",
			position: ["Social Media Intern", "Social Media Intern"],
			location: "Bandung",
			period: "Jul 2025 – Sep 2025",
			bullets: [
				[
					"Planned and wrote a three-month Instagram and TikTok calendar; followers grew from 8,000 to 21,000.",
					"Merencanakan dan menulis kalender konten Instagram dan TikTok selama tiga bulan; pengikut naik dari 8.000 menjadi 21.000.",
				],
				[
					"Edited 30 short videos; one reel about a West Java waterfall reached 1.2 million views.",
					"Menyunting 30 video pendek; satu reel tentang air terjun di Jawa Barat ditonton 1,2 juta kali.",
				],
			],
		},
	],
	volunteer: [
		{
			organization: "Pers Mahasiswa Dialektika",
			location: "Jatinangor",
			period: "2023 – 2026",
			description: [
				"Editor-in-chief (2025): led 24 reporters, published 140 stories and grew the website to 45,000 monthly readers.",
				"Pemimpin Redaksi (2025): memimpin 24 reporter, menerbitkan 140 liputan, dan menumbuhkan pembaca situs menjadi 45.000 per bulan.",
			],
		},
		{
			organization: "Radio Kampus Gelombang 107",
			location: "Jatinangor",
			period: "2022 – 2024",
			description: [
				"Host and producer of a weekly talk show on student life: 52 episodes and 9,000 podcast plays.",
				"Penyiar dan produser gelar wicara mingguan tentang kehidupan mahasiswa: 52 episode dan 9.000 kali diputar sebagai podcast.",
			],
		},
	],
	skills: [
		{
			name: ["Public relations", "Kehumasan"],
			keywords: [
				["Press releases", "Siaran pers"],
				["Media monitoring", "Pemantauan media"],
				["Event support", "Dukungan acara"],
			],
		},
		{
			name: ["Content", "Konten"],
			keywords: ["Copywriting", ["Short video", "Video pendek"], ["Social media planning", "Perencanaan media sosial"]],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Canva", "CapCut", "Meta Business Suite", "Google Analytics"] },
	],
	certifications: [
		{ title: "Google Digital Marketing & E-commerce Certificate", issuer: "Google", date: "2025" },
		{ title: "Content Marketing Certification", issuer: "HubSpot Academy", date: "2026" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Minangkabau", "Bahasa Minang"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Good (TOEFL ITP 590)", "Baik (TOEFL ITP 590)"], level: 4 },
	],
	interests: [
		{ name: ["Podcasting", "Podcast"] },
		{ name: ["Street photography", "Fotografi jalanan"] },
		{ name: ["Minang cooking", "Masakan Minang"] },
	],
	titles: { volunteer: ["Campus Organisations", "Organisasi Kampus"] },
	layout: {
		main: ["summary", "education", "experience", "volunteer"],
		sidebar: ["skills", "certifications", "languages", "interests"],
	},
};
