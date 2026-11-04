import type { Persona } from "./persona";

/** Purnama: a senior relationship manager in private banking in Jakarta. */
export const purnama: Persona = {
	photo: true,
	name: "Anindya Dewi",
	headline: "Senior Relationship Manager · Private Banking",
	email: "anindya.dewi@email.com",
	phone: "+62 815 5556 0937",
	location: "Jakarta, Indonesia",
	details: [{ icon: "linkedin-02", text: "linkedin.com/in/anindyadewi", link: "https://linkedin.com/in/anindyadewi" }],
	summary: [
		"**Private banker with fourteen years in wealth management**, now advising 48 families with combined assets of IDR 4.6 trillion. I build portfolios around a family’s goals, from business succession to a child’s education abroad, and keep clients for the long term: none of my top 20 relationships has left in five years.",
		"**Private banker dengan pengalaman empat belas tahun di manajemen kekayaan**, kini mendampingi 48 keluarga dengan total aset Rp4,6 T. Saya menyusun portofolio sesuai tujuan keluarga, dari suksesi usaha hingga pendidikan anak di luar negeri, dan menjaga hubungan jangka panjang: tak satu pun dari 20 nasabah utama saya berpindah dalam lima tahun terakhir.",
	],
	experience: [
		{
			company: "Bank Karsa Utama",
			position: "Senior Relationship Manager, Private Banking",
			location: "Jakarta",
			period: ["Jan 2022 – Present", "Jan 2022 – Sekarang"],
			bullets: [
				[
					"Manage 48 ultra-high-net-worth families with IDR 4.6T in assets; grew the book by 38% in three years.",
					"Mengelola 48 keluarga ultra-high-net-worth dengan aset Rp4,6 T; menumbuhkan portofolio 38% dalam tiga tahun.",
				],
				[
					"Brought in IDR 1.2T of net new money in 2025, first among 26 private bankers.",
					"Menghimpun dana baru Rp1,2 T pada 2025, tertinggi dari 26 private banker.",
				],
				[
					"Coach three junior relationship managers; two promoted within 18 months.",
					"Membina tiga RM junior; dua di antaranya dipromosikan dalam 18 bulan.",
				],
			],
		},
		{
			company: "Bank Karsa Utama",
			position: "Relationship Manager, Private Banking",
			location: "Jakarta",
			period: ["Jul 2018 – Dec 2021", "Jul 2018 – Des 2021"],
			bullets: [
				[
					"Grew an inherited book of 35 clients from IDR 0.6T to IDR 2.1T in assets.",
					"Menumbuhkan dana kelolaan 35 nasabah warisan dari Rp0,6 T menjadi Rp2,1 T.",
				],
				[
					"Built bond and fund portfolios with zero findings in four compliance audits.",
					"Menyusun portofolio obligasi dan reksa dana tanpa temuan di empat audit.",
				],
				[
					"Introduced quarterly family reviews with tax and legal advisers, adopted by the whole desk in 2021.",
					"Memperkenalkan tinjauan keluarga per kuartal bersama penasihat pajak dan hukum, yang diadopsi seluruh tim pada 2021.",
				],
			],
		},
		{
			company: "Bank Samudra Raya",
			position: "Relationship Manager, Priority Banking",
			location: "Jakarta",
			period: ["Mar 2014 – Jun 2018", "Mar 2014 – Jun 2018"],
			bullets: [
				[
					"Served 220 priority clients holding IDR 1.3T in funds; raised fee income by 52%.",
					"Melayani 220 nasabah prioritas berdana Rp1,3 T; pendapatan fee naik 52%.",
				],
				[
					"Ranked in the national top three for bancassurance sales in 2016 and 2017.",
					"Masuk tiga besar nasional penjualan bancassurance pada 2016 dan 2017.",
				],
			],
		},
		{
			company: "Bank Samudra Raya",
			position: ["Officer Development Program, Personal Banker", "Officer Development Program, Personal Banker"],
			location: "Jakarta",
			period: ["Aug 2011 – Feb 2014", "Agu 2011 – Feb 2014"],
			bullets: [
				[
					"Completed the officer programme, then grew branch funds by IDR 85 billion.",
					"Lulus program officer, lalu menambah dana cabang Rp85 miliar dalam setahun.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Prasetiya Mulya",
			degree: ["Master of Management", "Magister Manajemen (M.M.)"],
			area: ["Finance (executive)", "Keuangan (kelas eksekutif)"],
			location: "Jakarta",
			period: "2016 – 2018",
		},
		{
			school: "Universitas Indonesia",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi (S.E.)"],
			area: ["Management", "Manajemen"],
			grade: ["GPA 3.57", "IPK 3,57"],
			location: "Depok",
			period: "2007 – 2011",
		},
	],
	awards: [
		{
			title: "Private Banker of the Year",
			awarder: "Bank Karsa Utama",
			date: "2024",
			description: [
				"Highest growth and client retention across the bank’s private banking network.",
				"Pertumbuhan dan retensi nasabah tertinggi di seluruh jaringan private banking.",
			],
		},
		{
			title: ["Best Net New Money", "Dana Baru Bersih Terbaik"],
			awarder: "Bank Karsa Utama",
			date: "2022",
			description: [
				"IDR 640 billion of new client money in one year.",
				"Dana nasabah baru Rp640 miliar dalam satu tahun.",
			],
		},
		{
			title: "President’s Club, Priority Banking",
			awarder: "Bank Samudra Raya",
			date: "2016, 2017",
			description: [
				"Top 2% of priority relationship managers nationwide, two years running.",
				"Masuk 2% relationship manager prioritas terbaik nasional, dua tahun berturut-turut.",
			],
		},
	],
	skills: [
		{
			name: ["Wealth advisory", "Penasihat kekayaan"],
			keywords: [
				["Portfolio construction", "Penyusunan portofolio"],
				["Fixed income", "Pendapatan tetap"],
				["Succession planning", "Perencanaan suksesi"],
			],
		},
		{
			name: ["Client growth", "Pengembangan nasabah"],
			keywords: [
				["Prospecting", "Prospek nasabah"],
				["Family office", "Family office"],
				["KYC & AML", "KYC & APU-PPT"],
			],
		},
	],
	certifications: [
		{ title: ["WMI Licence", "Lisensi WMI"], issuer: "OJK", date: "2019" },
		{ title: "Certified Financial Planner", issuer: "FPSB Indonesia", date: "2020" },
		{
			title: ["Life Insurance Agent Licence", "Lisensi Agen Asuransi Jiwa"],
			issuer: "Asosiasi Asuransi Jiwa Nusantara",
			date: "2014",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 5 },
		{ language: ["Mandarin", "Bahasa Mandarin"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	layout: {
		main: ["summary", "experience", "education", "awards"],
		sidebar: ["skills", "certifications", "languages"],
	},
};
