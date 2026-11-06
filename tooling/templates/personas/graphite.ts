import type { Persona } from "./persona";

/** Graphite, the charcoal right sidebar: an engineering manager and former backend engineer at a payments company. */
export const graphite: Persona = {
	name: "Gilang Permana",
	headline: "Engineering Manager · Payments Infrastructure",
	email: "gilang.permana@email.com",
	phone: "+62 811 5558 6903",
	location: "Jakarta, Indonesia",
	website: { url: "https://gilangpermana.dev", label: "gilangpermana.dev" },
	profiles: [
		{ network: "GitHub", username: "gilangpermana", url: "https://github.com/gilangpermana" },
		{ network: "LinkedIn", username: "gilangpermana", url: "https://linkedin.com/in/gilangpermana" },
	],
	summary: [
		"**Engineering manager and former backend engineer with eleven years in fintech**, now leading the teams behind a payment gateway that settles IDR 18 trillion a month. I care about money moving correctly the first time: idempotent APIs, a humane on-call and audits passed without drama. I still review designs and write code when the team needs a hand.",
		"**Engineering manager dan mantan backend engineer dengan sebelas tahun pengalaman di fintech**, kini memimpin tim di balik payment gateway yang menyelesaikan transaksi Rp18 triliun per bulan. Fokus saya adalah uang yang berpindah dengan benar sejak percobaan pertama: API idempoten, on-call yang manusiawi, dan audit yang lolos tanpa drama. Saya masih meninjau desain dan menulis kode saat tim membutuhkan.",
	],
	experience: [
		{
			company: "Bayarloka",
			position: "Engineering Manager, Payments Core",
			location: "Jakarta",
			period: ["Feb 2023 – Present", "Feb 2023 – Sekarang"],
			bullets: [
				[
					"Lead 18 engineers in three squads owning card acquiring, QRIS and merchant settlement; hired eight and promoted three.",
					"Memimpin 18 engineer di tiga squad card acquiring, QRIS, dan settlement merchant; merekrut 8 orang dan mempromosikan 3.",
				],
				[
					"Raised payment API availability from 99.90% to 99.98% and cut monthly incident minutes by 70%.",
					"Menaikkan ketersediaan API pembayaran dari 99,90% menjadi 99,98% dan memangkas menit insiden bulanan 70%.",
				],
				[
					"Took 40 services through PCI DSS 4.0 certification with zero major findings.",
					"Membawa 40 layanan lolos sertifikasi PCI DSS 4.0 tanpa temuan mayor.",
				],
			],
		},
		{
			company: "Bayarloka",
			position: "Senior Backend Engineer",
			location: "Jakarta",
			period: "Mar 2020 – Jan 2023",
			bullets: [
				[
					"Designed a double-entry ledger in Go and PostgreSQL for 2 million transactions a day; reconciliation fell from three days to four hours.",
					"Merancang ledger double-entry dengan Go dan PostgreSQL untuk 2 juta transaksi per hari; rekonsiliasi turun dari tiga hari menjadi empat jam.",
				],
				[
					"Moved settlement batch jobs to Kafka streams; merchants now receive funds the same day instead of T+2.",
					"Memindahkan job batch settlement ke Kafka streams; merchant kini menerima dana di hari yang sama, bukan T+2.",
				],
			],
		},
		{
			company: "Sembada Finance",
			position: "Backend Engineer",
			location: "Jakarta",
			period: ["Aug 2015 – Feb 2020", "Agu 2015 – Feb 2020"],
			bullets: [
				[
					"Built the loan disbursement and repayment APIs in Java for 600,000 borrowers.",
					"Membangun API pencairan dan pembayaran pinjaman dengan Java untuk 600.000 peminjam.",
				],
				[
					"Added a fraud rules engine that blocked IDR 12 billion of suspicious applications in its first year.",
					"Menambahkan mesin aturan fraud yang memblokir pengajuan mencurigakan senilai Rp12 miliar pada tahun pertamanya.",
				],
			],
		},
	],
	education: [
		{
			school: "Telkom University",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Informatics", "Informatika"],
			grade: ["GPA 3.55", "IPK 3,55"],
			location: "Bandung",
			period: "2011 – 2015",
		},
	],
	skills: [
		{ name: "Backend", keywords: ["Go", "Java", "PostgreSQL", "Kafka", "Redis"] },
		{
			name: ["Payments", "Pembayaran"],
			keywords: [["Ledgers & reconciliation", "Ledger & rekonsiliasi"], "ISO 8583", "QRIS", "PCI DSS"],
		},
		{ name: "Platform", keywords: ["Kubernetes", "AWS", "Terraform", "Grafana"] },
		{
			name: ["Leadership", "Kepemimpinan"],
			keywords: [
				["Hiring", "Rekrutmen"],
				["Incident management", "Manajemen insiden"],
				["1:1 coaching", "Coaching 1:1"],
				"OKR",
			],
		},
	],
	certifications: [
		{ title: "AWS Certified Solutions Architect – Professional", issuer: "Amazon Web Services", date: "2022" },
		{ title: "PCI Professional (PCIP)", issuer: "PCI Security Standards Council", date: "2023" },
		{
			title: ["Engineering Leadership Programme", "Program Kepemimpinan Engineering"],
			issuer: "Akademi Engineering Pradipta",
			date: "2024",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Sundanese", "Bahasa Sunda"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["profiles", "skills", "certifications", "languages"],
	},
};
