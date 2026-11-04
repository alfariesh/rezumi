import type { Persona } from "./persona";

/** Linen: an architect and part-time lecturer at a small studio in Yogyakarta. */
export const linen: Persona = {
	name: "Galih Pramudya",
	headline: ["Architect & Lecturer · Sustainable Design", "Arsitek & Dosen · Desain Berkelanjutan"],
	email: "galih.pramudya@email.com",
	phone: "+62 813 5552 4071",
	location: "Yogyakarta, Indonesia",
	website: { url: "https://galihpramudya.studio", label: "galihpramudya.studio" },
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/galihpramudya", link: "https://linkedin.com/in/galihpramudya" },
	],
	summary: [
		"**Licensed architect with ten years of practice** in housing, schools and small public buildings across Java. I design for the tropics first: deep shade, cross ventilation and local materials, tested with daylight and energy models before drawings reach site. I also teach design studio at a local university.",
		"**Arsitek berlisensi dengan pengalaman sepuluh tahun** di bidang hunian, sekolah, dan bangunan publik kecil di Pulau Jawa. Saya merancang untuk iklim tropis lebih dulu: bayangan dalam, ventilasi silang, dan material lokal, diuji dengan simulasi cahaya dan energi sebelum gambar dibawa ke lapangan. Saya juga mengajar studio perancangan.",
	],
	experience: [
		{
			company: "Studio Ruang Nalar",
			position: ["Senior Architect & Associate", "Senior Architect & Associate"],
			location: "Yogyakarta",
			period: ["Sep 2020 – Present", "Sep 2020 – Sekarang"],
			bullets: [
				[
					"Lead a team of six on 14 projects totalling 21,500 m², from brief to handover.",
					"Memimpin tim enam orang di 14 proyek (21.500 m²), dari brief hingga serah terima.",
				],
				[
					"Cut modelled cooling energy by 32% on average with shading and cross ventilation.",
					"Menurunkan energi pendinginan rata-rata 32% lewat peneduh dan ventilasi silang.",
				],
				[
					"Moved the studio to Revit; drawing revisions per project fell from nine to four.",
					"Memindahkan studio ke Revit; revisi gambar per proyek turun dari 9 menjadi 4.",
				],
			],
		},
		{
			company: "Universitas Bentala Yogyakarta",
			position: ["Part-time Lecturer, Architecture", "Dosen Tidak Tetap, Program Studi Arsitektur"],
			location: "Yogyakarta",
			period: ["Feb 2021 – Present", "Feb 2021 – Sekarang"],
			bullets: [
				[
					"Teach Design Studio 5 and Building Physics to 70 students each semester, with a teaching rating of 4.7 out of 5.",
					"Mengajar Studio Perancangan 5 dan Fisika Bangunan bagi 70 mahasiswa per semester; nilai evaluasi pengajaran 4,7 dari 5.",
				],
				[
					"Supervised 18 final-year projects; three reached national student competition finals.",
					"Membimbing 18 tugas akhir, tiga di antaranya finalis kompetisi mahasiswa nasional.",
				],
			],
		},
		{
			company: "Karsa Lima Arsitek",
			position: ["Architect", "Arsitek"],
			location: "Jakarta",
			period: ["Aug 2014 – Jul 2018", "Agu 2014 – Jul 2018"],
			bullets: [
				[
					"Designed and documented three mid-rise residential towers, 38,000 m² in total, working in a team of 12 architects and engineers.",
					"Merancang dan menyusun dokumen tiga menara hunian menengah seluas total 38.000 m² bersama tim berisi 12 orang.",
				],
				[
					"Supervised construction of a 64-room hotel in Bogor; answered 210 site queries within 48 hours each.",
					"Mengawasi pembangunan hotel 64 kamar di Bogor; 210 pertanyaan lapangan dijawab masing-masing dalam 48 jam.",
				],
			],
		},
	],
	projects: [
		{
			name: "SMK Tumbuh Vocational Campus, Bantul",
			period: "2024",
			description: [
				"3,800 m² school for 600 students; naturally ventilated classrooms, GREENSHIP Gold target.",
				"Sekolah 600 siswa seluas 3.800 m²; kelas tanpa AC, menargetkan GREENSHIP Gold.",
			],
		},
		{
			name: ["Kali Code Reading House", "Rumah Baca Kali Code"],
			period: "2022",
			description: [
				"260 m² community library of bamboo and reclaimed brick, built for IDR 1.1 billion.",
				"Perpustakaan warga 260 m² dari bambu dan bata bekas; biaya Rp1,1 miliar.",
			],
		},
		{
			name: "Omah Lereng Residence, Sleman",
			period: "2021",
			description: [
				"420 m² hillside house on stilts; uses 40% less grid power than the owners’ previous home.",
				"Rumah panggung 420 m² di lereng; listrik 40% lebih hemat dari rumah lama pemiliknya.",
			],
		},
	],
	education: [
		{
			school: "Delft University of Technology",
			degree: ["Master of Science", "Master of Science"],
			area: ["Architecture, Urbanism and Building Sciences", "Architecture, Urbanism and Building Sciences"],
			grade: ["Cum laude", "Cum laude"],
			location: ["Delft, the Netherlands", "Delft, Belanda"],
			period: "2018 – 2020",
		},
		{
			school: "Universitas Gadjah Mada",
			degree: ["Bachelor of Architecture", "Sarjana Arsitektur"],
			area: ["Architecture", "Arsitektur"],
			grade: ["GPA 3.68", "IPK 3,68"],
			location: "Yogyakarta",
			period: "2010 – 2014",
		},
	],
	skills: [
		{
			name: ["Software", "Perangkat lunak"],
			keywords: ["Revit", "Rhino + Grasshopper", "AutoCAD", "Enscape", "SketchUp"],
		},
		{
			name: ["Methods", "Metode"],
			keywords: [
				["Passive design", "Desain pasif"],
				["Daylight simulation", "Simulasi pencahayaan"],
				["BIM coordination", "Koordinasi BIM"],
				["Site supervision", "Pengawasan lapangan"],
			],
		},
	],
	certifications: [
		{ title: ["IAI Architect Licence", "Lisensi Arsitek IAI"], issuer: "Ikatan Arsitek Indonesia", date: "2017" },
		{ title: "GREENSHIP Associate", issuer: "Green Building Council Indonesia", date: "2021" },
		{ title: "Autodesk Certified Professional: Revit", issuer: "Autodesk", date: "2022" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	awards: [
		{
			title: ["Winner, Public Building", "Pemenang, Kategori Bangunan Publik"],
			awarder: ["Jogja Green Architecture Awards", "Penghargaan Arsitektur Hijau Jogja"],
			date: "2023",
		},
		{
			title: ["Shortlist, Young Architect Prize", "Nominasi, Young Architect Prize"],
			awarder: "Forum Arsitek Muda Nusantara",
			date: "2022",
		},
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "certifications", "languages", "awards"],
	},
};
