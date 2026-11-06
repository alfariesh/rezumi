import type { PersonaDefinition } from "../persona";

/** Kanvas: Bayu Saputra, a creative director and photographer in Bandung (`mockups/kanvas.html`). */
export const bayu: PersonaDefinition = {
	id: "bayu",
	theme: "kanvas",
	resume: "senja",
	username: "bayu",
	accent: "rgba(214, 96, 63, 1)",
	photo: "bayu.jpg",
	profiles: [
		{
			network: "Instagram",
			username: "bayu.saputra.studio",
			url: "https://instagram.com/bayu.saputra.studio",
			icon: "instagram",
		},
		{ network: "Behance", username: "bayusaputra", url: "https://www.behance.net/bayusaputra", icon: "behance-01" },
	],
	minimal: ["Creative director and photographer in Bandung.", "Creative director dan fotografer di Bandung."],
	long: {
		name: "Bayu Satriawibisanaputra Saputra Mangkunegoro",
		headline: [
			"Creative Director & Photographer for brand campaigns, visual identity, packaging and editorial portraits",
			"Creative Director & Fotografer untuk kampanye merek, identitas visual, kemasan, dan potret editorial",
		],
	},
	arabic: {
		headline: "مدير إبداعي ومصوّر",
		greeting: "أبني العلامات التجارية من أول لوحة إلهام حتى آخر تعديل، وما زلت أصوّر حملاتها بنفسي.",
		availability: "أقبل مشاريع حملات 2026",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		hero: {
			greeting: t([
				"I build brands from the first moodboard to the last retouch, and still shoot their campaigns myself.",
				"Saya membangun merek dari moodboard pertama sampai retouch terakhir, dan masih memotret sendiri kampanyenya.",
			]),
			showPicture: true,
			availability: { show: true, text: t(["Taking campaign projects for 2026", "Menerima proyek kampanye 2026"]) },
			highlights: [
				metric("hl-1", ["pitches won", "pitch dimenangkan"], "21/36"),
				metric("hl-2", ["magazine covers", "sampul majalah"], 14),
				metric("hl-3", ["photo clients", "klien foto"], 60, { suffix: "+" }),
			],
			buttons: [
				{ kind: "contact", label: t(["Work with me", "Ajak kerja sama"]) },
				{ kind: "resume", label: t(["View CV", "Lihat CV"]) },
			],
			effect: {
				phrases: [t(["Art director", "Art director"]), t(["Commercial photographer", "Fotografer komersial"])],
			},
		},
		about: {
			content: t([
				"<p><strong>Creative director and photographer who still shoots his own campaigns.</strong> For eight years I have built brands for coffee roasters, batik houses and outdoor labels across West Java.</p><p>I like small teams, honest light, and ideas that are just as strong on a billboard as on a phone screen.</p>",
				"<p><strong>Creative director dan fotografer yang masih memotret sendiri kampanyenya.</strong> Selama delapan tahun saya membangun merek untuk roastery kopi, rumah batik, dan label outdoor di Jawa Barat.</p><p>Saya menyukai tim kecil, cahaya yang jujur, dan ide yang sama kuatnya di baliho maupun layar ponsel.</p>",
			]),
		},
		works: {
			items: [
				work({
					id: "w-slopes",
					slug: "dari-lereng",
					title: ["Kopi Tanah Tinggi · “From the Slopes”", "Kopi Tanah Tinggi · “Dari Lereng”"],
					summary: [
						"A campaign shot on three farms in Pangalengan; 12 million video views.",
						"Kampanye yang dipotret di tiga kebun di Pangalengan; 12 juta tayangan video.",
					],
					role: ["Creative director & photographer", "Creative director & fotografer"],
					date: "2025",
					tags: [["Campaign", "Kampanye"], ["Photography", "Fotografi"], "Video"],
					cover: "kanvas-1.svg",
					featured: true,
					metrics: [
						metric("m-sales", ["Online sales", "Penjualan daring"], 40, {
							format: "percent",
							prefix: "+",
							change: { direction: "up", text: "+40%", good: true },
							context: ["one quarter", "satu kuartal"],
						}),
						metric("m-views", ["Video views", "Tayangan video"], 12_000_000, {
							format: "compact",
							change: { direction: "up", text: ["8 weeks", "8 minggu"], good: true },
							before: 400_000,
							series: [0.4, 1.8, 4.1, 6.6, 8.2, 9.9, 11.2, 12],
							context: ["first 8 weeks", "8 minggu pertama"],
						}),
						metric("m-cost", ["Production cost", "Biaya produksi"], 60_000_000, {
							format: "currency",
							currency: "IDR",
							change: { direction: "down", text: "−35%", good: true },
							before: 92_000_000,
							context: ["in-house studio", "studio internal"],
						}),
					],
					blocks: [
						text("w-slopes-t", [
							"<h3>Problem</h3><p>A small roaster from Pangalengan wanted to be known beyond Bandung without looking like a city coffee brand. The brief was one sentence: show the slopes.</p><h3>My role</h3><ul><li>Directed the concept, script and campaign visuals.</li><li>Shot 3 farms over 6 mornings, from dawn to harvest.</li><li>Oversaw the video edit and shop materials.</li></ul>",
							"<h3>Masalah</h3><p>Roastery kecil dari Pangalengan ingin dikenal di luar Bandung tanpa terlihat seperti merek kopi kota. Briefnya satu kalimat: tunjukkan lerengnya.</p><h3>Peran saya</h3><ul><li>Mengarahkan konsep, naskah, dan visual kampanye.</li><li>Memotret 3 kebun selama 6 pagi, dari subuh hingga panen.</li><li>Mengawasi suntingan video dan materi toko.</li></ul>",
						]),
						{
							id: "w-slopes-g",
							type: "images",
							layout: "full",
							images: [
								{
									...picture("kanvas-g1.svg", ["The first farm, 5.40 am", "Kebun pertama, 05.40"]),
									caption: t(["The first farm, 5.40 am", "Kebun pertama, 05.40"]),
								},
								{
									...picture("kanvas-g2.svg", ["Pickers on the top plot", "Pemetik di petak atas"]),
									caption: t(["Pickers on the top plot", "Pemetik di petak atas"]),
								},
								{
									...picture("kanvas-g3.svg", ["Mist after the harvest", "Kabut turun setelah panen"]),
									caption: t(["Mist after the harvest", "Kabut turun setelah panen"]),
								},
							],
						},
						text("w-slopes-p", [
							"<h3>Process</h3><p>We stayed three days in Pangalengan and shot before seven, while the mist was still down and the light still blue.</p><p>No models: every face in the campaign is a picker or a farm owner, with written consent.</p><blockquote><p>Six o'clock light did half our work.</p></blockquote>",
							"<h3>Proses</h3><p>Kami tinggal tiga hari di Pangalengan dan memotret sebelum pukul tujuh, saat kabut masih turun dan cahaya masih biru.</p><p>Tidak ada model: semua wajah di kampanye adalah pemetik dan pemilik kebun, dengan izin tertulis.</p><blockquote><p>Cahaya pukul enam pagi melakukan separuh pekerjaan kami.</p></blockquote>",
						]),
						{
							id: "w-slopes-v",
							type: "video",
							provider: "vimeo",
							videoId: "918273645",
							title: t(["Behind the scenes: three farms, one morning", "Di balik layar: tiga kebun, satu pagi"]),
							thumbnail: picture("kanvas-video.svg", ["Video: behind the scenes", "Video: di balik layar"]),
						},
						{
							id: "w-slopes-pdf",
							type: "pdf",
							file: pdf("lookbook", "From the Slopes lookbook", 24),
							title: t(["“From the Slopes” campaign lookbook", "Lookbook kampanye “Dari Lereng”"]),
							pages: 24,
							bytes: 8_600_000,
							preview: picture("kanvas-pdf.svg", ["The lookbook's cover", "Sampul lookbook"], {
								width: 800,
								height: 1131,
							}),
						},
						{
							id: "w-slopes-l",
							type: "link",
							url: "https://www.behance.net/gallery/kopi-tanah-tinggi-dari-lereng",
							title: t(["Kopi Tanah Tinggi — From the Slopes", "Kopi Tanah Tinggi — Dari Lereng"]),
							description: t([
								"The full project with 40 photographs and team credits.",
								"Proyek lengkap dengan 40 foto dan kredit tim.",
							]),
							siteName: "behance.net",
							brandIcon: "behance-01",
							image: picture("kanvas-g2.svg", ["Pickers on the top plot", "Pemetik di petak atas"]),
						},
						text("w-slopes-r", [
							"<h3>Result</h3><p>The campaign video was watched 12 million times in eight weeks. Online sales rose 40% in a quarter, and production costs fell 35% thanks to the in-house studio.</p>",
							"<h3>Hasil</h3><p>Video kampanye ditonton 12 juta kali dalam delapan minggu. Penjualan daring naik 40% dalam satu kuartal, dan biaya produksi turun 35% berkat studio internal.</p>",
						]),
					],
				}),
				work({
					id: "w-batik",
					slug: "batik-lembayung",
					title: ["Batik Lembayung rebrand", "Rebranding Batik Lembayung"],
					summary: [
						"Identity, lookbook and shop graphics for a 40-year-old batik house.",
						"Identitas, lookbook, dan grafis toko untuk rumah batik berusia 40 tahun.",
					],
					role: "Creative director",
					date: "2024",
					tags: [["Identity", "Identitas"], "Lookbook"],
					cover: "kanvas-2.svg",
					metrics: [metric("m-batik", ["Collection sold out", "Koleksi habis"], ["9 days", "9 hari"])],
					blocks: [
						text("w-batik-t", [
							"<p>We kept the house's old stamp and gave it a new typeface, a paper bag and a lookbook shot in the workshop.</p>",
							"<p>Kami mempertahankan cap lama rumah batik itu, lalu memberinya huruf baru, tas kertas, dan lookbook yang dipotret di bengkel.</p>",
						]),
					],
				}),
				work({
					id: "w-rain",
					slug: "kota-setelah-hujan",
					title: ["“City After Rain” exhibition", "Pameran “Kota Setelah Hujan”"],
					summary: [
						"28 night photographs of Bandung, shown for a month at Ruang Seni Dago.",
						"28 foto malam Bandung, dipamerkan sebulan di Ruang Seni Dago.",
					],
					role: ["Photographer", "Fotografer"],
					date: "2022",
					tags: [["Exhibition", "Pameran"], "Street"],
					cover: "kanvas-3.svg",
					metrics: [metric("m-rain", ["Visitors", "Pengunjung"], 3100)],
					blocks: [
						text("w-rain-t", [
							"<p>Shot over two rainy seasons, always within an hour after the rain stopped.</p>",
							"<p>Dipotret selama dua musim hujan, selalu dalam satu jam setelah hujan berhenti.</p>",
						]),
					],
				}),
				work({
					id: "w-renyah",
					slug: "kemasan-renyah",
					title: ["Renyah snack packaging", "Kemasan camilan Renyah"],
					summary: [
						"One packaging line now sold in 1,400 minimarkets.",
						"Satu lini kemasan yang kini dijual di 1.400 minimarket.",
					],
					role: ["Packaging designer", "Desainer kemasan"],
					date: "2019",
					tags: [["Packaging", "Kemasan"]],
					cover: "kanvas-4.svg",
					metrics: [metric("m-renyah", ["Minimarkets", "Minimarket"], 1400)],
					blocks: [
						text("w-renyah-t", [
							"<p>Big flavour names and one colour per flavour, readable from the end of the aisle.</p>",
							"<p>Nama rasa yang besar dan satu warna per rasa, terbaca dari ujung lorong.</p>",
						]),
					],
				}),
				work({
					id: "w-north",
					slug: "jalur-utara",
					title: ["Jalur Utara · winter", "Jalur Utara · musim dingin"],
					summary: [
						"An outdoor label's campaign shot on a mountain ridge at four in the morning.",
						"Kampanye label outdoor yang dipotret di punggung gunung pukul empat pagi.",
					],
					role: ["Art director & photographer", "Art director & fotografer"],
					date: "2023",
					tags: [["Campaign", "Kampanye"], "Outdoor"],
					cover: "kanvas-5.svg",
					metrics: [
						metric("m-north", "Engagement", 2.4, {
							format: "multiplier",
							change: { direction: "up", text: ["2.4×", "2,4×"], good: true },
						}),
					],
					blocks: [
						text("w-north-t", [
							"<p>Three climbers, one guide and a single torch for light until the sun came up.</p>",
							"<p>Tiga pendaki, satu pemandu, dan satu senter sebagai cahaya sampai matahari terbit.</p>",
						]),
					],
				}),
				work({
					id: "w-covers",
					slug: "sampul-editorial",
					title: ["Portraits for 14 magazine covers", "Potret untuk 14 sampul majalah"],
					summary: [
						"Editorial portraits of West Java's musicians, cooks and craftspeople.",
						"Potret editorial musisi, koki, dan perajin Jawa Barat.",
					],
					role: ["Photographer", "Fotografer"],
					date: "2017–2025",
					tags: ["Editorial", ["Portrait", "Potret"]],
					cover: "kanvas-6.svg",
					metrics: [metric("m-covers", ["Covers", "Sampul"], 14)],
					blocks: [
						text("w-covers-t", [
							"<p>Each portrait made where the person works, with the light that was there.</p>",
							"<p>Setiap potret dibuat di tempat orangnya bekerja, dengan cahaya yang ada di sana.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["Campaign creative direction", "Creative direction kampanye"]),
					description: t([
						"From the idea and moodboard to the photo, video and shop materials.",
						"Dari ide dan moodboard sampai produksi foto, video, dan materi toko.",
					]),
					price: t(["From IDR 35m", "Mulai Rp35 jt"]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
				{
					id: "sv-2",
					title: t(["Product & food photography", "Foto produk & kuliner"]),
					description: t([
						"A day's shoot in the studio or on location, with 25 retouched final photos.",
						"Sehari pemotretan di studio atau lokasi, termasuk 25 foto final yang sudah diretouch.",
					]),
					price: t(["From IDR 4.5m / day", "Mulai Rp4,5 jt / hari"]),
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
				{
					id: "sv-3",
					title: t(["Lighting class", "Kelas tata cahaya"]),
					description: t([
						"A monthly three-hour class for 15 people, bring your own camera.",
						"Kelas bulanan tiga jam untuk 15 peserta, membawa kamera sendiri.",
					]),
					price: t(["IDR 450k / person", "Rp450 rb / orang"]),
					cta: { kind: "link", label: t(["See details", "Lihat detail"]), url: "https://bayusaputra.photo/kelas" },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Bayu photographed our farm like someone who grew up there. The campaign feels honest, and sales went up with it.",
						"Bayu memotret kebun kami seperti orang yang tumbuh di sana. Kampanyenya terasa jujur, dan penjualan ikut naik.",
					]),
					name: "Maya Lestari",
					role: t(["Founder, Kopi Tanah Tinggi", "Pendiri, Kopi Tanah Tinggi"]),
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"From a one-page brief, Bayu's team gave us an identity that makes our batik house feel young again.",
						"Dari brief satu halaman, tim Bayu memberi identitas yang membuat rumah batik kami terasa muda lagi.",
					]),
					name: "Ratih Sumarni",
					role: t(["Owner, Batik Lembayung", "Pemilik, Batik Lembayung"]),
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"He knows when to wait for the light. Our covers have never looked this good.",
						"Ia tahu kapan harus menunggu cahaya. Sampul kami tak pernah sebagus ini.",
					]),
					name: "Arya Gunawan",
					role: t(["Photo editor, Majalah Rupa", "Redaktur foto, Majalah Rupa"]),
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Kopi Tanah Tinggi", logo: logo("Kopi Tanah Tinggi", 2, "#6B4423") },
				{ id: "cl-2", name: "Batik Lembayung", logo: logo("Batik Lembayung", 4, "#7C3AED") },
				{ id: "cl-3", name: "Jalur Utara", logo: logo("Jalur Utara", 5, "#0F766E") },
				{ id: "cl-4", name: "Renyah", logo: logo("Renyah", 3, "#D6603F") },
				{ id: "cl-5", name: "Majalah Rupa" },
				{ id: "cl-6", name: "Rimbun Kreatif" },
			],
		},
		custom: [
			{
				id: "exhibition",
				title: t(["Next exhibition", "Pameran berikutnya"]),
				content: t([
					"<p>“Pasar Subuh”: 20 photographs of Bandung's traditional markets before sunrise. March 2026, Ruang Seni Dago.</p>",
					"<p>“Pasar Subuh”: 20 foto pasar tradisional Bandung sebelum matahari terbit. Maret 2026, Ruang Seni Dago.</p>",
				]),
				image: picture("kanvas-g3.svg", ["A market before sunrise", "Pasar sebelum matahari terbit"]),
				button: {
					kind: "link",
					label: t(["Ask for an invitation", "Minta undangan"]),
					url: "https://bayusaputra.photo/pasar-subuh",
				},
				hidden: false,
			},
		],
		location: {
			label: "Bandung, Indonesia",
			point: { lat: -6.92, lng: 107.61, precision: "city" },
			showMap: true,
			map: {
				light: picture("map-kanvas-light.svg", ["Map around Bandung", "Peta sekitar Bandung"], {
					width: 800,
					height: 480,
				}),
				dark: picture("map-kanvas-dark.svg", ["Map around Bandung", "Peta sekitar Bandung"], {
					width: 800,
					height: 480,
				}),
			},
			workModes: ["onsite", "remote"],
			relocate: false,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: true,
			whatsapp: { show: true, number: "6285755571462" },
			form: false,
			profiles: true,
			note: t([
				"Got a brand that needs a visual story? Tell me your brief.",
				"Punya merek yang butuh cerita visual? Ceritakan briefmu.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
