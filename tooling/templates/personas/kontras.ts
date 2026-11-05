import type { Persona } from "./persona";

/** Kontras, the bold poster: an art director and motion designer at an advertising agency in Jakarta. */
export const kontras: Persona = {
	name: "Andreas Rondonuwu",
	headline: "Art Director & Motion Designer",
	email: "andreas.rondonuwu@email.com",
	phone: "+62 812 5558 1973",
	location: "Jakarta, Indonesia",
	website: { url: "https://rondonuwu.studio", label: "rondonuwu.studio" },
	details: [
		{ icon: "behance-02", text: "behance.net/andreasrondonuwu", link: "https://behance.net/andreasrondonuwu" },
		{ icon: "vimeo", text: "vimeo.com/andreasrondonuwu", link: "https://vimeo.com/andreasrondonuwu" },
	],
	summary: [
		"**Art director and motion designer with nine years in design and advertising**, building campaigns that move, from six-second bumpers to a 60-metre LED facade. I take an idea from first sketch to final render and direct animators, illustrators and 3D artists toward one bold visual voice. My work has reached more than 120 million viewers on TV, online and out of home.",
		"**Art director dan motion designer dengan sembilan tahun pengalaman di desain dan periklanan**, membangun kampanye yang bergerak, dari bumper enam detik hingga fasad LED sepanjang 60 meter. Saya membawa ide dari sketsa pertama hingga render akhir, serta mengarahkan animator, ilustrator, dan artis 3D menuju satu suara visual yang tegas. Karya saya telah menjangkau lebih dari 120 juta penonton di TV, digital, dan media luar ruang.",
	],
	experience: [
		{
			company: "Pijar Lima Advertising",
			position: "Art Director",
			location: "Jakarta",
			period: ["Apr 2022 – Present", "Apr 2022 – Sekarang"],
			bullets: [
				[
					"Lead seven designers and animators on nine retainer brands in telco, banking and FMCG.",
					"Memimpin tujuh desainer dan animator untuk sembilan klien retainer di bidang telko, perbankan, dan FMCG.",
				],
				[
					"Directed a Ramadan campaign for a mobile network, viewed 48 million times; brand recall rose by 22 points.",
					"Mengarahkan kampanye Ramadan untuk operator seluler yang ditonton 48 juta kali; brand recall naik 22 poin.",
				],
				[
					"Built a motion toolkit in After Effects and Cinema 4D; storyboard to final cut fell from 15 days to 9.",
					"Menyusun toolkit motion di After Effects dan Cinema 4D; waktu dari storyboard ke materi final turun dari 15 menjadi 9 hari.",
				],
			],
		},
		{
			company: "Gerak Visual Studio",
			position: "Senior Motion Designer",
			location: "Jakarta",
			period: "Jan 2019 – Mar 2022",
			bullets: [
				[
					"Animated more than 140 TV and online spots for 30 clients, from explainers to title sequences.",
					"Menganimasikan lebih dari 140 iklan TV dan digital untuk 30 klien, dari video penjelasan hingga title sequence.",
				],
				[
					"Set up the studio’s 3D pipeline in Cinema 4D and Redshift, a new service worth 30% of revenue by 2021.",
					"Membangun pipeline 3D studio dengan Cinema 4D dan Redshift, layanan baru yang menyumbang 30% pendapatan pada 2021.",
				],
			],
		},
		{
			company: "Rangka Media",
			position: "Graphic Designer",
			location: "Jakarta",
			period: ["Aug 2017 – Dec 2018", "Agu 2017 – Des 2018"],
			bullets: [
				[
					"Designed daily social graphics and short videos for a news site; Instagram followers grew from 80,000 to 410,000.",
					"Merancang grafis dan video pendek harian untuk portal berita; pengikut Instagram tumbuh dari 80.000 menjadi 410.000.",
				],
			],
		},
	],
	projects: [
		{
			name: ["“City Lights” LED facade", "Fasad LED “Lampu Kota”"],
			period: "2025",
			description: [
				"Two-minute 3D loop on a 60-metre facade in Sudirman for a bank’s anniversary, seen by 2.3 million people a week.",
				"Animasi 3D dua menit di fasad LED 60 meter di Sudirman untuk ulang tahun sebuah bank; dilihat 2,3 juta orang per minggu.",
			],
		},
		{
			name: ["“Moving Proverbs” type series", "Seri tipografi “Peribahasa Bergerak”"],
			period: "2023",
			description: [
				"Personal series of 30 kinetic-type loops on Indonesian proverbs; 1.4 million views on Instagram and Vimeo.",
				"Seri pribadi berisi 30 animasi tipografi kinetik tentang peribahasa Indonesia; 1,4 juta tayangan di Instagram dan Vimeo.",
			],
		},
	],
	education: [
		{
			school: "Institut Kesenian Jakarta",
			degree: ["Bachelor of Design", "Sarjana Desain (S.Ds.)"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.52", "IPK 3,52"],
			location: "Jakarta",
			period: "2013 – 2017",
		},
	],
	skills: [
		{
			name: ["Art direction", "Art direction"],
			keywords: [["Campaign concepts", "Konsep kampanye"], "Storyboarding", ["Typography", "Tipografi"]],
		},
		{
			name: "Motion",
			keywords: [
				["2D animation", "Animasi 2D"],
				["3D & CGI", "3D & CGI"],
				["Kinetic type", "Tipografi kinetik"],
			],
		},
		{
			name: ["Tools", "Perangkat"],
			keywords: ["After Effects", "Cinema 4D", "Redshift", "Premiere Pro", "Figma"],
		},
	],
	awards: [
		{
			title: ["Gold, Motion Graphics", "Emas, Motion Graphics"],
			awarder: "Festival Iklan Nusantara",
			date: "2025",
		},
		{
			title: ["Best Title Sequence", "Title Sequence Terbaik"],
			awarder: "Pekan Motion Asia",
			date: "2021",
		},
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards"],
	},
	columns: { projects: 2, skills: 3, awards: 2 },
};
