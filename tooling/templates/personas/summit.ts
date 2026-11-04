import type { Persona } from "./persona";

/** Summit, the executive page: the chief financial officer of a listed energy group. */
export const summit: Persona = {
	name: "Hendra Siregar",
	headline: ["Chief Financial Officer · Energy & Consumer Goods", "Chief Financial Officer · Energi & Barang Konsumen"],
	email: "hendra.siregar@email.com",
	phone: "+62 811 5557 4062",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/hendrasiregar", link: "https://linkedin.com/in/hendrasiregar" },
	],
	summary: [
		"**Chief financial officer with 25 years in listed energy and consumer companies.** Took a power producer public, refinanced USD 1.1 billion of debt and led cost programmes that saved more than IDR 1 trillion. Builds finance teams that boards trust.",
		"**Chief financial officer dengan 25 tahun pengalaman di perusahaan energi dan konsumer tercatat.** Membawa produsen listrik melantai di bursa, merefinansiasi utang USD 1,1 miliar dan memimpin efisiensi yang menghemat lebih dari Rp1 triliun. Membangun tim keuangan yang dipercaya dewan.",
	],
	experience: [
		{
			company: "PT Rimba Daya Energi Tbk",
			position: ["Chief Financial Officer & Director", "Chief Financial Officer & Direktur"],
			location: "Jakarta",
			period: ["Jan 2019 – Present", "Jan 2019 – Sekarang"],
			bullets: [
				[
					"Led the 2021 IPO on the Indonesia Stock Exchange, raising IDR 3.4 trillion at the top of the price range.",
					"Memimpin IPO di Bursa Efek Indonesia pada 2021 yang menghimpun Rp3,4 triliun di batas atas rentang harga.",
				],
				[
					"Refinanced USD 1.1 billion of project debt, extending tenor to 12 years and cutting interest cost by 180 bps.",
					"Merefinansiasi utang proyek USD 1,1 miliar; tenor diperpanjang ke 12 tahun dan biaya bunga turun 180 bps.",
				],
				[
					"Set the funding plan for a 1.4 GW pipeline (40% renewable) through green loans and a joint venture.",
					"Menyusun rencana pendanaan pembangkit 1,4 GW (40% terbarukan) lewat pinjaman hijau dan usaha patungan.",
				],
				[
					"Lead finance, tax, treasury and investor relations, 140 people across five subsidiaries.",
					"Memimpin fungsi keuangan, pajak, treasury dan hubungan investor, berisi 140 orang di lima anak perusahaan.",
				],
			],
		},
		{
			company: "PT Sinar Pangan Lestari Tbk",
			position: ["Finance Director", "Direktur Keuangan"],
			location: "Jakarta",
			period: ["Mar 2013 – Dec 2018", "Mar 2013 – Des 2018"],
			bullets: [
				[
					"Led a cost programme across nine plants that saved IDR 640 billion; EBITDA margin rose from 11% to 15%.",
					"Memimpin efisiensi di sembilan pabrik yang menghemat Rp640 miliar; margin EBITDA naik dari 11% ke 15%.",
				],
				[
					"Released IDR 850 billion of working capital and issued the group's first IDR 1.5 trillion bond.",
					"Melepas modal kerja Rp850 miliar dan menerbitkan obligasi pertama grup senilai Rp1,5 triliun.",
				],
			],
		},
		{
			company: "Mahoni Agro Group",
			position: ["Group Treasurer", "Group Treasurer"],
			location: ["Jakarta & Singapore", "Jakarta & Singapura"],
			period: ["Jul 2007 – Feb 2013", "Jul 2007 – Feb 2013"],
			bullets: [
				[
					"Built a central treasury for 22 entities; hedged USD 400 million of annual export revenue.",
					"Membangun treasury terpusat untuk 22 entitas; melakukan hedging atas ekspor USD 400 juta per tahun.",
				],
			],
		},
		{
			company: "KAP Wibowo, Hartanto & Rekan",
			position: ["Auditor to Audit Manager", "Auditor hingga Audit Manager"],
			location: "Jakarta",
			period: ["Sep 2000 – Jun 2005", "Sep 2000 – Jun 2005"],
			bullets: [],
		},
	],
	education: [
		{
			school: "Melbourne Business School, University of Melbourne",
			degree: ["Master of Business Administration", "Master of Business Administration"],
			area: ["Finance & Strategy", "Keuangan & Strategi"],
			location: ["Melbourne, Australia", "Melbourne, Australia"],
			period: "2005 – 2007",
		},
		{
			school: "Universitas Sumatera Utara",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi"],
			area: ["Accounting", "Akuntansi"],
			location: "Medan",
			period: "1996 – 2000",
		},
	],
	volunteer: [
		{
			organization: "Yayasan Beasiswa Toba Cerdas",
			location: "",
			period: ["2016 – Present", "2016 – Sekarang"],
			description: ["Board treasurer; 380 scholarships awarded.", "Bendahara pengurus; 380 beasiswa tersalurkan."],
		},
		{
			organization: "Forum CFO Nusantara",
			location: "",
			period: ["2020 – Present", "2020 – Sekarang"],
			description: ["Advisory board member for energy transition.", "Dewan penasihat bidang transisi energi."],
		},
	],
	certifications: [
		{ title: "Certified Practising Accountant (CPA)", issuer: "CPA Australia", date: "2008" },
		{
			title: ["Chartered Accountant (CA)", "Chartered Accountant (CA)"],
			issuer: "Ikatan Akuntan Indonesia",
			date: "2014",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 0 },
		{ language: ["Batak Toba", "Bahasa Batak Toba"], fluency: ["Native", "Bahasa ibu"], level: 0 },
	],
	titles: { volunteer: ["Board & Advisory Roles", "Peran Dewan & Penasihat"] },
	layout: {
		main: ["summary", "experience", "education", "volunteer"],
		sidebar: ["certifications", "languages"],
	},
	columns: { volunteer: 2, certifications: 2, languages: 3 },
};
