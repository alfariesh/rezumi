import type { Persona } from "./persona";

/** Horizon: the head of data analytics at an e-commerce marketplace in Jakarta. */
export const horizon: Persona = {
	photo: true,
	name: "Raka Mahendra",
	headline: "Head of Data Analytics · E-commerce",
	email: "raka.mahendra@email.com",
	phone: "+62 811 5553 2690",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/rakamahendra", link: "https://linkedin.com/in/rakamahendra" },
		{ icon: "github", text: "github.com/rakamahendra", link: "https://github.com/rakamahendra" },
	],
	summary: [
		"**Analytics leader with twelve years in banking, logistics and e-commerce.** I build teams that answer the questions behind revenue: which promotions pay back, where demand is heading and what a change is really worth. I now run analytics for a marketplace of 9 million monthly buyers.",
		"**Pemimpin analitik berpengalaman dua belas tahun di perbankan, logistik, dan e-commerce.** Saya membangun tim yang menjawab pertanyaan di balik pendapatan: promo mana yang untung, ke mana arah permintaan, dan berapa nilai sebuah perubahan. Kini saya memimpin analitik marketplace berisi 9 juta pembeli bulanan.",
	],
	experience: [
		{
			company: "Seranta",
			position: "Head of Data Analytics",
			location: "Jakarta",
			period: ["Apr 2022 – Present", "Apr 2022 – Sekarang"],
			bullets: [
				[
					"Lead 24 analysts and analytics engineers; grew the team from nine in 2022.",
					"Memimpin tim 24 analis dan analytics engineer, dari semula 9 orang.",
				],
				[
					"Built a shared metrics layer on dbt and BigQuery, used by 1,800 people a week; cut warehouse query costs by 46%.",
					"Membangun lapisan metrik bersama di dbt dan BigQuery yang dipakai 1.800 orang per minggu; menekan biaya kueri 46%.",
				],
				[
					"Launched an experimentation platform running 220 tests a year, credited with IDR 310 billion in extra GMV in 2025.",
					"Meluncurkan platform eksperimen dengan 220 uji per tahun, yang menyumbang tambahan GMV Rp310 miliar pada 2025.",
				],
			],
		},
		{
			company: "Seranta",
			position: "Analytics Lead, Marketplace",
			location: "Jakarta",
			period: ["Jan 2020 – Mar 2022", "Jan 2020 – Mar 2022"],
			bullets: [
				[
					"Shipped seller-level demand forecasts; stock-outs fell by 23%.",
					"Merilis prakiraan permintaan per seller; kasus stok habis turun 23%.",
				],
				[
					"Designed the promo ROI model that allocates IDR 90 billion a quarter.",
					"Merancang model ROI promosi untuk alokasi voucher Rp90 miliar per kuartal.",
				],
			],
		},
		{
			company: "Jalur Kirim",
			position: "Senior Data Analyst",
			location: "Jakarta",
			period: ["Jun 2016 – Dec 2019", "Jun 2016 – Des 2019"],
			bullets: [
				[
					"Built a delivery-time model for 140 hubs; late parcels fell by 18%.",
					"Membangun model waktu kirim untuk 140 hub; paket terlambat turun 18%.",
				],
				[
					"Automated 35 weekly reports, saving regional teams 60 hours a week.",
					"Mengotomatiskan 35 laporan mingguan; tim wilayah hemat 60 jam per minggu.",
				],
			],
		},
		{
			company: "Bank Cakrawala Nusantara",
			position: "Data Analyst, Credit Risk",
			location: "Jakarta",
			period: ["Aug 2013 – May 2016", "Agu 2013 – Mei 2016"],
			bullets: [
				[
					"Built an early-warning scorecard for 1.2 million credit cards; 30-day arrears fell by 0.8 percentage points.",
					"Membangun scorecard peringatan dini untuk 1,2 juta kartu kredit; tunggakan 30 hari turun 0,8 poin persentase.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Smart voucher allocation", "Alokasi voucher cerdas"],
			period: "2024",
			description: [
				"Uplift model that targets vouchers at buyers who would not order otherwise; same GMV on 28% less promo spend.",
				"Model uplift yang mengarahkan voucher ke pembeli yang tidak akan berbelanja tanpa promo; GMV sama dengan biaya promo 28% lebih hemat.",
			],
		},
		{
			name: ["Analytics Academy", "Analytics Academy"],
			period: "2023 – 2025",
			description: [
				"Internal SQL and dashboard course; 420 product, marketing and operations staff certified in self-serve analysis.",
				"Kursus internal SQL dan dasbor; 420 staf produk, pemasaran, dan operasional lulus sertifikasi analisis mandiri.",
			],
		},
	],
	education: [
		{
			school: "IPB University",
			degree: ["Bachelor of Statistics", "Sarjana Statistika (S.Stat.)"],
			area: ["Statistics", "Statistika"],
			grade: ["GPA 3.64", "IPK 3,64"],
			location: "Bogor",
			period: "2009 – 2013",
		},
	],
	skills: [
		{
			name: ["Analytics", "Analitik"],
			keywords: [
				["Experimentation", "Eksperimen"],
				["Causal inference", "Inferensi kausal"],
				["Forecasting", "Prakiraan"],
				["Segmentation", "Segmentasi"],
			],
		},
		{
			name: ["Data science", "Data science"],
			keywords: [
				["Uplift models", "Model uplift"],
				["Time series", "Deret waktu"],
				["Credit scoring", "Credit scoring"],
			],
		},
		{
			name: ["Leadership", "Kepemimpinan"],
			keywords: [
				["Hiring", "Rekrutmen"],
				"OKR",
				["Coaching", "Coaching"],
				["Stakeholder management", "Manajemen pemangku kepentingan"],
			],
		},
		{ name: "Tools", keywords: ["SQL", "Python", "dbt", "BigQuery", "Airflow", "Looker", "Tableau"] },
	],
	certifications: [
		{ title: "Google Cloud Professional Data Engineer", issuer: "Google Cloud", date: "2021" },
		{ title: "dbt Analytics Engineering Certification", issuer: "dbt Labs", date: "2023" },
		{
			title: ["Data-Driven Leadership", "Kepemimpinan Berbasis Data"],
			issuer: "Akademi Manajemen Nusantara",
			date: "2024",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "certifications", "languages"],
	},
};
