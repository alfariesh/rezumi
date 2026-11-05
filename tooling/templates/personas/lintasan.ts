import type { Persona } from "./persona";

/** Lintasan, the timeline: a junior data analyst and statistics graduate at a grocery delivery app in Jakarta. */
export const lintasan: Persona = {
	name: "Nurul Ainun Rahim",
	headline: ["Junior Data Analyst · Statistics Graduate", "Junior Data Analyst · Lulusan Statistika"],
	email: "nurul.rahim@email.com",
	phone: "+62 857 5559 2164",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/nurulainunrahim", link: "https://linkedin.com/in/nurulainunrahim" },
		{ icon: "github", text: "github.com/nurulrahim", link: "https://github.com/nurulrahim" },
	],
	summary: [
		"**Statistics graduate and junior data analyst with 18 months of hands-on work** in quick commerce, insurance and survey research. I write clean SQL, build dashboards teams open every week and check each number before it reaches a slide. I am now growing into experimentation and forecasting.",
		"**Lulusan statistika dan junior data analyst dengan pengalaman kerja 18 bulan** di quick commerce, asuransi, dan riset survei. Saya menulis SQL yang rapi, membangun dasbor yang dibuka tim setiap minggu, dan memeriksa setiap angka sebelum masuk ke presentasi. Kini saya mendalami eksperimen dan peramalan.",
	],
	experience: [
		{
			company: "Segar Kilat",
			position: "Junior Data Analyst",
			location: "Jakarta (hybrid)",
			period: ["Jun 2025 – Present", "Jun 2025 – Sekarang"],
			bullets: [
				[
					"Built a daily stock-out dashboard in Looker Studio for 62 dark stores; lost sales fell by 11% in two quarters.",
					"Membangun dasbor stok habis harian di Looker Studio untuk 62 dark store; penjualan yang hilang turun 11% dalam dua kuartal.",
				],
				[
					"Analysed 14 promo A/B tests with the growth team and stopped two campaigns costing IDR 420 million a month with no lift.",
					"Menganalisis 14 uji A/B promo bersama tim growth dan menghentikan dua kampanye senilai Rp420 juta per bulan yang tidak menaikkan pesanan.",
				],
			],
		},
		{
			company: "Asuransi Teduh Sentosa",
			position: "Data Analyst Intern",
			location: "Jakarta",
			period: ["Aug 2024 – Jan 2025", "Agu 2024 – Jan 2025"],
			bullets: [
				[
					"Cleaned 300,000 health-claim records and flagged 1,900 likely duplicates for review.",
					"Membersihkan 300.000 data klaim kesehatan dan menandai 1.900 klaim yang diduga ganda untuk ditinjau.",
				],
			],
		},
		{
			company: "Lembaga Survei Arah Publik",
			position: ["Research Intern", "Research Intern"],
			location: "Makassar",
			period: ["Jun 2023 – Aug 2023", "Jun 2023 – Agu 2023"],
			bullets: [
				[
					"Weighted and analysed a household survey of 1,200 respondents in R for a city transport report.",
					"Melakukan pembobotan dan analisis survei rumah tangga 1.200 responden dengan R untuk laporan transportasi kota.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Hasanuddin",
			degree: ["Bachelor of Statistics", "Sarjana Statistika (S.Stat.)"],
			area: ["Statistics", "Statistika"],
			grade: ["GPA 3.74 / 4.00, cum laude", "IPK 3,74 / 4,00, cum laude"],
			location: "Makassar",
			period: ["Aug 2021 – Mar 2025", "Agu 2021 – Mar 2025"],
		},
	],
	projects: [
		{
			name: ["Jakarta air quality forecast", "Prakiraan kualitas udara Jakarta"],
			period: "2025",
			description: [
				"Python and Streamlit app on two years of open sensor data; forecasts PM2.5 a day ahead within 9 µg/m³.",
				"Aplikasi Python dan Streamlit dari data sensor terbuka dua tahun; memprakirakan PM2,5 sehari ke depan dengan galat 9 µg/m³.",
			],
		},
		{
			name: ["Market food price dashboard", "Dasbor harga pangan pasar"],
			period: "2024",
			description: [
				"Tableau Public dashboard of weekly rice, chilli and egg prices in 35 Makassar markets; 3,000+ views.",
				"Dasbor Tableau Public untuk harga mingguan beras, cabai, dan telur di 35 pasar Makassar; dilihat lebih dari 3.000 kali.",
			],
		},
	],
	skills: [
		{ name: "Data", keywords: ["SQL", "Python (pandas)", "BigQuery"] },
		{
			name: ["Statistics", "Statistika"],
			keywords: [["Regression", "Regresi"], "A/B testing", ["Survey weighting", "Pembobotan survei"]],
		},
		{ name: ["Visualisation", "Visualisasi"], keywords: ["Looker Studio", "Tableau", "R (ggplot2)"] },
	],
	certifications: [
		{ title: "Tableau Desktop Specialist", issuer: "Tableau", date: "2024" },
		{ title: "Google Cloud Certified Associate Data Practitioner", issuer: "Google Cloud", date: "2026" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{
			language: ["English", "Bahasa Inggris"],
			fluency: ["Professional (IELTS 7.0)", "Profesional (IELTS 7,0)"],
			level: 4,
		},
		{ language: ["Buginese", "Bahasa Bugis"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	layout: {
		main: ["summary", "experience", "education", "projects"],
		sidebar: ["skills", "certifications", "languages"],
	},
	columns: { projects: 2, skills: 3, certifications: 2, languages: 3 },
};
