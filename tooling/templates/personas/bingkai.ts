import type { Persona } from "./persona";

/** Bingkai: a public policy analyst at a think tank who also lectures in public administration. */
export const bingkai: Persona = {
	name: "Andi Tenri Azizah",
	headline: ["Senior Policy Analyst · Fiscal Decentralisation", "Analis Kebijakan Senior · Desentralisasi Fiskal"],
	email: "tenri.azizah@email.com",
	phone: "+62 811 5556 2093",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/tenriazizah", link: "https://linkedin.com/in/tenriazizah" },
		{ icon: "id-card", text: "ORCID 0000-0003-5556-2917", link: "https://orcid.org/0000-0003-5556-2917" },
	],
	summary: [
		"**Policy researcher with eleven years on fiscal decentralisation, village funds and basic services in eastern Indonesia.** I design field studies, turn the evidence into briefs that ministries and local governments can act on, and teach public policy analysis to undergraduates.",
		"**Peneliti kebijakan dengan sebelas tahun pengalaman di bidang desentralisasi fiskal, dana desa, dan layanan dasar di Indonesia timur.** Saya merancang studi lapangan, mengolah temuan menjadi policy brief yang dapat ditindaklanjuti kementerian dan pemerintah daerah, serta mengajar analisis kebijakan publik bagi mahasiswa S1.",
	],
	experience: [
		{
			company: "Pusat Riset Kebijakan Lontara",
			position: ["Senior Policy Analyst", "Analis Kebijakan Senior"],
			location: "Jakarta",
			period: ["Mar 2021 – Present", "Mar 2021 – Sekarang"],
			bullets: [
				[
					"Lead the fiscal decentralisation programme: 6 researchers, IDR 4.2 billion in grants and 11 studies since 2021.",
					"Memimpin program desentralisasi fiskal: 6 peneliti, hibah Rp 4,2 miliar, dan 11 studi sejak 2021.",
				],
				[
					"Surveyed 1,200 villages on village-fund spending; the findings fed into the 2024 revision of the allocation formula.",
					"Menyurvei 1.200 desa tentang belanja dana desa; temuannya menjadi masukan bagi revisi formula alokasi pada 2024.",
				],
			],
		},
		{
			company: "Universitas Tirta Kencana",
			position: ["Part-time Lecturer, Public Administration", "Dosen Tidak Tetap, Administrasi Publik"],
			location: "Jakarta",
			period: ["Feb 2022 – Present", "Feb 2022 – Sekarang"],
			bullets: [
				[
					"Teach Public Policy Analysis and Research Methods to 90 students a semester; supervised 14 theses.",
					"Mengampu Analisis Kebijakan Publik dan Metode Penelitian bagi 90 mahasiswa per semester; membimbing 14 skripsi.",
				],
			],
		},
		{
			company: "Yayasan Suara Desa Timur",
			position: ["Research Officer", "Staf Peneliti"],
			location: "Makassar",
			period: ["Jul 2015 – Jan 2019", "Jul 2015 – Jan 2019"],
			bullets: [
				[
					"Ran household surveys in 60 villages in South and Southeast Sulawesi; trained 40 local enumerators.",
					"Menjalankan survei rumah tangga di 60 desa di Sulawesi Selatan dan Sulawesi Tenggara; melatih 40 enumerator lokal.",
				],
			],
		},
	],
	education: [
		{
			school: "Australian National University",
			degree: ["Master of Public Policy", "Master of Public Policy"],
			area: ["Policy Analysis", "Analisis Kebijakan"],
			location: "Canberra, Australia",
			period: "2019 – 2020",
		},
		{
			school: "Universitas Hasanuddin",
			degree: ["Bachelor of Public Administration", "Sarjana Administrasi Publik (S.A.P.)"],
			area: ["Public Administration", "Ilmu Administrasi Negara"],
			grade: ["GPA 3.76", "IPK 3,76"],
			location: "Makassar",
			period: "2011 – 2015",
		},
	],
	publications: [
		{
			title: "Who captures the village fund? Evidence from 1,200 Indonesian villages",
			publisher: "Asia-Pacific Decentralisation Review 8(2)",
			date: "2025",
			description: ["With M. Lubis and P. Hartley", "Bersama M. Lubis dan P. Hartley"],
		},
		{
			title: "Transfer berbasis kinerja dan mutu layanan dasar di Sulawesi",
			publisher: "Jurnal Kebijakan Publik Nusantara 12(1)",
			date: "2024",
		},
	],
	awards: [
		{
			title: ["Research grant, IDR 850 million", "Hibah riset Rp 850 juta"],
			awarder: ["Nusantara Policy Research Fund", "Dana Riset Kebijakan Nusantara"],
			date: "2023",
		},
		{
			title: ["Best Paper, Public Policy Track", "Makalah Terbaik, Bidang Kebijakan Publik"],
			awarder: ["Indonesian Public Administration Congress", "Kongres Administrasi Publik Indonesia"],
			date: "2024",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Buginese", "Bahasa Bugis"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent (IELTS 8.0)", "Fasih (IELTS 8,0)"], level: 5 },
	],
	titles: { awards: ["Awards & Grants", "Penghargaan & Hibah"] },
	columns: { awards: 2, languages: 3 },
	layout: {
		main: ["summary", "experience", "education", "publications"],
		sidebar: ["awards", "languages"],
	},
};
