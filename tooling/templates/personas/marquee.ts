import type { Persona } from "./persona";

/** Marquee: a creative producer of music videos, short films and brand campaigns in Jakarta. */
export const marquee: Persona = {
	name: "Rendra Sitompul",
	headline: ["Creative Producer · Film & Brand Content", "Produser Kreatif · Film & Konten Merek"],
	email: "rendra.sitompul@email.com",
	phone: "+62 878 5552 6094",
	location: "Jakarta, Indonesia",
	website: { url: "https://rendrasitompul.film", label: "rendrasitompul.film" },
	profiles: [
		{ network: "Instagram", username: "rendra.sitompul", url: "https://instagram.com/rendra.sitompul" },
		{ network: "YouTube", username: "@rendrasitompul", url: "https://youtube.com/@rendrasitompul" },
		{ network: "LinkedIn", username: "rendrasitompul", url: "https://linkedin.com/in/rendrasitompul" },
	],
	summary: [
		"**Creative producer who takes ideas from treatment to screen on time and on budget.** Eleven years producing music videos, short films and brand campaigns: more than 90 productions, with budgets of up to IDR 4.5 billion. I build the crew, find the locations and keep directors, clients and labels pulling in the same direction.",
		"**Produser kreatif yang membawa ide dari treatment ke layar tepat waktu dan sesuai anggaran.** Sebelas tahun memproduksi video musik, film pendek, dan kampanye merek: lebih dari 90 produksi dengan anggaran hingga Rp4,5 miliar. Saya menyusun kru, mencari lokasi, dan menjaga sutradara, klien, serta label rekaman tetap sejalan.",
	],
	experience: [
		{
			company: "Kelana Rupa Pictures",
			position: ["Senior Creative Producer", "Senior Creative Producer"],
			location: "Jakarta",
			period: ["Feb 2022 – Present", "Feb 2022 – Sekarang"],
			bullets: [
				[
					"Produce 25 brand campaigns and music videos a year for telecom, FMCG and record-label clients, with budgets from IDR 300 million to 4.5 billion.",
					"Memproduksi 25 kampanye merek dan video musik per tahun untuk klien telekomunikasi, FMCG, dan label rekaman, dengan anggaran Rp300 juta hingga Rp4,5 miliar.",
				],
				[
					"Delivered 96% of projects on or under budget; average margin rose from 18% to 27%.",
					"96% proyek selesai sesuai atau di bawah anggaran; margin rata-rata naik dari 18% menjadi 27%.",
				],
				[
					"Built a roster of 140 freelance crew in six cities, cutting pre-production by a week.",
					"Membangun daftar 140 kru lepas di enam kota; praproduksi menjadi seminggu lebih cepat.",
				],
			],
		},
		{
			company: "Ruang Gerak Films",
			position: ["Producer", "Produser"],
			location: "Jakarta",
			period: ["Mar 2018 – Jan 2022", "Mar 2018 – Jan 2022"],
			bullets: [
				[
					"Produced 38 music videos for independent and major-label artists; 11 passed 10 million views.",
					"Memproduksi 38 video musik untuk musisi indie dan label besar; 11 di antaranya tembus 10 juta tayangan.",
				],
				[
					"Ran the company’s first short-film slate: three films, two selected for international festivals.",
					"Menjalankan slate film pendek pertama perusahaan: tiga film, dua terpilih di festival internasional.",
				],
			],
		},
		{
			company: "Rangkai Komunika",
			position: ["Production Coordinator", "Koordinator Produksi"],
			location: "Jakarta",
			period: ["Jul 2015 – Feb 2018", "Jul 2015 – Feb 2018"],
			bullets: [
				[
					"Coordinated more than 60 TV commercial shoots, from permits and casting to post-production schedules.",
					"Mengoordinasi lebih dari 60 syuting iklan TV, dari perizinan dan casting hingga jadwal pascaproduksi.",
				],
			],
		},
	],
	projects: [
		{
			name: ["“Back to the Lake”, short film", "Film pendek “Pulang ke Danau”"],
			period: "2025",
			description: [
				"Producer of a 19-minute drama shot on Lake Toba; screened at 14 festivals and won two awards.",
				"Produser drama berdurasi 19 menit yang diambil di Danau Toba; diputar di 14 festival dan meraih dua penghargaan.",
			],
		},
		{
			name: ["“Village Voices” campaign", "Kampanye “Suara Kampung”"],
			period: "2024",
			description: [
				"Documentary-style campaign shot in six cities for a mobile network; 28 million views and brand recall up 19 points.",
				"Kampanye bergaya dokumenter di enam kota untuk operator seluler; 28 juta tayangan dan brand recall naik 19 poin.",
			],
		},
	],
	education: [
		{
			school: "Institut Kesenian Jakarta",
			degree: ["Bachelor of Arts", "Sarjana Seni (S.Sn.)"],
			area: ["Film & Television (Production)", "Film dan Televisi (Peminatan Produksi)"],
			grade: ["GPA 3.48", "IPK 3,48"],
			location: "Jakarta",
			period: "2011 – 2015",
		},
	],
	skills: [
		{
			name: ["Production", "Produksi"],
			keywords: [
				["Budgeting", "Penganggaran"],
				["Scheduling", "Penjadwalan"],
				["Crew hiring", "Rekrutmen kru"],
				["Location scouting", "Survei lokasi"],
			],
		},
		{
			name: ["Creative", "Kreatif"],
			keywords: [["Treatment writing", "Penulisan treatment"], "Casting", "Pitching"],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["StudioBinder", "Movie Magic", "Frame.io", "DaVinci Resolve"] },
	],
	awards: [
		{ title: ["Best Short Film", "Film Pendek Terbaik"], awarder: "Festival Sinema Danau", date: "2025" },
		{ title: ["Silver, Film Craft", "Perak, Film Craft"], awarder: "Pekan Iklan Indonesia", date: "2024" },
		{ title: ["Best Music Video", "Video Musik Terbaik"], awarder: "Anugerah Musik Layar", date: "2021" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
		{ language: ["Toba Batak", "Bahasa Batak Toba"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards", "languages", "profiles"],
	},
};
