import type { Persona } from "./persona";

/** Cobalt, the executive formal page: the head of tax compliance at a state-owned energy company. */
export const cobalt: Persona = {
	name: "Yohana Latuheru",
	headline: ["Head of Tax Compliance · Tax Audit & Governance", "Kepala Kepatuhan Pajak · Audit & Tata Kelola Pajak"],
	email: "yohana.latuheru@email.com",
	phone: "+62 812 5558 2741",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/yohanalatuheru", link: "https://linkedin.com/in/yohanalatuheru" },
	],
	summary: [
		"**Tax professional with 14 years in tax audit and compliance** for energy and resources groups, now heading tax compliance at a state-owned energy company with Rp 96 trillion in annual revenue. I keep filings clean across 23 subsidiaries, defend audits on the facts and give the board a clear view of tax risk.",
		"**Profesional perpajakan dengan 14 tahun pengalaman di audit dan kepatuhan pajak** untuk grup energi dan sumber daya alam, kini memimpin kepatuhan pajak di BUMN energi dengan pendapatan Rp 96 triliun per tahun. Saya menjaga kepatuhan 23 anak perusahaan, menghadapi pemeriksaan dengan data yang kuat, dan memberi direksi gambaran risiko pajak yang jelas.",
	],
	experience: [
		{
			company: "PT Arkana Energi (Persero)",
			position: ["Head of Tax Compliance", "Kepala Divisi Kepatuhan Pajak"],
			location: "Jakarta",
			period: ["Jan 2021 – Present", "Jan 2021 – Sekarang"],
			bullets: [
				[
					"Lead a team of 16 on corporate income tax, VAT and withholding for the holding and 23 subsidiaries; no late filings in four years.",
					"Memimpin tim 16 orang untuk PPh Badan, PPN dan PPh potong pungut di induk dan 23 anak perusahaan; tanpa keterlambatan pelaporan selama empat tahun.",
				],
				[
					"Handled 9 tax audits and 4 objections; cut proposed assessments by Rp 1.4 trillion, 71% of the original corrections.",
					"Menangani 9 pemeriksaan dan 4 keberatan pajak; nilai koreksi berhasil ditekan Rp 1,4 triliun atau 71% dari koreksi awal.",
				],
			],
		},
		{
			company: "PT Arkana Energi (Persero)",
			position: ["Senior Tax Auditor, Internal Audit", "Auditor Pajak Senior, Satuan Pengawasan Intern"],
			location: "Jakarta",
			period: ["Mar 2017 – Dec 2020", "Mar 2017 – Des 2020"],
			bullets: [
				[
					"Audited the tax positions of 15 subsidiaries a year; recovered Rp 230 billion in overpaid VAT through refund claims.",
					"Mengaudit posisi pajak 15 anak perusahaan setiap tahun; memulihkan kelebihan bayar PPN Rp 230 miliar lewat permohonan restitusi.",
				],
				[
					"Wrote the group tax audit manual, adopted as internal audit’s standard from 2019.",
					"Menyusun pedoman audit pajak grup yang menjadi standar Satuan Pengawasan Intern sejak 2019.",
				],
			],
		},
		{
			company: "Wangsa Prasaja Tax Consulting",
			position: ["Tax Consultant, then Senior Consultant", "Konsultan Pajak, lalu Konsultan Senior"],
			location: "Jakarta",
			period: ["Aug 2012 – Feb 2017", "Agu 2012 – Feb 2017"],
			bullets: [
				[
					"Handled compliance and audit assistance for 25 clients in mining, oil and gas services and plantations.",
					"Menangani kepatuhan dan pendampingan pemeriksaan untuk 25 klien pertambangan, jasa migas dan perkebunan.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Trisakti",
			degree: ["Master of Accounting", "Magister Akuntansi (M.Ak.)"],
			area: ["Taxation", "Perpajakan"],
			grade: ["GPA 3.86", "IPK 3,86"],
			location: "Jakarta",
			period: "2015 – 2017",
		},
		{
			school: "Universitas Pattimura",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi (S.E.)"],
			area: ["Accounting", "Akuntansi"],
			grade: ["GPA 3.71", "IPK 3,71"],
			location: "Ambon",
			period: "2008 – 2012",
		},
	],
	certifications: [
		{
			title: ["Tax Consultant Certificate, Level C", "Sertifikat Konsultan Pajak Tingkat C"],
			issuer: "PPSKP",
			date: "2016",
		},
		{ title: "Chartered Accountant (CA)", issuer: "Ikatan Akuntan Indonesia", date: "2018" },
		{ title: "Certified Internal Auditor (CIA)", issuer: "The Institute of Internal Auditors", date: "2019" },
		{
			title: "Advanced Diploma in International Taxation (ADIT)",
			issuer: "Chartered Institute of Taxation",
			date: "2022",
		},
	],
	skills: [
		{
			name: ["Tax", "Perpajakan"],
			keywords: [
				["Corporate income tax", "PPh Badan"],
				"PPN",
				"Transfer pricing",
				["Audits & objections", "Pemeriksaan & keberatan"],
			],
		},
		{
			name: ["Governance", "Tata kelola"],
			keywords: [["Tax risk management", "Manajemen risiko pajak"], "COSO", ["Board reporting", "Pelaporan direksi"]],
		},
		{ name: ["Systems", "Sistem"], keywords: ["SAP S/4HANA", "Coretax", "IDEA", "Power BI"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
		{ language: ["Ambonese Malay", "Bahasa Melayu Ambon"], fluency: ["Native", "Bahasa ibu"], level: 5 },
	],
	columns: { certifications: 2, skills: 3, languages: 3 },
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["certifications", "skills", "languages"],
	},
};
