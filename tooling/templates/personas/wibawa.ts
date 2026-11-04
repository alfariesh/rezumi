import type { Persona } from "./persona";

/** Wibawa, the formal Indonesian CV: an accountant applying to a state-owned company. */
export const wibawa: Persona = {
	photo: true,
	name: "Dimas Prasetyo",
	headline: ["Senior Accounting Staff · Finance & Tax", "Staf Akuntansi Senior · Keuangan & Pajak"],
	email: "dimas.prasetyo@email.com",
	phone: "+62 815 5550 3962",
	location: ["Semarang, Central Java", "Semarang, Jawa Tengah"],
	details: [
		{
			icon: "",
			label: ["Place and date of birth", "Tempat, tanggal lahir"],
			text: ["Semarang, 14 May 1995", "Semarang, 14 Mei 1995"],
		},
		{ icon: "", label: ["Gender", "Jenis kelamin"], text: ["Male", "Laki-laki"] },
		{ icon: "", label: ["Marital status", "Status"], text: ["Married", "Menikah"] },
		{ icon: "", label: ["Nationality", "Kewarganegaraan"], text: ["Indonesian", "Indonesia"] },
	],
	summary: [
		"**Accountant with nine years in audit and corporate finance**, now running closing and tax for a steel maker with Rp 640 billion in annual revenue. Careful, fluent in SAP and Excel, and ready to serve a state-owned enterprise.",
		"**Akuntan dengan sembilan tahun pengalaman di audit dan keuangan perusahaan**, kini menangani tutup buku dan pajak untuk produsen baja beromzet Rp 640 miliar per tahun. Teliti, mahir SAP dan Excel, serta siap berkontribusi di BUMN.",
	],
	experience: [
		{
			company: "PT Sinar Baja Nusantara",
			position: ["Senior Accounting Staff", "Staf Akuntansi Senior"],
			location: "Semarang",
			period: ["Jan 2023 – Present", "Jan 2023 – Sekarang"],
			bullets: [
				[
					"Lead month-end closing for three business units; cut closing time from 12 to 6 working days.",
					"Memimpin tutup buku bulanan untuk tiga unit bisnis; mempercepat proses dari 12 menjadi 6 hari kerja.",
				],
				[
					"Prepare monthly VAT and withholding tax returns (PPN, PPh 21, 23 and 4(2)) with zero late filings in two years.",
					"Menyusun SPT Masa PPN serta PPh 21, 23 dan 4(2) setiap bulan tanpa satu pun keterlambatan dalam dua tahun.",
				],
			],
		},
		{
			company: "PT Sinar Baja Nusantara",
			position: ["Accounting Staff", "Staf Akuntansi"],
			location: "Semarang",
			period: ["Aug 2020 – Dec 2022", "Agu 2020 – Des 2022"],
			bullets: [
				[
					"Reconciled 14 bank accounts and supplier ledgers each month; cleared Rp 2.3 billion in long-unmatched items.",
					"Merekonsiliasi 14 rekening bank dan buku besar pemasok setiap bulan; menuntaskan selisih lama senilai Rp 2,3 miliar.",
				],
			],
		},
		{
			company: "KAP Hartono, Wijaya & Rekan",
			position: ["Junior Auditor", "Auditor Junior"],
			location: "Semarang",
			period: ["Sep 2017 – Jul 2020", "Sep 2017 – Jul 2020"],
			bullets: [
				[
					"Audited 20+ clients in manufacturing, trading and cooperatives; drafted working papers and management letters.",
					"Mengaudit lebih dari 20 klien manufaktur, dagang dan koperasi; menyusun kertas kerja dan management letter.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Diponegoro",
			degree: ["Bachelor of Accounting", "Sarjana Akuntansi (S.Ak.)"],
			area: ["Accounting", "Akuntansi"],
			grade: ["GPA 3.58", "IPK 3,58"],
			location: "Semarang",
			period: "2013 – 2017",
			description: [
				"Thesis: The effect of tax planning on earnings management in listed manufacturing companies.",
				"Skripsi: Pengaruh perencanaan pajak terhadap manajemen laba pada perusahaan manufaktur yang terdaftar di bursa.",
			],
		},
	],
	volunteer: [
		{
			organization: "Gerakan Melek Keuangan Semarang",
			location: "",
			period: ["2019 – Present", "2019 – Sekarang"],
			description: [
				"Volunteer trainer: teach household bookkeeping to small traders; 300+ participants in 25 sessions.",
				"Relawan pengajar: melatih pembukuan sederhana untuk pedagang kecil; lebih dari 300 peserta dalam 25 sesi.",
			],
		},
	],
	certifications: [
		{ title: ["Tax Brevet A & B", "Brevet Pajak A & B"], issuer: "Lembaga Pendidikan Pajak Nusantara", date: "2019" },
		{ title: "MOS Excel Expert", issuer: "Microsoft", date: "2021" },
		{
			title: ["SAP Finance for End Users", "SAP Finance untuk Pengguna"],
			issuer: "Akademi Sistem Bisnis Semarang",
			date: "2022",
		},
	],
	skills: [
		{
			name: ["Accounting", "Akuntansi"],
			keywords: [["Month-end closing", "Tutup buku"], "PSAK", ["Reconciliation", "Rekonsiliasi"]],
		},
		{ name: ["Tax", "Perpajakan"], keywords: ["PPN", "PPh 21/23", "e-Faktur", "e-Bupot"] },
		{ name: ["Tools", "Perangkat"], keywords: ["SAP S/4HANA", "Accurate", "Excel", "Power BI"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{
			language: ["English", "Bahasa Inggris"],
			fluency: ["Intermediate (TOEFL ITP 553)", "Menengah (TOEFL ITP 553)"],
			level: 0,
		},
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 0 },
	],
	titles: { volunteer: ["Organisations", "Pengalaman Organisasi"] },
	columns: { certifications: 3, skills: 3, languages: 3 },
	layout: {
		main: ["summary", "experience", "education", "volunteer", "certifications"],
		sidebar: ["skills", "languages"],
	},
};
