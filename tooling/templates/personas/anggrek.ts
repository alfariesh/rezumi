import type { Persona } from "./persona";

/** Anggrek: a guest experience director at a boutique resort group in Bali. */
export const anggrek: Persona = {
	name: "Ni Komang Ayu Widyastuti",
	headline: ["Director of Guest Experience · Boutique Resorts", "Direktur Pengalaman Tamu · Resor Butik"],
	email: "ayu.widyastuti@email.com",
	phone: "+62 812 5553 7146",
	location: "Ubud, Bali",
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/ayuwidyastuti",
			link: "https://linkedin.com/in/ayuwidyastuti",
		},
	],
	summary: [
		"**Hospitality leader with fourteen years in luxury and boutique hotels across Bali, Lombok and Yogyakarta.** I run guest experience for five resorts, turning Balinese warmth into service standards a team can deliver every day. Guest scores, repeat stays and staff retention are the numbers I answer for.",
		"**Pemimpin hospitality dengan empat belas tahun pengalaman di hotel mewah dan butik di Bali, Lombok, dan Yogyakarta.** Saya memimpin pengalaman tamu di lima resor, mengubah keramahan khas Bali menjadi standar layanan yang bisa dijalankan tim setiap hari. Skor ulasan, tamu yang kembali, dan retensi staf adalah ukuran kinerja saya.",
	],
	experience: [
		{
			company: "Kirta Arum Resorts",
			position: "Director of Guest Experience",
			location: "Ubud, Bali",
			period: ["Apr 2021 – Present", "Apr 2021 – Sekarang"],
			bullets: [
				[
					"Lead guest experience across five resorts and 212 villas and suites, with 9 managers and 140 front-of-house staff.",
					"Memimpin pengalaman tamu di lima resor dengan 212 vila dan suite, membawahi 9 manajer dan 140 staf front-of-house.",
				],
				[
					"Raised the group’s average review score from 9.1 to 9.6 and repeat stays from 18% to 31% in three years.",
					"Menaikkan rata-rata skor ulasan grup dari 9,1 menjadi 9,6 dan tamu yang kembali menginap dari 18% menjadi 31% dalam tiga tahun.",
				],
			],
		},
		{
			company: "Segara Kencana Hotels",
			position: "Guest Relations & Front Office Manager",
			location: "Lombok",
			period: "Jan 2016 – Mar 2021",
			bullets: [
				[
					"Opened a 64-room beachfront hotel; reached 82% occupancy and a 4.8 guest rating in its first full year.",
					"Membuka hotel tepi pantai berkapasitas 64 kamar; mencapai okupansi 82% dan rating tamu 4,8 pada tahun pertama beroperasi penuh.",
				],
			],
		},
		{
			company: "Ndalem Sekar Heritage Hotel",
			position: "Guest Relations Officer",
			location: "Yogyakarta",
			period: ["Aug 2012 – Dec 2015", "Agu 2012 – Des 2015"],
			bullets: [
				[
					"Hosted 300+ VIP and wedding groups a year; trained 25 new staff in heritage tours and guest etiquette.",
					"Melayani lebih dari 300 tamu VIP dan rombongan pernikahan per tahun; melatih 25 staf baru tentang tur budaya dan etiket pelayanan.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Udayana",
			degree: ["Master of Management", "Magister Manajemen (M.M.)"],
			area: ["Tourism Management", "Manajemen Pariwisata"],
			grade: ["GPA 3.84", "IPK 3,84"],
			location: "Denpasar",
			period: "2018 – 2020",
		},
		{
			school: "Politeknik Pariwisata Bali",
			degree: ["Bachelor of Applied Tourism", "Sarjana Terapan Pariwisata (S.Tr.Par.)"],
			area: ["Hospitality Management", "Manajemen Perhotelan"],
			grade: ["GPA 3.71", "IPK 3,71"],
			location: "Badung, Bali",
			period: "2008 – 2012",
		},
	],
	skills: [
		{
			name: ["Guest experience", "Pengalaman tamu"],
			keywords: [
				["Service design", "Desain layanan"],
				["Luxury standards", "Standar layanan mewah"],
				["Service recovery", "Penanganan keluhan"],
			],
		},
		{
			name: ["Leadership", "Kepemimpinan"],
			keywords: [
				["Staff training", "Pelatihan staf"],
				["Multi-property teams", "Tim multi-properti"],
				["Budgeting", "Penganggaran"],
			],
		},
		{ name: ["Systems", "Sistem"], keywords: ["Opera PMS", "Revinate", "ReviewPro"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 5 },
		{ language: ["Japanese", "Bahasa Jepang"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	certifications: [
		{
			title: "Certified Hospitality Administrator (CHA)",
			issuer: "American Hotel & Lodging Educational Institute",
			date: "2022",
		},
		{
			title: ["Hotel General Manager Competency", "Sertifikat Kompetensi General Manager Hotel"],
			issuer: "BNSP",
			date: "2019",
		},
	],
	awards: [
		{
			title: ["Best Guest Experience, Boutique Resort Group", "Pengalaman Tamu Terbaik, Grup Resor Butik"],
			awarder: "Nusantara Hospitality Awards",
			date: "2025",
		},
	],
	columns: { skills: 3, languages: 3, certifications: 2 },
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "languages", "certifications", "awards"],
	},
};
