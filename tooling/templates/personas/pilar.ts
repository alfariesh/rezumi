import type { Persona } from "./persona";

/** Pilar: a credit risk manager at a regional development bank in West Sumatra. */
export const pilar: Persona = {
	name: "Hafizh Rahman Chaniago",
	headline: ["Credit Risk Manager · Regional Development Banking", "Manajer Risiko Kredit · Bank Pembangunan Daerah"],
	email: "hafizh.chaniago@email.com",
	phone: "+62 813 5557 4820",
	location: ["Padang, West Sumatra", "Padang, Sumatera Barat"],
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/hafizhchaniago",
			link: "https://linkedin.com/in/hafizhchaniago",
		},
	],
	summary: [
		"**Credit risk manager with fourteen years in regional, commercial and rural banking.** I run credit risk for a development bank with an IDR 9.8 trillion loan book, from scorecards and limits to the reports the board and regulators read. My aim: keep lending to small businesses and civil servants growing while bad loans stay low.",
		"**Manajer risiko kredit dengan empat belas tahun pengalaman di bank daerah, bank umum, dan BPR.** Saya memimpin pengelolaan risiko kredit di bank pembangunan daerah dengan portofolio Rp 9,8 triliun, dari scorecard dan limit hingga laporan untuk direksi dan regulator. Tujuan saya: kredit UMKM dan pegawai terus tumbuh, sementara kredit bermasalah tetap rendah.",
	],
	experience: [
		{
			company: "Bank Pembangunan Daerah Swarna Andalas",
			position: ["Credit Risk Manager", "Manajer Risiko Kredit"],
			location: "Padang",
			period: ["Jun 2021 – Present", "Jun 2021 – Sekarang"],
			bullets: [
				[
					"Lead a team of 8 analysts overseeing an IDR 9.8 trillion portfolio across 46 branches.",
					"Memimpin 8 analis yang mengawasi portofolio kredit Rp 9,8 triliun di 46 kantor cabang.",
				],
				[
					"Brought gross NPL down from 4.1% to 2.6% in three years with an early-warning watchlist and tighter SME limits.",
					"Menurunkan NPL gross dari 4,1% menjadi 2,6% dalam tiga tahun lewat daftar pantauan dini dan limit UMKM yang lebih ketat.",
				],
				[
					"Built the bank’s first application scorecard for payroll loans; approval time fell from five days to one.",
					"Membangun scorecard aplikasi pertama bank untuk kredit pegawai; waktu persetujuan turun dari lima hari menjadi satu hari.",
				],
			],
		},
		{
			company: "PT Bank Saka Niaga",
			position: ["Senior Credit Analyst, SME", "Analis Kredit Senior, UMKM"],
			location: "Pekanbaru",
			period: ["Mar 2016 – May 2021", "Mar 2016 – Mei 2021"],
			bullets: [
				[
					"Reviewed 600+ SME and commercial loan proposals worth IDR 2.4 trillion; 94% of my recommendations were upheld by the credit committee.",
					"Menelaah lebih dari 600 proposal kredit UMKM dan komersial senilai Rp 2,4 triliun; 94% rekomendasi saya disetujui komite kredit.",
				],
				[
					"Restructured 180 pandemic-hit loans; 86% were back to current within a year.",
					"Merestrukturisasi 180 kredit terdampak pandemi; 86% kembali lancar dalam satu tahun.",
				],
			],
		},
		{
			company: "PT BPR Rangkiang Nagari",
			position: ["Credit Officer", "Account Officer Kredit"],
			location: "Bukittinggi",
			period: ["Aug 2012 – Feb 2016", "Agu 2012 – Feb 2016"],
			bullets: [
				[
					"Managed 350 micro and farm loans; kept arrears under 2% for three years running.",
					"Mengelola 350 kredit mikro dan pertanian; menjaga tunggakan di bawah 2% selama tiga tahun berturut-turut.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Andalas",
			degree: ["Master of Management", "Magister Manajemen (M.M.)"],
			area: ["Financial Management", "Manajemen Keuangan"],
			grade: ["GPA 3.82", "IPK 3,82"],
			location: "Padang",
			period: "2022 – 2024",
		},
		{
			school: "Universitas Gadjah Mada",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi (S.E.)"],
			area: ["Accounting", "Akuntansi"],
			grade: ["GPA 3.61", "IPK 3,61"],
			location: "Yogyakarta",
			period: "2008 – 2012",
		},
	],
	certifications: [
		{
			title: ["Risk Management Certification, Level 4", "Sertifikasi Manajemen Risiko Level 4"],
			issuer: "Lembaga Sertifikasi Profesi Perbankan",
			date: "2022",
		},
		{ title: "Financial Risk Manager (FRM)", issuer: "GARP", date: "2020" },
		{ title: ["SME Credit Analysis", "Analisis Kredit UMKM"], issuer: "Institut Bankir Indonesia", date: "2017" },
		{
			title: ["Basel III Credit Risk Modelling", "Pemodelan Risiko Kredit Basel III"],
			issuer: "Akademi Risiko Perbankan Nusantara",
			date: "2023",
		},
	],
	skills: [
		{
			name: ["Credit risk", "Risiko kredit"],
			keywords: [
				["Scorecards", "Scorecard"],
				["Limit setting", "Penetapan limit"],
				["Stress testing", "Stress test"],
				"PSAK 71",
			],
		},
		{
			name: ["Regulation", "Regulasi"],
			keywords: [["Risk profile reports", "Laporan profil risiko"], "Basel III", ["OJK reporting", "Pelaporan OJK"]],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["SQL", "Python", "SAS", "Excel"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Minangkabau", "Bahasa Minang"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	columns: { certifications: 2, skills: 3, languages: 3 },
	layout: {
		main: ["summary", "experience", "education", "certifications"],
		sidebar: ["skills", "languages"],
	},
};
