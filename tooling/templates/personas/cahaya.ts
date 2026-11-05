import type { Persona } from "./persona";

/** Cahaya: a cloud solutions architect who leads the data platform and BI at an insurance group in Jakarta. */
export const cahaya: Persona = {
	name: "Michael Rumengan",
	headline: ["Cloud Solutions Architect · Data Platform & BI", "Cloud Solutions Architect · Platform Data & BI"],
	email: "michael.rumengan@email.com",
	phone: "+62 811 5559 3174",
	location: "Jakarta, Indonesia",
	profiles: [
		{ network: "LinkedIn", username: "michaelrumengan", url: "https://linkedin.com/in/michaelrumengan" },
		{ network: "GitHub", username: "mrumengan", url: "https://github.com/mrumengan" },
	],
	summary: [
		"**Cloud and data architect who moves regulated financial workloads to the cloud without failing an audit.** Thirteen years in banking and insurance, the last four leading the data platform and BI for a group of four insurers. I design for cost, security and OJK compliance first, then make the data easy for 2,000 business users to trust.",
		"**Arsitek cloud dan data yang memindahkan beban kerja keuangan teregulasi ke cloud tanpa gagal audit.** Tiga belas tahun di perbankan dan asuransi, empat tahun terakhir memimpin platform data dan BI untuk grup berisi empat perusahaan asuransi. Saya merancang dengan mengutamakan biaya, keamanan, dan kepatuhan OJK, lalu membuat data mudah dipercaya oleh 2.000 pengguna bisnis.",
	],
	experience: [
		{
			company: "Lindung Sejahtera Financial Group",
			position: ["Head of Data Platform & BI", "Head of Data Platform & BI"],
			location: "Jakarta",
			period: ["Mar 2022 – Present", "Mar 2022 – Sekarang"],
			bullets: [
				[
					"Lead 16 data engineers and BI developers serving four life and general insurers with 3.2 million policyholders.",
					"Memimpin 16 data engineer dan BI developer untuk empat perusahaan asuransi jiwa dan umum dengan 3,2 juta pemegang polis.",
				],
				[
					"Moved 140 TB from on-premise Oracle and Teradata to a lakehouse on Azure; infrastructure costs fell by 38%.",
					"Memindahkan 140 TB data dari Oracle dan Teradata on-premise ke lakehouse di Azure; biaya infrastruktur turun 38%.",
				],
				[
					"Replaced 900 spreadsheet reports with 60 governed Power BI dashboards; month-end close went from nine days to four.",
					"Mengganti 900 laporan spreadsheet dengan 60 dasbor Power BI yang terkelola; tutup buku bulanan dari sembilan hari menjadi empat.",
				],
			],
		},
		{
			company: "Lindung Sejahtera Financial Group",
			position: ["Cloud Solutions Architect", "Cloud Solutions Architect"],
			location: "Jakarta",
			period: ["Jan 2019 – Feb 2022", "Jan 2019 – Feb 2022"],
			bullets: [
				[
					"Designed the group’s landing zone on Azure and AWS; passed OJK and ISO 27001 audits with no major findings.",
					"Merancang landing zone grup di Azure dan AWS; lolos audit OJK dan ISO 27001 tanpa temuan mayor.",
				],
				[
					"Led the migration of 41 claims and policy applications, with 99.95% uptime after cut-over.",
					"Memimpin migrasi 41 aplikasi klaim dan polis dengan uptime 99,95% setelah peralihan.",
				],
				[
					"Introduced FinOps tagging and budgets that saved IDR 7.2 billion in cloud spend in two years.",
					"Menerapkan tagging dan anggaran FinOps yang menghemat biaya cloud Rp7,2 miliar dalam dua tahun.",
				],
			],
		},
		{
			company: "Bank Tirta Harapan",
			position: ["Senior BI Developer", "Senior BI Developer"],
			location: "Jakarta",
			period: ["Jul 2013 – Dec 2018", "Jul 2013 – Des 2018"],
			bullets: [
				[
					"Built the bank’s first enterprise data warehouse for 1.8 million retail customers, feeding 120 regulatory and management reports.",
					"Membangun data warehouse perusahaan pertama bank untuk 1,8 juta nasabah ritel, sumber 120 laporan regulator dan manajemen.",
				],
				[
					"Automated monthly OJK reporting; preparation time fell from six days to one.",
					"Mengotomatiskan pelaporan bulanan ke OJK; waktu penyusunan turun dari enam hari menjadi satu.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Indonesia",
			degree: ["Master of Information Technology", "Magister Teknologi Informasi (M.T.I.)"],
			area: ["Information Technology", "Teknologi Informasi"],
			location: "Jakarta",
			period: "2016 – 2018",
		},
		{
			school: "Universitas Sam Ratulangi",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Informatics Engineering", "Teknik Informatika"],
			grade: ["GPA 3.61", "IPK 3,61"],
			location: "Manado",
			period: "2009 – 2013",
		},
	],
	skills: [
		{ name: "Cloud", keywords: ["Azure", "AWS", "Terraform", "Kubernetes"] },
		{ name: ["Data platform", "Platform data"], keywords: ["Databricks", "Spark", "Delta Lake", "Data Factory"] },
		{ name: "BI", keywords: ["Power BI", "SQL", "DAX", ["Data modelling", "Pemodelan data"]] },
		{
			name: ["Governance", "Tata kelola"],
			keywords: [["Data governance", "Tata kelola data"], "ISO 27001", ["OJK reporting", "Pelaporan OJK"], "FinOps"],
		},
	],
	certifications: [
		{ title: "Azure Solutions Architect Expert", issuer: "Microsoft", date: "2021" },
		{ title: "AWS Certified Solutions Architect – Professional", issuer: "Amazon Web Services", date: "2022" },
		{ title: "Databricks Certified Data Engineer Professional", issuer: "Databricks", date: "2024" },
		{ title: "TOGAF Enterprise Architecture Foundation", issuer: "The Open Group", date: "2020" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Manado Malay", "Bahasa Manado"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 5 },
	],
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "certifications", "languages", "profiles"],
	},
};
