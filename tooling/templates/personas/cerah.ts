import type { Persona } from "./persona";

/** Cerah, the fresh-graduate page: an Informatics graduate looking for a junior frontend role. */
export const cerah: Persona = {
	name: "Cut Nadhira Zahra",
	headline: ["Informatics Graduate · Frontend Developer", "Lulusan Informatika · Frontend Developer"],
	email: "nadhira.zahra@email.com",
	phone: "+62 852 5558 1407",
	location: "Banda Aceh, Indonesia",
	website: { url: "https://nadhirazahra.dev", label: "nadhirazahra.dev" },
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/nadhirazahra", link: "https://linkedin.com/in/nadhirazahra" },
		{ icon: "github", text: "github.com/nadhirazahra", link: "https://github.com/nadhirazahra" },
	],
	summary: [
		"**Fresh Informatics graduate ready for a first role as a frontend developer.** Two internships and a 16-week bootcamp taught me to ship accessible React interfaces, write tests before handing work over and ask for review early. Comfortable with TypeScript, Next.js and remote teams.",
		"**Lulusan baru Informatika yang siap mengisi posisi pertama sebagai frontend developer.** Dua kali magang dan bootcamp 16 minggu mengajarkan saya membangun antarmuka React yang aksesibel, menulis pengujian sebelum menyerahkan pekerjaan, dan meminta review sejak awal. Terbiasa dengan TypeScript, Next.js, dan kerja jarak jauh.",
	],
	education: [
		{
			school: "Universitas Syiah Kuala",
			degree: ["Bachelor of Computer Science", "Sarjana Komputer (S.Kom.)"],
			area: ["Informatics", "Informatika"],
			grade: ["GPA 3.74 / 4.00", "IPK 3,74 / 4,00"],
			location: "Banda Aceh",
			period: ["Aug 2022 – Aug 2026", "Agu 2022 – Agu 2026"],
		},
		{
			school: "Akademi Frontend Samudra",
			degree: ["Frontend Engineering Bootcamp", "Bootcamp Frontend Engineering"],
			area: ["16-week part-time programme", "Program paruh waktu 16 minggu"],
			grade: ["Top graduate of 40", "Lulusan terbaik dari 40 peserta"],
			location: ["Online", "Daring"],
			period: "Jan 2025 – Apr 2025",
		},
	],
	experience: [
		{
			company: "Kelas Lentera",
			position: ["Frontend Developer Intern", "Frontend Developer Intern"],
			location: ["Jakarta (remote)", "Jakarta (jarak jauh)"],
			period: ["Feb 2026 – Jul 2026", "Feb 2026 – Jul 2026"],
			bullets: [
				[
					"Built 14 React and TypeScript components for a teacher dashboard used by 2,100 schools.",
					"Membangun 14 komponen React dan TypeScript untuk dasbor guru yang dipakai 2.100 sekolah.",
				],
			],
		},
		{
			company: "PT Rencong Solusi Digital",
			position: ["Web Developer Intern", "Web Developer Intern"],
			location: "Banda Aceh",
			period: ["Jul 2025 – Sep 2025", "Jul 2025 – Sep 2025"],
			bullets: [
				[
					"Rebuilt a hospital’s outpatient booking form in Vue; completed bookings on mobile rose by 30%.",
					"Membangun ulang formulir pendaftaran rawat jalan sebuah rumah sakit dengan Vue; pendaftaran yang tuntas lewat ponsel naik 30%.",
				],
			],
		},
	],
	projects: [
		{
			name: "Catat Posyandu",
			period: "2026",
			description: [
				"Offline-first PWA for child growth records; 18 volunteers logged 1,300 visits in a three-month pilot.",
				"PWA offline-first untuk pencatatan tumbuh kembang anak; 18 kader mencatat 1.300 kunjungan dalam uji coba tiga bulan.",
			],
		},
		{
			name: ["Campus timetable planner", "Perencana jadwal kuliah"],
			period: "2024",
			description: [
				"Next.js app that builds clash-free class schedules; used by 2,300 students in its first semester.",
				"Aplikasi Next.js yang menyusun jadwal kuliah tanpa bentrok; dipakai 2.300 mahasiswa pada semester pertamanya.",
			],
		},
	],
	skills: [
		{ name: "Frontend", keywords: ["React", "TypeScript", "Next.js", "Tailwind CSS"] },
		{
			name: ["Quality", "Kualitas"],
			keywords: ["Vitest", "Playwright", ["Accessibility (WCAG)", "Aksesibilitas (WCAG)"]],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Git", "Figma", "REST API", "Vite"] },
	],
	certifications: [
		{ title: "Meta Front-End Developer Professional Certificate", issuer: "Meta", date: "2025" },
		{ title: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", date: "2026" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Acehnese", "Bahasa Aceh"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Good (TOEFL ITP 590)", "Baik (TOEFL ITP 590)"], level: 4 },
	],
	columns: { projects: 2, skills: 3, certifications: 2, languages: 3 },
	layout: {
		main: ["summary", "education", "experience", "projects"],
		sidebar: ["skills", "certifications", "languages"],
	},
};
