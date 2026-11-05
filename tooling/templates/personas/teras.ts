import type { Persona } from "./persona";

/** Teras, the friendly formal page: a fresh accounting graduate applying for a state-owned company's trainee programme. */
export const teras: Persona = {
	name: "Ni Made Ayu Pradnyani",
	headline: ["Accounting Graduate · Management Trainee Candidate", "Lulusan Akuntansi · Calon Management Trainee"],
	email: "made.pradnyani@email.com",
	phone: "+62 819 5550 7416",
	location: "Denpasar, Bali",
	details: [
		{
			icon: "",
			label: ["Place and date of birth", "Tempat, tanggal lahir"],
			text: ["Gianyar, 9 March 2004", "Gianyar, 9 Maret 2004"],
		},
		{ icon: "", label: ["Gender", "Jenis kelamin"], text: ["Female", "Perempuan"] },
		{ icon: "linkedin-02", text: "linkedin.com/in/madepradnyani", link: "https://linkedin.com/in/madepradnyani" },
	],
	summary: [
		"**Accounting graduate (GPA 3.82) ready to start a career in a state-owned enterprise.** A six-month audit internship taught me to test transactions, read financial statements and keep working papers tidy on deadline. Careful, honest and used to leading teams, from a student association’s treasury to tax-filing help for small businesses.",
		"**Lulusan Akuntansi (IPK 3,82) yang siap memulai karier di Badan Usaha Milik Negara.** Magang audit selama enam bulan melatih saya menguji transaksi, membaca laporan keuangan dan menyusun kertas kerja yang rapi meski dikejar tenggat. Teliti, jujur, dan terbiasa memimpin tim, dari bendahara himpunan mahasiswa hingga pendampingan pelaporan pajak UMKM.",
	],
	education: [
		{
			school: "Universitas Udayana",
			degree: ["Bachelor of Accounting", "Sarjana Akuntansi (S.Ak.)"],
			area: ["Accounting", "Akuntansi"],
			grade: ["GPA 3.82 / 4.00, cum laude", "IPK 3,82 / 4,00, cum laude"],
			location: "Denpasar",
			period: ["Aug 2022 – Jul 2026", "Agu 2022 – Jul 2026"],
		},
	],
	experience: [
		{
			company: "KAP Adnyana, Suputra & Rekan",
			position: ["Audit Intern (MBKM programme)", "Magang Auditor (program MBKM)"],
			location: "Denpasar",
			period: ["Feb 2025 – Jul 2025", "Feb 2025 – Jul 2025"],
			bullets: [
				[
					"Tested 600+ sales and purchase transactions for 5 clients in hospitality, retail and cooperatives.",
					"Menguji lebih dari 600 transaksi penjualan dan pembelian untuk 5 klien perhotelan, ritel dan koperasi.",
				],
				[
					"Prepared fixed-asset and receivables working papers; found Rp 85 million in unrecorded depreciation at a hotel client.",
					"Menyusun kertas kerja aset tetap dan piutang; menemukan penyusutan yang belum dicatat senilai Rp 85 juta di klien hotel.",
				],
			],
		},
		{
			company: "Universitas Udayana",
			position: ["Teaching Assistant, Introduction to Accounting", "Asisten Dosen Pengantar Akuntansi"],
			location: "Denpasar",
			period: ["Aug 2024 – Jan 2025", "Agu 2024 – Jan 2025"],
			bullets: [
				[
					"Ran weekly tutorials for 90 first-year students and marked 350 assignments in one semester.",
					"Membimbing tutorial mingguan untuk 90 mahasiswa tahun pertama dan memeriksa 350 tugas dalam satu semester.",
				],
			],
		},
	],
	volunteer: [
		{
			organization: "Himpunan Mahasiswa Akuntansi",
			location: "Denpasar",
			period: "2024 – 2025",
			description: [
				"Treasurer: managed a Rp 210 million budget for 14 events and closed the term with no internal audit findings.",
				"Bendahara Umum: mengelola anggaran Rp 210 juta untuk 14 kegiatan dan menutup masa kepengurusan tanpa temuan audit internal.",
			],
		},
		{
			organization: "Klinik Pajak Mahasiswa Bali",
			location: "Denpasar",
			period: "2024 – 2025",
			description: [
				"Volunteer: helped 140 small-business owners file their annual tax returns online during two filing seasons.",
				"Relawan: membantu 140 pelaku UMKM melaporkan SPT Tahunan secara daring selama dua musim pelaporan.",
			],
		},
	],
	skills: [
		{
			name: ["Accounting", "Akuntansi"],
			keywords: ["PSAK", ["Financial statements", "Laporan keuangan"], ["Reconciliation", "Rekonsiliasi"]],
		},
		{ name: ["Tax", "Perpajakan"], keywords: ["PPh 21", "PPN", "e-Faktur", "Coretax"] },
		{ name: ["Tools", "Perangkat"], keywords: ["Excel", "Accurate Online", "Google Sheets"] },
	],
	certifications: [
		{ title: ["Tax Brevet A & B", "Brevet Pajak A & B"], issuer: "Ikatan Akuntan Indonesia", date: "2025" },
		{ title: "Microsoft Office Specialist: Excel Associate", issuer: "Microsoft", date: "2024" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Balinese", "Bahasa Bali"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Good (TOEFL ITP 567)", "Baik (TOEFL ITP 567)"], level: 3 },
	],
	awards: [
		{
			title: ["1st place, National Student Accounting Olympiad", "Juara 1, Olimpiade Akuntansi Mahasiswa Nasional"],
			awarder: "Forum Akuntan Muda Indonesia",
			date: "2025",
		},
		{
			title: ["Academic Excellence Scholarship", "Beasiswa Prestasi Akademik"],
			awarder: "Yayasan Dharma Swadana Bali",
			date: "2023 – 2026",
		},
	],
	titles: { volunteer: ["Organisations", "Pengalaman Organisasi"] },
	columns: { volunteer: 2, skills: 3, certifications: 2, languages: 3, awards: 2 },
	layout: {
		main: ["summary", "education", "experience", "volunteer"],
		sidebar: ["skills", "certifications", "languages", "awards"],
	},
};
