import type { Persona } from "./persona";

/** Awan, the soft rounded panel: a social media and community specialist at a lifestyle brand in Yogyakarta. */
export const awan: Persona = {
	name: "Putri Ayuningtyas",
	headline: "Social Media & Community Specialist",
	email: "putri.ayuningtyas@email.com",
	phone: "+62 878 5553 9152",
	location: "Yogyakarta, Indonesia",
	details: [
		{ icon: "instagram", text: "@putri.ayuning", link: "https://instagram.com/putri.ayuning" },
		{ icon: "linkedin-02", text: "linkedin.com/in/putriayuningtyas", link: "https://linkedin.com/in/putriayuningtyas" },
	],
	summary: [
		"**Social media and community specialist with three years growing lifestyle brands in Yogyakarta.** I plan content people save and share, run the community behind it, from WhatsApp groups to monthly meet-ups, and read the numbers to see what works. At Laku Lampah I grew a community of 38,000 members who now drive a quarter of online sales.",
		"**Social media dan community specialist dengan tiga tahun pengalaman menumbuhkan merek gaya hidup di Yogyakarta.** Saya merencanakan konten yang disimpan dan dibagikan orang, mengelola komunitas di baliknya, dari grup WhatsApp hingga temu rutin bulanan, dan membaca angka untuk melihat apa yang berhasil. Di Laku Lampah, saya menumbuhkan komunitas berisi 38.000 anggota yang kini menyumbang seperempat penjualan daring.",
	],
	experience: [
		{
			company: "Laku Lampah",
			position: "Social Media & Community Specialist",
			location: "Yogyakarta",
			period: ["Feb 2025 – Present", "Feb 2025 – Sekarang"],
			bullets: [
				[
					"Run Instagram, TikTok and the community for a local sandal and bag label; followers grew from 64,000 to 210,000 in 18 months.",
					"Mengelola Instagram, TikTok, dan komunitas merek sandal dan tas lokal; pengikut tumbuh dari 64.000 menjadi 210.000 dalam 18 bulan.",
				],
				[
					"Started Lampah Club, now 38,000 members who buy again 2.4 times as often as other customers.",
					"Merintis Lampah Club, kini berisi 38.000 anggota yang membeli ulang 2,4 kali lebih sering dari pelanggan lain.",
				],
				[
					"Partner with 120 micro-creators a year on a fixed IDR 300 million budget; cost per sale fell by 41%.",
					"Bekerja sama dengan 120 kreator mikro per tahun dengan anggaran tetap Rp300 juta; biaya per penjualan turun 41%.",
				],
			],
		},
		{
			company: "Griya Tenang Hospitality",
			position: "Social Media Officer",
			location: "Yogyakarta",
			period: "Sep 2023 – Jan 2025",
			bullets: [
				[
					"Managed content for four boutique hotels; direct bookings from Instagram rose from 6% to 15%.",
					"Mengelola konten empat hotel butik; pemesanan langsung dari Instagram naik dari 6% menjadi 15%.",
				],
				[
					"Cut the average reply time to guest messages from three hours to 20 minutes.",
					"Memangkas rata-rata waktu balas pesan tamu dari tiga jam menjadi 20 menit.",
				],
			],
		},
		{
			company: "Ronda Media",
			position: "Content Intern",
			location: "Yogyakarta",
			period: "Feb 2023 – Jul 2023",
			bullets: [
				[
					"Wrote and edited 90 short videos on local food spots; one series passed 2 million views.",
					"Menulis dan menyunting 90 video pendek tentang kuliner lokal; satu seri menembus 2 juta tayangan.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Atma Jaya Yogyakarta",
			degree: ["Bachelor of Communication", "Sarjana Ilmu Komunikasi (S.I.Kom.)"],
			area: ["Communication Science, Public Relations", "Ilmu Komunikasi, Hubungan Masyarakat"],
			grade: ["GPA 3.61", "IPK 3,61"],
			location: "Yogyakarta",
			period: "2019 – 2023",
		},
	],
	projects: [
		{
			name: ["“Slow Down, Jogja” city walks", "Jalan santai “Pelan-pelan, Jogja”"],
			period: ["2025 – Present", "2025 – Sekarang"],
			description: [
				"Monthly walks with local guides for Lampah Club members; 1,600 people across 14 walks.",
				"Jalan kaki keliling kota bersama pemandu lokal setiap bulan untuk anggota Lampah Club; diikuti 1.600 peserta dalam 14 kali jalan.",
			],
		},
		{
			name: ["#LangkahLokal photo campaign", "Kampanye foto #LangkahLokal"],
			period: "2025",
			description: [
				"Customer photo challenge that collected 4,300 posts; the best ones became the year-end catalogue.",
				"Tantangan foto pelanggan yang mengumpulkan 4.300 unggahan; karya terbaik menjadi katalog akhir tahun.",
			],
		},
	],
	skills: [
		{
			name: ["Social media", "Media sosial"],
			keywords: [["Content planning", "Perencanaan konten"], ["Short-form video", "Video pendek"], "Copywriting"],
		},
		{
			name: ["Community", "Komunitas"],
			keywords: [
				["Community building", "Membangun komunitas"],
				["Events", "Acara"],
				["Creator partnerships", "Kerja sama kreator"],
			],
		},
		{
			name: ["Analytics", "Analitik"],
			keywords: ["Meta Business Suite", "TikTok Analytics", "Google Analytics 4"],
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	interests: [{ name: ["Film photography", "Fotografi analog"] }, { name: ["Batik making", "Membatik"] }],
	certifications: [
		{ title: "Meta Certified Community Manager", issuer: "Meta", date: "2024" },
		{ title: "Google Digital Marketing & E-commerce Certificate", issuer: "Google", date: "2023" },
	],
	layout: {
		main: ["summary", "experience", "education", "projects"],
		sidebar: ["skills", "languages", "interests", "certifications"],
	},
};
