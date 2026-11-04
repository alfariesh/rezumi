import type { Persona } from "./persona";

/** Cendekia, the academic CV: a marine ecologist who lectures and runs a coral reef lab. */
export const cendekia: Persona = {
	name: "Dr. Sekar Ayu Pratiwi",
	headline: ["Associate Professor · Marine Ecology", "Lektor Kepala · Ekologi Laut"],
	email: "sekar.pratiwi@email.com",
	phone: "+62 813 5550 4271",
	location: "Makassar, Indonesia",
	details: [{ icon: "id-card", text: "ORCID 0000-0002-5550-1847", link: "https://orcid.org/0000-0002-5550-1847" }],
	summary: [
		"**Marine ecologist studying how inshore coral reefs cope with heat and sediment.** Twelve years of fieldwork in the Spermonde Archipelago, 40+ supervised theses and long-term reef monitoring run with local fishers.",
		"**Ekolog laut yang meneliti ketahanan terumbu karang pesisir terhadap panas dan sedimen.** Dua belas tahun kerja lapangan di Kepulauan Spermonde, 40+ mahasiswa bimbingan dan pemantauan terumbu bersama nelayan.",
	],
	experience: [
		{
			company: "Universitas Hasanuddin",
			position: ["Associate Professor, Department of Marine Science", "Lektor Kepala, Departemen Ilmu Kelautan"],
			location: "Makassar",
			period: ["2023 – Present", "2023 – Sekarang"],
			bullets: [
				[
					"Head the Coral Reef Ecology Lab: 14 graduate students across 22 survey sites.",
					"Mengepalai Lab Ekologi Terumbu Karang: 14 mahasiswa S2/S3 di 22 stasiun survei.",
				],
				[
					"Teach Reef Ecology and Biostatistics to 160 students a year; 40 theses supervised.",
					"Mengampu Ekologi Terumbu bagi 160 mahasiswa/tahun; membimbing 40 skripsi.",
				],
			],
		},
		{
			company: "Universitas Hasanuddin",
			position: ["Lecturer (Assistant Professor)", "Lektor"],
			location: "Makassar",
			period: "2014 – 2023",
			bullets: [],
		},
	],
	education: [
		{
			school: "James Cook University",
			degree: ["Doctor of Philosophy", "Doktor (Ph.D.)"],
			area: ["Marine Biology", "Biologi Kelautan"],
			location: "Townsville, Australia",
			period: "2016 – 2020",
			description: [
				"Thesis: Thermal tolerance of inshore corals under chronic sedimentation.",
				"Disertasi: Toleransi termal karang pesisir di bawah sedimentasi kronis.",
			],
		},
		{
			school: "IPB University",
			degree: ["Master of Science", "Magister Sains (M.Si.)"],
			area: ["Marine Science", "Ilmu Kelautan"],
			grade: ["GPA 3.86", "IPK 3,86"],
			location: "Bogor",
			period: "2011 – 2013",
			description: [
				"Thesis: Hard-coral recruitment on artificial reefs in the Thousand Islands.",
				"Tesis: Rekrutmen karang keras pada terumbu buatan di Kepulauan Seribu.",
			],
		},
		{
			school: "Universitas Hasanuddin",
			degree: ["Bachelor of Marine Science", "Sarjana Kelautan (S.Kel.)"],
			area: ["Marine Science", "Ilmu Kelautan"],
			grade: ["GPA 3.71", "IPK 3,71"],
			location: "Makassar",
			period: "2006 – 2010",
			description: [
				"Thesis: Reef fish communities around Barrang Lompo Island.",
				"Skripsi: Komunitas ikan karang di sekitar Pulau Barrang Lompo.",
			],
		},
	],
	publications: [
		{
			title: "Sediment load predicts bleaching severity on inshore Spermonde reefs",
			publisher: "Journal of Tropical Reef Science 14(2)",
			date: "2025",
			description: ["With R. Hakim, D. Lestari and J. Morgan", "Bersama R. Hakim, D. Lestari dan J. Morgan"],
		},
		{
			title: "Community-run photo transects for low-cost reef monitoring",
			publisher: "Coastal Ecosystems Review 9",
			date: "2024",
		},
		{
			title: "Thermal tolerance of Porites lutea across a turbidity gradient",
			publisher: "Indo-Pacific Marine Ecology 31(4)",
			date: "2022",
		},
		{
			title: "Reef fish recovery after the 2020 heatwave in Southeast Sulawesi",
			publisher: "Jurnal Ilmu Kelautan Wallacea 7(1)",
			date: "2022",
			description: ["With R. Hakim (lead author) and B. Siregar", "Bersama R. Hakim (penulis utama) dan B. Siregar"],
		},
		{
			title: "Turbid refuges: inshore corals under chronic sedimentation",
			publisher: "Journal of Tropical Reef Science 10(3)",
			date: "2020",
		},
	],
	awards: [
		{
			title: ["Reef Resilience in a Warming Sulawesi (PI)", "Ketahanan Terumbu di Sulawesi yang Menghangat (PI)"],
			awarder: ["Nusantara Marine Research Fund · Rp 1.2 billion", "Dana Riset Kelautan Nusantara · Rp 1,2 miliar"],
			date: "2023 – 2026",
		},
		{
			title: ["Fishers as Reef Monitors (PI)", "Nelayan sebagai Pemantau Terumbu (PI)"],
			awarder: ["Yayasan Sains Pesisir · Rp 450 million", "Yayasan Sains Pesisir · Rp 450 juta"],
			date: "2021 – 2023",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent (IELTS 8.0)", "Fasih (IELTS 8,0)"], level: 0 },
	],
	titles: { awards: ["Grants", "Hibah Penelitian"] },
	columns: { languages: 2 },
	layout: {
		main: ["experience", "education", "publications", "awards"],
		sidebar: ["languages"],
	},
};
