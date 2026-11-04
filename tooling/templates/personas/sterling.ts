import type { Persona } from "./persona";

/** Sterling, the classic finance page: a vice president in corporate finance at an investment bank. */
export const sterling: Persona = {
	name: "Arief Wicaksono",
	headline: "Vice President · Corporate Finance",
	email: "arief.wicaksono@email.com",
	phone: "+62 811 5553 2709",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/ariefwicaksono", link: "https://linkedin.com/in/ariefwicaksono" },
	],
	summary: [
		"**Corporate finance banker with twelve years in M&A and capital markets**, covering infrastructure, energy and consumer clients in Indonesia. Executed 19 transactions worth USD 4.1 billion, from buy-side acquisitions to rights issues and green bonds.",
		"**Bankir corporate finance dengan dua belas tahun pengalaman di M&A dan pasar modal** untuk klien infrastruktur, energi dan konsumer. Telah mengeksekusi 19 transaksi senilai USD 4,1 miliar, dari akuisisi hingga rights issue dan obligasi hijau.",
	],
	experience: [
		{
			company: "Selaras Capital Indonesia",
			position: "Vice President, Corporate Finance",
			location: "Jakarta",
			period: ["Apr 2021 – Present", "Apr 2021 – Sekarang"],
			bullets: [
				[
					"Led execution of a USD 520 million cross-border acquisition of a cement producer for a regional conglomerate, from valuation to signing in seven months.",
					"Memimpin eksekusi akuisisi lintas negara senilai USD 520 juta atas produsen semen untuk sebuah konglomerasi regional, dari valuasi hingga penandatanganan dalam tujuh bulan.",
				],
				[
					"Co-led an IDR 2.8 trillion rights issue for a listed toll-road operator, 1.6 times oversubscribed.",
					"Turut memimpin rights issue senilai Rp2,8 triliun untuk operator jalan tol tercatat, dengan kelebihan permintaan 1,6 kali.",
				],
				[
					"Structured the bank's first USD 300 million green bond, for a geothermal developer, priced 35 bps inside guidance and 2.3 times covered.",
					"Menstrukturkan obligasi hijau pertama bank senilai USD 300 juta untuk pengembang panas bumi, dengan harga 35 bps di bawah panduan awal dan permintaan 2,3 kali.",
				],
				[
					"Manage a team of four associates and analysts; built the deal model templates now used across the coverage group.",
					"Membina tim berisi empat associate dan analis; menyusun templat model transaksi yang kini dipakai seluruh tim coverage.",
				],
			],
		},
		{
			company: "Selaras Capital Indonesia",
			position: "Associate, Mergers & Acquisitions",
			location: "Jakarta",
			period: "Jan 2018 – Mar 2021",
			bullets: [
				[
					"Executed nine sell-side and buy-side mandates worth USD 1.6 billion, mainly in healthcare, logistics and food.",
					"Mengeksekusi sembilan mandat jual dan beli senilai USD 1,6 miliar, terutama di sektor kesehatan, logistik dan pangan.",
				],
				[
					"Ran due diligence data rooms and buyer processes with up to 30 bidders.",
					"Mengelola data room due diligence dan proses lelang dengan hingga 30 calon pembeli.",
				],
				[
					"Built valuation and merger models for 40+ pitches; six became mandates.",
					"Menyusun model valuasi dan merger untuk lebih dari 40 pitch; enam di antaranya menjadi mandat.",
				],
			],
		},
		{
			company: "Wiratama Advisory",
			position: ["Analyst, Transaction Services", "Analyst, Transaction Services"],
			location: "Jakarta",
			period: ["Aug 2012 – Jul 2016", "Agu 2012 – Jul 2016"],
			bullets: [
				[
					"Prepared financial due diligence and valuation reports for 25 deals; promoted to senior analyst in two years.",
					"Menyusun laporan due diligence keuangan dan valuasi untuk 25 transaksi; naik menjadi senior analyst dalam dua tahun.",
				],
			],
		},
	],
	education: [
		{
			school: "National University of Singapore",
			degree: ["Master of Business Administration", "Master of Business Administration"],
			area: ["Finance", "Keuangan"],
			grade: ["Dean's List", "Dean's List"],
			location: "Singapore",
			period: "2016 – 2017",
		},
		{
			school: "Universitas Indonesia",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi"],
			area: ["Accounting", "Akuntansi"],
			grade: ["GPA 3.68, cum laude", "IPK 3,68, cum laude"],
			location: "Depok",
			period: "2008 – 2012",
		},
	],
	certifications: [
		{ title: ["CFA Charterholder", "CFA Charterholder"], issuer: "CFA Institute", date: "2019" },
		{
			title: ["Securities Underwriter Licence (WPEE)", "Izin Wakil Penjamin Emisi Efek (WPEE)"],
			issuer: "Otoritas Jasa Keuangan",
			date: "2018",
		},
	],
	skills: [
		{
			name: ["Transactions", "Transaksi"],
			keywords: ["M&A", ["Equity capital markets", "Pasar modal ekuitas"], ["Debt financing", "Pembiayaan utang"]],
		},
		{
			name: ["Analysis", "Analisis"],
			keywords: [["Financial modelling", "Pemodelan keuangan"], "DCF & LBO", ["Valuation", "Valuasi"]],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Excel", "PowerPoint", "Bloomberg", "Capital IQ"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 0 },
	],
	interests: [
		{ name: ["Marathon running", "Lari maraton"] },
		{ name: ["Chess", "Catur"] },
		{ name: ["Mentoring finance students", "Mentor mahasiswa keuangan"] },
	],
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["certifications", "skills", "languages", "interests"],
	},
	columns: { certifications: 2, skills: 3, languages: 3, interests: 3 },
};
