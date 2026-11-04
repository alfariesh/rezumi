import type { Persona } from "./persona";

/** Aksara, the editorial page: a features editor and content strategist at a magazine. */
export const aksara: Persona = {
	name: "Laras Kusumawardhani",
	headline: ["Features Editor & Content Strategist", "Features Editor & Content Strategist"],
	email: "laras.kusumawardhani@email.com",
	phone: "+62 813 5552 4471",
	location: "Yogyakarta, Indonesia",
	website: { url: "https://laraskusuma.id", label: "laraskusuma.id" },
	summary: [
		"I edit long-form stories about cities, food and the people who keep them going, and I build the plans that bring those stories to readers. In ten years I have moved from a regional newsroom to leading the features desk of a magazine read by 2.3 million people a month, in print, on the web and as a podcast.",
		"Saya menyunting tulisan panjang tentang kota, makanan dan orang-orang yang menghidupinya, lalu merancang strategi agar cerita itu sampai ke pembaca. Dalam sepuluh tahun saya berpindah dari ruang redaksi daerah hingga memimpin desk feature majalah yang dibaca 2,3 juta orang setiap bulan, di cetak, situs, dan podcast.",
	],
	experience: [
		{
			company: "Majalah Lembayung",
			position: ["Features Editor & Content Strategist", "Features Editor & Content Strategist"],
			location: "Yogyakarta",
			period: ["Feb 2022 – Present", "Feb 2022 – Sekarang"],
			bullets: [
				[
					"Lead a desk of six writers and two photographers; commission and edit 10 long-form features a month.",
					"Memimpin enam penulis dan dua fotografer; menugaskan dan menyunting 10 feature panjang setiap bulan.",
				],
				[
					"Rebuilt the editorial calendar around reader data; average reading time rose from 2:40 to 6:15 minutes.",
					"Menata ulang kalender redaksi dengan data pembaca; rata-rata waktu baca naik dari 2:40 menjadi 6:15 menit.",
				],
				[
					"Created and host Ruang Tunggu, a weekly podcast on public services with 45,000 listeners a month.",
					"Menggagas dan membawakan Ruang Tunggu, podcast mingguan dengan 45.000 pendengar per bulan.",
				],
				[
					"Launched a paid weekly newsletter that reached 18,000 subscribers in its first year.",
					"Meluncurkan newsletter mingguan berbayar yang mencapai 18.000 pelanggan pada tahun pertama.",
				],
			],
		},
		{
			company: "Kanal Kota",
			position: ["Senior Writer", "Senior Writer"],
			location: "Jakarta",
			period: ["Jun 2018 – Jan 2022", "Jun 2018 – Jan 2022"],
			bullets: [
				[
					"Wrote 60+ features on urban life and public services; three were cited in city council hearings.",
					"Menulis 60+ feature tentang kehidupan kota dan layanan publik; tiga di antaranya dikutip dalam rapat DPRD.",
				],
				[
					"Set up the site's first SEO and headline-testing guide, doubling search traffic to features in a year.",
					"Menyusun panduan SEO dan uji judul pertama situs; trafik pencarian ke feature berlipat dua dalam setahun.",
				],
			],
		},
		{
			company: "Warta Jogja",
			position: ["Reporter", "Reporter"],
			location: "Yogyakarta",
			period: ["Aug 2015 – May 2018", "Agu 2015 – Mei 2018"],
			bullets: [
				[
					"Covered culture, education and city hall for a daily paper; filed four stories a week.",
					"Meliput budaya, pendidikan dan balai kota untuk harian lokal; menulis empat berita setiap pekan.",
				],
			],
		},
	],
	publications: [
		{
			title: "Kota yang Tenggelam Pelan-pelan",
			publisher: "Majalah Lembayung",
			date: ["Sep 2024", "Sep 2024"],
			description: ["Land subsidence on the north coast of Java.", "Penurunan muka tanah di pesisir utara Jawa."],
		},
		{
			title: "Dapur Terakhir di Gang Sayidan",
			publisher: "Majalah Lembayung",
			date: ["Mar 2023", "Mar 2023"],
			description: ["A year inside a 70-year-old family warung.", "Setahun di dalam warung keluarga berusia 70 tahun."],
		},
	],
	education: [
		{
			school: "Universitas Gadjah Mada",
			degree: ["Bachelor of Communication Science", "Sarjana Ilmu Komunikasi"],
			area: ["Journalism", "Jurnalistik"],
			grade: ["GPA 3.64", "IPK 3,64"],
			location: "Yogyakarta",
			period: "2011 – 2015",
		},
	],
	skills: [
		{
			name: ["Editorial", "Redaksi"],
			keywords: [
				["Editing", "Penyuntingan"],
				["Commissioning", "Penugasan"],
				["Fact-checking", "Cek fakta"],
			],
		},
		{
			name: ["Strategy", "Strategi"],
			keywords: [["Content calendars", "Kalender konten"], "SEO", "Google Analytics"],
		},
		{ name: "Audio", keywords: [["Scripting", "Naskah audio"], "Hindenburg", "Audition"] },
	],
	awards: [
		{
			title: ["Best Long-Form Feature", "Feature Panjang Terbaik"],
			awarder: "Anugerah Pena Nusantara",
			date: "2024",
		},
		{
			title: ["Public Service Reporting, finalist", "Finalis Liputan Layanan Publik"],
			awarder: ["Forum Pewarta Kota", "Forum Pewarta Kota"],
			date: "2020",
		},
	],
	titles: { publications: ["Selected Features", "Tulisan Pilihan"] },
	layout: {
		main: ["summary", "experience", "publications", "education"],
		sidebar: ["skills", "awards"],
	},
	columns: { publications: 2, skills: 3, awards: 2 },
};
