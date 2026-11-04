import type { Persona } from "./persona";

/** Atlas, the Swiss grid: a senior UX researcher and product designer at a Bandung tech company. */
export const atlas: Persona = {
	name: "Bima Aditya Nugroho",
	headline: "Senior UX Researcher · Product Design",
	email: "bima.nugroho@email.com",
	phone: "+62 822 5554 3186",
	location: "Bandung, Indonesia",
	website: { url: "https://bimaaditya.design", label: "bimaaditya.design" },
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/bimaaditya", link: "https://linkedin.com/in/bimaaditya" },
		{ icon: "dribbble", text: "dribbble.com/bimaaditya", link: "https://dribbble.com/bimaaditya" },
	],
	summary: [
		"**UX researcher and product designer with eight years in consumer and agricultural apps.** I plan research that answers product questions, run it in the field with farmers, traders and riders, and turn what we learn into flows the team can ship the same quarter.",
		"**UX researcher dan product designer dengan delapan tahun pengalaman di aplikasi konsumer dan pertanian.** Saya merancang riset yang menjawab pertanyaan produk, menjalankannya langsung di lapangan bersama petani, pedagang dan pengemudi, lalu mengubah temuannya menjadi alur yang bisa dirilis tim pada kuartal yang sama.",
	],
	experience: [
		{
			company: "Lumbung Tani",
			position: "Senior UX Researcher",
			location: "Bandung",
			period: ["May 2022 – Present", "Mei 2022 – Sekarang"],
			bullets: [
				[
					"Lead research for the farmer and buyer apps (450,000 monthly users); run 60+ field interviews and usability sessions a year.",
					"Memimpin riset untuk aplikasi petani dan pembeli (450.000 pengguna bulanan); menjalankan lebih dari 60 wawancara lapangan dan uji usability setiap tahun.",
				],
				[
					"Redesigned crop listing for low-literacy users with voice and photo input; completed listings rose by 38%.",
					"Merancang ulang alur unggah hasil panen untuk pengguna dengan literasi rendah lewat input suara dan foto; listing yang selesai naik 38%.",
				],
				[
					"Built a research repository of 300 tagged insights, now the first stop for every product brief.",
					"Membangun repositori riset berisi 300 temuan bertag, kini menjadi rujukan pertama setiap brief produk.",
				],
			],
		},
		{
			company: "Studio Garis",
			position: "Product Designer",
			location: "Bandung",
			period: ["Feb 2019 – Apr 2022", "Feb 2019 – Apr 2022"],
			bullets: [
				[
					"Designed web and mobile products for 14 clients in retail, health and education, from discovery to handoff.",
					"Mendesain produk web dan mobile untuk 14 klien di bidang ritel, kesehatan dan pendidikan, dari discovery hingga serah terima.",
				],
				[
					"Created the studio's design system in Figma, cutting the time to a first prototype from three weeks to eight days.",
					"Menyusun design system studio di Figma, memangkas waktu menuju prototipe pertama dari tiga minggu menjadi delapan hari.",
				],
			],
		},
		{
			company: "Kopi Kode",
			position: ["UI/UX Designer", "UI/UX Designer"],
			location: "Bandung",
			period: ["Aug 2017 – Jan 2019", "Agu 2017 – Jan 2019"],
			bullets: [
				[
					"Designed the ordering app for a chain of 40 coffee shops; app orders grew to 30% of sales.",
					"Mendesain aplikasi pemesanan untuk jaringan 40 kedai kopi; pesanan lewat aplikasi tumbuh hingga 30% dari penjualan.",
				],
				[
					"Ran the company's first usability tests with 20 baristas and regular customers.",
					"Menjalankan uji usability pertama perusahaan bersama 20 barista dan pelanggan tetap.",
				],
			],
		},
	],
	projects: [
		{
			name: ["Rider safety study", "Studi keselamatan pengemudi"],
			period: "2023",
			description: [
				"Diary study with 24 delivery riders over four weeks; led to a fatigue alert now on by default.",
				"Studi buku harian bersama 24 pengemudi antar selama empat minggu; menghasilkan peringatan kelelahan yang kini aktif secara bawaan.",
			],
		},
		{
			name: ["Market price checker", "Cek Harga Pasar"],
			period: "2021",
			description: [
				"Self-initiated case study: a price tool for traditional market traders, tested in three Bandung markets.",
				"Studi kasus mandiri: alat cek harga untuk pedagang pasar tradisional, diuji di tiga pasar di Bandung.",
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Design", "Sarjana Desain"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.58", "IPK 3,58"],
			location: "Bandung",
			period: "2013 – 2017",
		},
	],
	skills: [
		{
			name: ["Research", "Riset"],
			keywords: [
				["Field interviews", "Wawancara lapangan"],
				["Usability testing", "Uji usability"],
				["Diary studies", "Studi buku harian"],
				["Surveys", "Survei"],
			],
		},
		{
			name: ["Design", "Desain"],
			keywords: [["Interaction design", "Desain interaksi"], "Prototyping", "Design systems"],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Figma", "Maze", "Dovetail", "Notion"] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Sundanese", "Bahasa Sunda"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "languages"],
	},
	columns: { projects: 2, skills: 3, languages: 3 },
};
