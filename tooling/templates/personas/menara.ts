import type { Persona } from "./persona";

/** Menara, the accent-topped left sidebar: a project finance manager at a state-owned toll road and port developer. */
export const menara: Persona = {
	name: "Benny Simanjuntak, CFA",
	headline: ["Project Finance Manager · Toll Roads & Ports", "Project Finance Manager · Jalan Tol & Pelabuhan"],
	email: "benny.simanjuntak@email.com",
	phone: "+62 813 5559 7286",
	location: "Jakarta, Indonesia",
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/bennysmjt",
			link: "https://linkedin.com/in/bennysmjt",
		},
	],
	summary: [
		"**CFA charterholder with twelve years in infrastructure finance**, now raising capital for the toll roads and ports of a state-owned developer. I have closed IDR 21 trillion of project loans, bonds and PPP deals, with models lenders trust and structures regulators approve. I work comfortably between banks, ministries and construction teams.",
		"**Pemegang gelar CFA dengan dua belas tahun pengalaman di pembiayaan infrastruktur**, kini menghimpun pendanaan untuk jalan tol dan pelabuhan sebuah BUMN infrastruktur. Saya telah menuntaskan pinjaman proyek, obligasi, dan skema KPBU senilai Rp21 triliun, dengan model keuangan yang dipercaya kreditur dan struktur yang disetujui regulator. Saya terbiasa bekerja di antara bank, kementerian, dan tim konstruksi.",
	],
	experience: [
		{
			company: "PT Bentang Infrastruktur Nusantara (Persero)",
			position: "Project Finance Manager",
			location: "Jakarta",
			period: ["Jan 2022 – Present", "Jan 2022 – Sekarang"],
			bullets: [
				[
					"Closed an IDR 9.8 trillion syndicated loan from seven banks for a 112 km toll road, priced 65 bps below budget.",
					"Menuntaskan pinjaman sindikasi Rp9,8 triliun dari tujuh bank untuk jalan tol sepanjang 112 km, dengan bunga 65 bps di bawah anggaran.",
				],
				[
					"Structured the company’s first green bond (IDR 3 trillion, 3.1× oversubscribed) to fund two port expansions.",
					"Menstrukturkan obligasi hijau pertama perusahaan (Rp3 triliun, kelebihan permintaan 3,1 kali) untuk mendanai perluasan dua pelabuhan.",
				],
				[
					"Lead five analysts; a standard model template cut lender review from four weeks to ten days.",
					"Memimpin lima analis; templat model standar memangkas waktu tinjauan kreditur dari empat minggu menjadi sepuluh hari.",
				],
			],
		},
		{
			company: "Bank Pembangunan Kencana",
			position: [
				"Assistant Vice President, Infrastructure Finance",
				"Assistant Vice President, Pembiayaan Infrastruktur",
			],
			location: "Jakarta",
			period: ["Mar 2017 – Dec 2021", "Mar 2017 – Des 2021"],
			bullets: [
				[
					"Arranged and monitored IDR 6.5 trillion of loans for toll roads, power plants and water projects, with no defaults.",
					"Mengatur dan memantau pinjaman Rp6,5 triliun untuk jalan tol, pembangkit listrik, dan air minum, tanpa gagal bayar.",
				],
				[
					"Led due diligence on 11 PPP bids, covering traffic, construction and land acquisition risk.",
					"Memimpin uji tuntas 11 tender KPBU, mencakup risiko lalu lintas, konstruksi, dan pengadaan lahan.",
				],
			],
		},
		{
			company: "Saka Mitra Konsultan",
			position: ["Analyst, Transaction Advisory", "Analis, Transaction Advisory"],
			location: "Jakarta",
			period: ["Aug 2014 – Feb 2017", "Agu 2014 – Feb 2017"],
			bullets: [
				[
					"Built financial models for 14 government infrastructure tenders, from feasibility study to financial close.",
					"Menyusun model keuangan untuk 14 tender infrastruktur pemerintah, dari studi kelayakan hingga financial close.",
				],
			],
		},
	],
	education: [
		{
			school: "The University of Melbourne",
			degree: ["Master of Finance", "Master of Finance"],
			area: ["Finance (LPDP scholar)", "Keuangan (penerima beasiswa LPDP)"],
			location: ["Melbourne, Australia", "Melbourne, Australia"],
			period: "2013 – 2014",
		},
		{
			school: "Universitas Sumatera Utara",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Civil Engineering", "Teknik Sipil"],
			grade: ["GPA 3.62", "IPK 3,62"],
			location: "Medan",
			period: "2008 – 2012",
		},
	],
	skills: [
		{
			name: ["Project finance", "Pembiayaan proyek"],
			keywords: [
				["Financial modelling", "Pemodelan keuangan"],
				["Debt structuring", "Struktur utang"],
				["Syndicated loans", "Pinjaman sindikasi"],
			],
		},
		{
			name: ["Capital markets", "Pasar modal"],
			keywords: [["Green bonds", "Obligasi hijau"], "Sukuk", ["Credit ratings", "Pemeringkatan kredit"]],
		},
		{
			name: ["Government & PPP", "Pemerintah & KPBU"],
			keywords: [
				["PPP structuring", "Struktur KPBU"],
				["Viability gap funding", "Dukungan kelayakan"],
				["Government guarantees", "Penjaminan pemerintah"],
			],
		},
	],
	certifications: [
		{ title: "CFA Charterholder", issuer: "CFA Institute", date: "2019" },
		{ title: "Certified PPP Professional (CP3P)", issuer: "APMG International", date: "2021" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Batak Toba", "Bahasa Batak Toba"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 5 },
	],
	awards: [
		{
			title: ["Toll Road Financing of the Year", "Pembiayaan Jalan Tol Terbaik"],
			awarder: "Anugerah Pembiayaan Infrastruktur Nusantara",
			date: "2024",
		},
	],
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "certifications", "languages", "awards"],
	},
};
