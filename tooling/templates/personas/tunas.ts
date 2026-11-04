import type { Persona } from "./persona";

/** Tunas, the first-job page: an Information Systems graduate looking for a data analyst role. */
export const tunas: Persona = {
	photo: true,
	name: "Rizky Ramadhan",
	headline: ["Information Systems Graduate · Data Analyst", "Lulusan Sistem Informasi · Data Analyst"],
	email: "rizky.ramadhan@email.com",
	phone: "+62 857 5556 0923",
	location: "Surabaya, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/rizkyramadhan", link: "https://linkedin.com/in/rizkyramadhan" },
		{ icon: "github", text: "github.com/rizkyramadhan", link: "https://github.com/rizkyramadhan" },
	],
	summary: [
		"**Fresh Information Systems graduate looking for a first role as a data or business analyst.** Two internships taught me to clean messy data, build dashboards people actually open and explain the numbers to non-technical teams. Quick learner, comfortable with SQL, Python and Power BI.",
		"**Lulusan baru Sistem Informasi yang mencari posisi pertama sebagai data analyst atau business analyst.** Dua kali magang mengajarkan saya membersihkan data yang berantakan, membuat dasbor yang benar-benar dipakai, dan menjelaskan angka kepada tim non-teknis. Cepat belajar dan terbiasa dengan SQL, Python dan Power BI.",
	],
	education: [
		{
			school: "Institut Teknologi Sepuluh Nopember",
			degree: ["Bachelor of Computer Science", "Sarjana Komputer (S.Kom.)"],
			area: ["Information Systems", "Sistem Informasi"],
			grade: ["GPA 3.68 / 4.00", "IPK 3,68 / 4,00"],
			location: "Surabaya",
			period: ["Aug 2022 – Aug 2026", "Agu 2022 – Agu 2026"],
			description: [
				"Thesis: forecasting weekly demand for 1,200 grocery items with gradient boosting, 14% more accurate than the store's moving average.",
				"Skripsi: peramalan permintaan mingguan 1.200 produk toko kelontong dengan gradient boosting, 14% lebih akurat dari rata-rata bergerak yang dipakai toko.",
			],
		},
	],
	experience: [
		{
			company: "Pasar Raya Daring",
			position: ["Data Analyst Intern", "Data Analyst Intern"],
			location: ["Surabaya (hybrid)", "Surabaya (hybrid)"],
			period: "Feb 2026 – Jul 2026",
			bullets: [
				[
					"Built a Power BI dashboard on seller performance for 3,400 merchants, now reviewed weekly by the category team.",
					"Membuat dasbor Power BI kinerja penjual untuk 3.400 merchant, kini ditinjau setiap pekan oleh tim kategori.",
				],
				[
					"Wrote SQL checks that caught duplicate orders worth IDR 180 million in one quarter.",
					"Menulis query SQL untuk pengecekan data yang menemukan pesanan ganda senilai Rp180 juta dalam satu kuartal.",
				],
				[
					"Presented monthly insights to the category lead; two of my recommendations went into the Q3 promo plan.",
					"Mempresentasikan insight bulanan kepada category lead; dua rekomendasi saya masuk ke rencana promo Q3.",
				],
			],
		},
		{
			company: "PT Samudra Logistik Timur",
			position: ["Business Analyst Intern", "Business Analyst Intern"],
			location: "Surabaya",
			period: "Jul 2025 – Sep 2025",
			bullets: [
				[
					"Mapped the warehouse returns process with 12 staff interviews; the new flow cut handling time by 20%.",
					"Memetakan proses retur gudang lewat wawancara dengan 12 staf; alur baru memangkas waktu penanganan 20%.",
				],
				[
					"Wrote the user requirements for a returns tracking form that IT built in the next sprint.",
					"Menyusun kebutuhan pengguna untuk formulir pelacakan retur yang dibangun tim IT pada sprint berikutnya.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Sales dashboard for small shops", "Dasbor penjualan UMKM"],
			period: "2025",
			description: [
				"Google Sheets and Looker Studio dashboard for 15 food stalls in a campus community programme.",
				"Dasbor Google Sheets dan Looker Studio untuk 15 kedai makanan dalam program pengabdian masyarakat kampus.",
			],
		},
		{
			name: ["Public transport ridership analysis", "Analisis penumpang angkutan kota"],
			period: "2024",
			description: [
				"Python analysis of 2 million open-data trips; placed 2nd of 48 teams in a campus data competition.",
				"Analisis Python atas 2 juta data perjalanan terbuka; juara 2 dari 48 tim dalam kompetisi data kampus.",
			],
		},
	],
	volunteer: [
		{
			organization: "Himpunan Mahasiswa Sistem Informasi",
			location: "Surabaya",
			period: "2023 – 2024",
			description: [
				"Head of Research & Data: ran a student survey of 900 respondents and a free SQL class for 120 juniors.",
				"Kepala Divisi Riset & Data: menjalankan survei 900 mahasiswa dan kelas SQL gratis untuk 120 adik tingkat.",
			],
		},
	],
	certifications: [
		{ title: "Google Data Analytics Professional Certificate", issuer: "Google", date: "2025" },
		{ title: "Power BI Data Analyst Associate", issuer: "Microsoft", date: "2026" },
	],
	skills: [
		{ name: "Data", keywords: ["SQL", "Python (pandas)", "Excel"] },
		{ name: ["Visualisation", "Visualisasi"], keywords: ["Power BI", "Looker Studio", "Tableau"] },
		{
			name: ["Analysis", "Analisis"],
			keywords: [["Process mapping", "Pemetaan proses"], ["Forecasting", "Peramalan"], "A/B testing"],
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Good (TOEFL ITP 583)", "Baik (TOEFL ITP 583)"], level: 3 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 5 },
	],
	titles: { volunteer: ["Campus Organisation", "Organisasi Kampus"] },
	layout: {
		main: ["summary", "education", "experience", "projects", "volunteer"],
		sidebar: ["certifications", "skills", "languages"],
	},
	columns: { projects: 2, certifications: 2, skills: 3, languages: 3 },
};
