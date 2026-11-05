import type { Persona } from "./persona";

/** Ivory: a senior product designer leading design systems and research at a health app in Jakarta. */
export const ivory: Persona = {
	name: "Clarissa Tanuwidjaja",
	headline: ["Senior Product Designer · Design Systems", "Senior Product Designer · Design System"],
	email: "clarissa.tanuwidjaja@email.com",
	phone: "+62 817 5559 2638",
	location: "Jakarta, Indonesia",
	website: { url: "https://clarissatanu.design", label: "clarissatanu.design" },
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/clarissatanu",
			link: "https://linkedin.com/in/clarissatanu",
		},
		{ icon: "dribbble", text: "dribbble.com/clarissatanu", link: "https://dribbble.com/clarissatanu" },
	],
	summary: [
		"**Product designer with ten years in health and mobility apps.** I build design systems that let squads ship consistent screens faster, and I back every big change with research: interviews, usability tests and the numbers after launch.",
		"**Product designer dengan sepuluh tahun pengalaman di aplikasi kesehatan dan mobilitas.** Saya membangun design system yang membuat tim merilis layar yang konsisten lebih cepat, dan setiap perubahan besar saya dukung dengan riset: wawancara, uji kegunaan, dan data setelah rilis.",
	],
	experience: [
		{
			company: "Kanaya Health",
			position: "Senior Product Designer, Design Systems",
			location: "Jakarta",
			period: ["Mar 2022 – Present", "Mar 2022 – Sekarang"],
			bullets: [
				[
					"Lead the Lentera design system: 140 components and tokens used by 9 squads on web, iOS and Android.",
					"Memimpin design system Lentera: 140 komponen dan token yang dipakai 9 tim di web, iOS, dan Android.",
				],
				[
					"Cut design-to-build time for new screens by 38% and halved UI defects caught in QA.",
					"Memangkas waktu dari desain hingga build layar baru sebesar 38% dan menekan cacat UI di QA hingga separuhnya.",
				],
				[
					"Redesigned telemedicine booking after 30 patient interviews; completed bookings rose from 61% to 79%.",
					"Mendesain ulang pemesanan telemedisin setelah mewawancarai 30 pasien; pemesanan yang tuntas naik dari 61% menjadi 79%.",
				],
			],
		},
		{
			company: "Lajur",
			position: "Product Designer",
			location: "Jakarta",
			period: "Jul 2019 – Feb 2022",
			bullets: [
				[
					"Designed the partner app for 45,000 motorbike drivers; tested every release with drivers at three hubs.",
					"Merancang aplikasi mitra untuk 45.000 pengemudi ojek; setiap rilis diuji bersama pengemudi di tiga hub.",
				],
				[
					"Simplified the in-app wallet top-up; payment support tickets fell by 27%.",
					"Menyederhanakan isi ulang dompet di aplikasi; tiket bantuan soal pembayaran turun 27%.",
				],
			],
		},
		{
			company: "Studio Piksel Sembilan",
			position: "UI/UX Designer",
			location: "Jakarta",
			period: ["Aug 2016 – Jun 2019", "Agu 2016 – Jun 2019"],
			bullets: [
				[
					"Designed websites and apps for 20+ clients in retail, banking and education.",
					"Merancang situs dan aplikasi untuk lebih dari 20 klien di bidang ritel, perbankan, dan pendidikan.",
				],
			],
		},
	],
	projects: [
		{
			name: "Lentera Design System",
			period: "2022 – 2025",
			description: [
				"Tokens, a Figma library and a React kit with docs; adopted by 9 squads, up from 2, in 18 months.",
				"Token, pustaka Figma, dan kit React beserta dokumentasi; dipakai 9 tim, dari semula 2, dalam 18 bulan.",
			],
		},
		{
			name: ["Clinic booking for older patients", "Pemesanan klinik untuk pasien lansia"],
			period: "2024",
			description: [
				"Field research with 24 patients over 60; larger type and voice prompts doubled their completed bookings.",
				"Riset lapangan dengan 24 pasien berusia di atas 60 tahun; huruf besar dan panduan suara membuat pemesanan yang tuntas naik dua kali lipat.",
			],
		},
	],
	education: [
		{
			school: "Universitas Bina Nusantara",
			degree: ["Bachelor of Design", "Sarjana Desain (S.Ds.)"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.62", "IPK 3,62"],
			location: "Jakarta",
			period: "2012 – 2016",
		},
	],
	skills: [
		{
			name: ["Design", "Desain"],
			keywords: [
				["Design systems", "Design system"],
				["Interaction design", "Desain interaksi"],
				"Prototyping",
				["Accessibility", "Aksesibilitas"],
			],
		},
		{
			name: ["Research", "Riset"],
			keywords: [
				["Interviews", "Wawancara"],
				["Usability testing", "Uji kegunaan"],
				["Diary studies", "Diary study"],
			],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Figma", "Tokens Studio", "Storybook", "Maze"] },
	],
	awards: [
		{
			title: ["Gold, Digital Health Product", "Emas, Produk Kesehatan Digital"],
			awarder: ["Nusantara Digital Design Awards", "Anugerah Desain Digital Nusantara"],
			date: "2024",
		},
		{
			title: ["Finalist, Inclusive Design Challenge", "Finalis, Tantangan Desain Inklusif"],
			awarder: "Forum Desain Inklusif Asia",
			date: "2023",
		},
	],
	columns: { projects: 2, skills: 3 },
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards"],
	},
};
