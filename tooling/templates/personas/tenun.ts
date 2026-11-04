import type { Persona } from "./persona";

/** Tenun, the ruled formal grid: a civil-service development planner at a city planning agency. */
export const tenun: Persona = {
	photo: true,
	name: "Rahma Aulia Fitri, S.T., M.T.",
	headline: [
		"Development Planner · Infrastructure & Spatial Planning",
		"Perencana Ahli Muda · Infrastruktur & Kewilayahan",
	],
	email: "rahma.fitri@email.com",
	phone: "+62 812 5550 7730",
	location: ["Arunika City, West Java", "Kota Arunika, Jawa Barat"],
	details: [{ icon: "linkedin-02", text: "linkedin.com/in/rahmafitri", link: "https://linkedin.com/in/rahmafitri" }],
	summary: [
		"**Civil-service planner with eight years in local government**, drafting development plans and infrastructure budgets for a city of 1.4 million. I link spatial data to budget decisions and run consultations residents attend.",
		"**Perencana ASN dengan delapan tahun pengalaman di pemerintah daerah**, menyusun RPJMD, RKPD dan anggaran infrastruktur untuk kota berpenduduk 1,4 juta jiwa. Terbiasa menautkan data spasial dengan keputusan anggaran.",
	],
	experience: [
		{
			company: "Badan Perencanaan Kota Arunika",
			position: ["Development Planner (Junior Expert)", "Perencana Ahli Muda"],
			location: ["Arunika City", "Kota Arunika"],
			period: ["Apr 2022 – Present", "Apr 2022 – Sekarang"],
			bullets: [
				[
					"Coordinate infrastructure chapters of the 2025–2029 medium-term plan (RPJMD) across 9 city departments.",
					"Mengoordinasikan penyusunan bab infrastruktur RPJMD 2025–2029 bersama 9 perangkat daerah.",
				],
				[
					"Built a GIS dashboard of 1,850 road, drainage and water proposals, used in every budget review since 2023.",
					"Membangun dasbor GIS berisi 1.850 usulan jalan, drainase dan air bersih; dipakai dalam pembahasan anggaran.",
				],
				[
					"Raised the share of priority projects funded in the annual plan (RKPD) from 54% to 81% in two cycles.",
					"Menaikkan porsi usulan prioritas yang terdanai dalam RKPD dari 54% menjadi 81% dalam dua siklus.",
				],
			],
		},
		{
			company: "Badan Perencanaan Kota Arunika",
			position: ["Development Planner (Entry Expert)", "Perencana Ahli Pertama"],
			location: ["Arunika City", "Kota Arunika"],
			period: ["Mar 2018 – Mar 2022", "Mar 2018 – Mar 2022"],
			bullets: [
				[
					"Facilitated district development consultations (musrenbang) in 12 sub-districts, about 3,000 residents a year.",
					"Memfasilitasi musrenbang di 12 kecamatan dengan sekitar 3.000 peserta warga per tahun.",
				],
			],
		},
		{
			company: "PT Tata Ruang Mandala",
			position: ["Junior Planner", "Junior Planner"],
			location: "Bandung",
			period: ["Sep 2013 – Feb 2018", "Sep 2013 – Feb 2018"],
			bullets: [],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Master of Engineering", "Magister Teknik (M.T.)"],
			area: ["Regional and City Planning", "Perencanaan Wilayah dan Kota"],
			grade: ["GPA 3.81", "IPK 3,81"],
			location: "Bandung",
			period: "2019 – 2021",
			description: [
				"Government study-leave scholarship. Thesis: Spatial targeting of drainage investment in flood-prone neighbourhoods.",
				"Tugas belajar. Tesis: Penentuan prioritas spasial investasi drainase di kawasan rawan banjir.",
			],
		},
		{
			school: "Universitas Brawijaya",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Urban and Regional Planning", "Perencanaan Wilayah dan Kota"],
			grade: ["GPA 3.64", "IPK 3,64"],
			location: "Malang",
			period: "2009 – 2013",
		},
	],
	certifications: [
		{
			title: ["Functional Planner Training, Junior Level", "Diklat Fungsional Perencana Tingkat Muda"],
			issuer: "Pusat Pembinaan Perencana Daerah",
			date: "2022",
		},
		{
			title: ["Civil Servant Foundation Training", "Pelatihan Dasar CPNS"],
			issuer: "Badan Pengembangan SDM Kota Arunika",
			date: "2018",
		},
	],
	awards: [
		{
			title: ["Outstanding Planner of Arunika City", "Perencana Teladan Kota Arunika"],
			awarder: ["Arunika City Government", "Pemerintah Kota Arunika"],
			date: "2024",
		},
		{
			title: ["Runner-up, Public Service Innovation", "Juara II Inovasi Pelayanan Publik"],
			awarder: ["West Java Province", "Provinsi Jawa Barat"],
			date: "2023",
		},
	],
	skills: [
		{
			name: ["Planning", "Perencanaan"],
			keywords: ["RPJMD", "RKPD", "Renstra", ["KPIs", "Indikator kinerja"]],
		},
		{
			name: ["Spatial analysis", "Analisis spasial"],
			keywords: ["QGIS", "ArcGIS", ["Land-use mapping", "Pemetaan guna lahan"]],
		},
		{ name: ["Data & budget", "Data & anggaran"], keywords: ["Excel", "SIPD", ["Cost estimates", "Estimasi biaya"]] },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{
			language: ["English", "Bahasa Inggris"],
			fluency: ["Professional (TOEFL 560)", "Profesional (TOEFL 560)"],
			level: 0,
		},
		{ language: ["Sundanese", "Bahasa Sunda"], fluency: ["Conversational", "Percakapan"], level: 0 },
	],
	titles: { certifications: ["Training & Certification", "Diklat & Sertifikasi"] },
	columns: { certifications: 2, awards: 2, skills: 3, languages: 3 },
	layout: {
		main: ["summary", "experience", "education", "certifications", "awards"],
		sidebar: ["skills", "languages"],
	},
};
