import type { Persona } from "./persona";

/** Nusa, the bold page: a digital marketing specialist at a home-goods brand in Surabaya. */
export const nusa: Persona = {
	name: "Wulan Kartikasari",
	headline: [
		"Digital Marketing Specialist · Performance & Social",
		"Digital Marketing Specialist · Performance & Social",
	],
	email: "wulan.kartikasari@email.com",
	phone: "+62 856 5554 7203",
	location: ["Surabaya, East Java", "Surabaya, Jawa Timur"],
	website: { url: "https://wulankartika.id", label: "wulankartika.id" },
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/wulankartikasari", link: "https://linkedin.com/in/wulankartikasari" },
		{ icon: "instagram", text: "@wulan.kartika", link: "https://instagram.com/wulan.kartika" },
	],
	summary: [
		"**Digital marketer with three years running paid ads, content and social for consumer brands.** I plan campaigns around clear targets, test new creative every week and move budget to what sells. I have managed Rp 4.8 billion in ad spend across Meta, Google and TikTok.",
		"**Digital marketer dengan tiga tahun pengalaman mengelola iklan berbayar, konten dan media sosial untuk merek konsumen.** Saya menyusun kampanye dengan target yang jelas, menguji materi iklan baru setiap pekan dan mengalihkan anggaran ke kanal yang paling menjual. Total belanja iklan yang pernah saya kelola mencapai Rp 4,8 miliar di Meta, Google dan TikTok.",
	],
	experience: [
		{
			company: "Teduh Living",
			position: "Digital Marketing Specialist",
			location: "Surabaya",
			period: ["Mar 2024 – Present", "Mar 2024 – Sekarang"],
			bullets: [
				[
					"Run Meta, Google and TikTok ads on a Rp 180 million monthly budget; return on ad spend rose from 2.9 to 4.6 in a year.",
					"Mengelola iklan Meta, Google dan TikTok dengan anggaran Rp 180 juta per bulan; ROAS naik dari 2,9 menjadi 4,6 dalam setahun.",
				],
				[
					"Set up weekly creative tests with the design team: 25 new ads a week, cost per purchase down 38%.",
					"Membangun uji materi iklan mingguan bersama tim desain: 25 iklan baru per pekan, biaya per pembelian turun 38%.",
				],
				[
					"Grew Instagram and TikTok from 40,000 to 210,000 followers with short videos and creator collaborations.",
					"Menumbuhkan pengikut Instagram dan TikTok dari 40.000 menjadi 210.000 lewat video pendek dan kolaborasi kreator.",
				],
			],
		},
		{
			company: "Rakit Media",
			position: ["Digital Marketing Executive", "Digital Marketing Executive"],
			location: "Surabaya",
			period: "Sep 2022 – Feb 2024",
			bullets: [
				[
					"Managed paid social and search for 9 clients in food, education and property, with Rp 1.6 billion in yearly spend.",
					"Mengelola iklan media sosial dan pencarian untuk 9 klien kuliner, pendidikan dan properti dengan belanja Rp 1,6 miliar per tahun.",
				],
				[
					"Cut a housing developer’s cost per lead from Rp 145,000 to Rp 62,000 with new landing pages and audience tests.",
					"Menurunkan biaya per lead pengembang perumahan dari Rp 145.000 menjadi Rp 62.000 lewat landing page baru dan uji audiens.",
				],
			],
		},
		{
			company: "Dapur Mbok Darmi",
			position: ["Social Media Intern", "Magang Media Sosial"],
			location: "Surabaya",
			period: ["Feb 2022 – Jul 2022", "Feb 2022 – Jul 2022"],
			bullets: [
				[
					"Wrote and scheduled 150 posts for a home-cooked food brand; online orders grew 60% during the internship.",
					"Menulis dan menjadwalkan 150 unggahan untuk merek masakan rumahan; pesanan daring naik 60% selama magang.",
				],
			],
		},
	],
	education: [
		{
			school: "Universitas Airlangga",
			degree: ["Bachelor of Communication", "Sarjana Ilmu Komunikasi (S.I.Kom.)"],
			area: ["Communication Science", "Ilmu Komunikasi"],
			grade: ["GPA 3.61", "IPK 3,61"],
			location: "Surabaya",
			period: "2018 – 2022",
		},
	],
	skills: [
		{ name: ["Paid media", "Iklan berbayar"], keywords: ["Meta Ads", "Google Ads", "TikTok Ads"] },
		{
			name: ["Content & social", "Konten & media sosial"],
			keywords: ["Copywriting", ["Short-form video", "Video pendek"], "CapCut", "Canva"],
		},
		{ name: ["Analytics", "Analitik"], keywords: ["GA4", "Looker Studio", "A/B testing", "Excel"] },
	],
	certifications: [
		{ title: "Google Ads Search Certification", issuer: "Google", date: "2024" },
		{ title: "Meta Certified Digital Marketing Associate", issuer: "Meta", date: "2023" },
		{ title: "Google Analytics Certification", issuer: "Google", date: "2025" },
		{ title: "Content Marketing Certification", issuer: "HubSpot Academy", date: "2023" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	columns: { skills: 3, certifications: 2, languages: 3 },
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "certifications", "languages"],
	},
};
