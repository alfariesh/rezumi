import type { Persona } from "./persona";

/** Senja: a creative director and photographer at an independent agency in Bandung. */
export const senja: Persona = {
	photo: true,
	name: "Bayu Saputra",
	headline: ["Creative Director & Photographer", "Creative Director & Fotografer"],
	email: "bayu.saputra@email.com",
	phone: "+62 857 5557 1462",
	location: "Bandung, Indonesia",
	website: { url: "https://bayusaputra.photo", label: "bayusaputra.photo" },
	details: [
		{ icon: "instagram", text: "@bayu.saputra.studio", link: "https://instagram.com/bayu.saputra.studio" },
		{ icon: "behance-02", text: "behance.net/bayusaputra", link: "https://behance.net/bayusaputra" },
	],
	summary: [
		"**Creative director and photographer who still shoots his own campaigns.** For eight years I have built brands for coffee roasters, batik houses and outdoor labels across West Java, from the first moodboard to the last retouch. I like small teams, honest light and ideas that work on a billboard and a phone screen alike.",
		"**Creative director dan fotografer yang masih memotret sendiri kampanyenya.** Selama delapan tahun saya membangun merek untuk roastery kopi, rumah batik, dan label outdoor di Jawa Barat, dari moodboard pertama hingga retouch terakhir. Saya menyukai tim kecil, cahaya yang jujur, dan ide yang sama kuatnya di baliho maupun layar ponsel.",
	],
	experience: [
		{
			company: "Rimbun Kreatif",
			position: "Creative Director",
			location: "Bandung",
			period: ["Mar 2023 – Present", "Mar 2023 – Sekarang"],
			bullets: [
				[
					"Lead 12 designers, copywriters and photographers serving 20 retainer brands.",
					"Memimpin 12 desainer, copywriter, dan fotografer untuk 20 klien retainer.",
				],
				[
					"Won 21 of 36 pitches in two years; agency revenue grew by 64%.",
					"Memenangkan 21 dari 36 pitch dalam dua tahun; pendapatan agensi tumbuh 64%.",
				],
				[
					"Built an in-house photo and video studio; cut production costs by 35%.",
					"Membangun studio foto dan video internal; biaya produksi turun 35%.",
				],
			],
		},
		{
			company: "Rimbun Kreatif",
			position: "Art Director",
			location: "Bandung",
			period: ["Jan 2020 – Feb 2023", "Jan 2020 – Feb 2023"],
			bullets: [
				[
					"Art-directed 45 campaigns for food, fashion and tourism brands across print, social and video, from concept to final edit.",
					"Mengarahkan visual 45 kampanye untuk merek kuliner, fesyen, dan pariwisata di media cetak, sosial, dan video, dari konsep hingga suntingan akhir.",
				],
				[
					"Rebranded nine local businesses; average engagement rose 2.4 times.",
					"Me-rebrand sembilan usaha lokal; rata-rata engagement naik 2,4 kali.",
				],
			],
		},
		{
			company: "Studio Garis Tepi",
			position: ["Junior Graphic Designer", "Junior Graphic Designer"],
			location: "Bandung",
			period: ["Jul 2018 – Dec 2019", "Jul 2018 – Des 2019"],
			bullets: [
				[
					"Designed packaging for 30 products, one range now in 1,400 minimarkets.",
					"Mendesain kemasan 30 produk; satu lini kini dijual di 1.400 minimarket.",
				],
			],
		},
		{
			company: "Bayu Saputra Photo",
			position: ["Commercial & Editorial Photographer", "Fotografer Komersial & Editorial"],
			location: "Bandung",
			period: ["2017 – Present", "2017 – Sekarang"],
			bullets: [
				[
					"Shot food, product and portraits for 60+ clients, with 14 magazine covers.",
					"Memotret produk, kuliner, dan potret untuk 60+ klien; 14 sampul majalah.",
				],
				[
					"Licensed 900 stock images; teach a monthly lighting workshop for 15 students.",
					"Melisensikan 900 foto stok; mengajar kelas cahaya bulanan (15 peserta).",
				],
			],
		},
	],
	projects: [
		{
			name: ["Kopi Tanah Tinggi · “From the Slopes”", "Kopi Tanah Tinggi · “Dari Lereng”"],
			period: "2025",
			description: [
				"Campaign shot on three farms in Pangalengan; 12 million video views and online sales up 40% in a quarter.",
				"Kampanye yang dipotret di tiga kebun di Pangalengan; 12 juta tayangan video dan penjualan daring naik 40% dalam satu kuartal.",
			],
		},
		{
			name: ["Batik Lembayung rebrand", "Rebranding Batik Lembayung"],
			period: "2024",
			description: [
				"New identity, lookbook and store graphics for a 40-year-old batik house; first collection sold out in nine days.",
				"Identitas baru, lookbook, dan grafis toko untuk rumah batik berusia 40 tahun; koleksi pertama habis dalam sembilan hari.",
			],
		},
		{
			name: ["“The City After Rain”, solo exhibition", "Pameran tunggal “Kota Setelah Hujan”"],
			period: "2022",
			description: [
				"28 night photographs of Bandung, a month at Ruang Seni Dago; 3,100 visitors.",
				"28 foto malam Bandung, dipamerkan sebulan di Ruang Seni Dago; 3.100 pengunjung.",
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Design", "Sarjana Desain (S.Ds.)"],
			area: ["Visual Communication Design", "Desain Komunikasi Visual"],
			grade: ["GPA 3.52", "IPK 3,52"],
			location: "Bandung",
			period: "2014 – 2018",
		},
	],
	skills: [
		{
			name: ["Creative", "Kreatif"],
			keywords: [
				["Creative direction", "Creative direction"],
				["Brand identity", "Identitas merek"],
				["Art direction", "Art direction"],
				["Storyboarding", "Storyboard"],
			],
		},
		{
			name: ["Photography", "Fotografi"],
			keywords: [
				["Product", "Produk"],
				["Editorial", "Editorial"],
				["Portrait", "Potret"],
				["Lighting", "Tata cahaya"],
			],
		},
		{
			name: "Tools",
			keywords: ["Photoshop", "Illustrator", "Lightroom", "Capture One", "Figma", "DaVinci Resolve"],
		},
	],
	awards: [
		{
			title: ["Gold, Brand Identity", "Emas, Identitas Merek"],
			awarder: "Anugerah Desain Kreatif Nusantara",
			date: "2024",
		},
		{ title: ["Winner, Street category", "Juara, Kategori Street"], awarder: "Lensa Muda Photo Award", date: "2021" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Sundanese", "Bahasa Sunda"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	interests: [
		{ name: ["Film photography", "Fotografi film"] },
		{ name: ["Volcano hikes", "Mendaki gunung"] },
		{ name: ["Vinyl records", "Piringan hitam"] },
	],
	layout: {
		main: ["summary", "experience", "projects", "education"],
		sidebar: ["skills", "awards", "languages", "interests"],
	},
};
