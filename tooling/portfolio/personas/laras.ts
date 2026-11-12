import type { PersonaDefinition } from "../persona";

/**
 * Warta: Laras Kusumawardhani, a features editor and content strategist in Yogyakarta (the gallery's Aksara resume).
 * Her works read as articles, so each one's first tag is its rubric. Every publication, number and person here is made
 * up; the drawings are `mockups/img/warta-*.svg`.
 */
export const laras: PersonaDefinition = {
	id: "laras",
	theme: "warta",
	resume: "aksara",
	username: "laras",
	accent: "rgba(180, 35, 24, 1)",
	photo: "laras.jpg",
	profiles: [
		{
			network: "LinkedIn",
			username: "laraskusuma",
			url: "https://www.linkedin.com/in/laraskusuma",
			icon: "linkedin-02",
		},
		{ network: "Medium", username: "laraskusuma", url: "https://medium.com/@laraskusuma", icon: "medium" },
	],
	minimal: ["Features editor in Yogyakarta.", "Editor feature di Yogyakarta."],
	long: {
		name: "Gusti Raden Ayu Laras Kusumawardhani Pringgodigdokusumowati",
		headline: [
			"Features editor, content strategist and podcast host for long-form journalism, city reporting and reader-funded newsletters",
			"Editor feature, ahli strategi konten, dan pembawa podcast untuk jurnalisme panjang, liputan kota, dan newsletter berbayar",
		],
	},
	arabic: {
		headline: "محررة تحقيقات واستراتيجية محتوى",
		greeting: "أحرر قصصاً طويلة عن المدن والطعام والناس الذين يحيونها، ثم أخطط لوصولها إلى القرّاء.",
		availability: "متاحة لأدوار مديرة التحرير",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		hero: {
			greeting: t([
				"I edit long-form stories about cities, food and the people who keep them going, then plan how they reach readers.",
				"Saya menyunting tulisan panjang tentang kota, makanan, dan orang-orang yang menghidupinya, lalu merancang jalannya ke pembaca.",
			]),
			showPicture: true,
			availability: {
				show: true,
				text: t(["Open to managing editor roles", "Terbuka untuk peran managing editor"]),
				roles: ["Managing Editor", "Head of Content"],
				types: ["full-time", "freelance"],
			},
			highlights: [
				metric("hl-1", ["Average reading time", "Rata-rata waktu baca"], "6:15", {
					context: ["minutes, up from 2:40", "menit, dari 2:40"],
				}),
				metric("hl-2", ["Newsletter subscribers", "Pelanggan newsletter"], 18_000, { format: "compact" }),
				metric("hl-3", ["Podcast listeners a month", "Pendengar podcast per bulan"], 45_000, { format: "compact" }),
				metric("hl-4", ["Features edited a month", "Feature disunting per bulan"], 10),
			],
			buttons: [
				{ kind: "contact", label: t(["Commission a story", "Pesan tulisan"]) },
				{ kind: "resume", label: t(["View resume", "Lihat CV"]) },
			],
			effect: {
				phrases: [t(["Content strategist", "Ahli strategi konten"]), t(["Podcast host", "Pembawa podcast"])],
			},
		},
		about: {
			content: t([
				"<p><strong>Ten years of stories about cities, food and public services.</strong> I started as a reporter at a daily in Yogyakarta, wrote features in Jakarta, and now run the features desk of Majalah Lembayung: six writers, two photographers and ten long reads a month.</p><p>I edit for the reader who has a commute, not an afternoon. Every story earns its length, every number comes with what it means, and every headline is tested before it runs.</p>",
				"<p><strong>Sepuluh tahun menulis tentang kota, makanan, dan layanan publik.</strong> Saya mulai sebagai reporter harian di Yogyakarta, menulis feature di Jakarta, dan kini memimpin desk feature Majalah Lembayung: enam penulis, dua fotografer, dan sepuluh tulisan panjang setiap bulan.</p><p>Saya menyunting untuk pembaca yang punya waktu sepanjang perjalanan pulang, bukan sepanjang sore. Setiap tulisan layak panjangnya, setiap angka disertai maknanya, dan setiap judul diuji sebelum terbit.</p>",
			]),
		},
		works: {
			items: [
				{
					...work({
						id: "w-coast",
						slug: "kota-tenggelam",
						title: ["The city that sinks slowly", "Kota yang tenggelam pelan-pelan"],
						summary: [
							"A year on the north coast of Java, where the land drops ten centimetres a year and the sea wall keeps rising.",
							"Setahun di pesisir utara Jawa, tempat tanah turun sepuluh sentimeter setahun dan tanggul laut terus ditinggikan.",
						],
						role: ["Writer and editor", "Penulis dan editor"],
						date: "2024",
						tags: [["Environment", "Lingkungan"], ["Long read", "Tulisan panjang"], "Award"],
						cover: "warta-1.svg",
						featured: true,
						metrics: [
							// The card's highlight. Time spent on the published story is the magazine's figure, not this page's
							// reading time ("1 min read" counts the portfolio's own text), so it comes second and says so.
							metric("m-shares", ["Shares in the first week", "Dibagikan di minggu pertama"], 12_400, {
								format: "compact",
								series: [1200, 3900, 6800, 8700, 10_300, 11_600, 12_400],
							}),
							metric("m-read", ["Time spent on the magazine's story", "Waktu baca di situs majalah"], "11:40", {
								change: { direction: "up", text: ["4× the site", "4× situs"], good: true },
								context: ["minutes, on a 4,200-word story", "menit, untuk tulisan 4.200 kata"],
							}),
							metric("m-council", ["Cited in council hearings", "Dikutip di rapat DPRD"], 2, {
								context: ["Semarang and Pekalongan", "Semarang dan Pekalongan"],
							}),
						],
						blocks: [
							text("w-coast-t", [
								"<p>On the north coast of Java the land sinks faster than the sea rises. In some villages near Semarang the ground drops ten centimetres a year, and families raise their floors every few years until the doors no longer fit.</p><p>I spent a year with three of those families, a fisherman, a school headmistress and the man who runs the only pump that keeps the market dry, and with the engineers who measure the ground under them.</p><h3>Reporting</h3><p>We visited every three months, at the same tide, from the same three spots, so readers could see the water move against the same walls.</p>",
								"<p>Di pesisir utara Jawa, tanah turun lebih cepat daripada laut naik. Di beberapa desa dekat Semarang, tanah turun sepuluh sentimeter setahun, dan keluarga meninggikan lantai rumah setiap beberapa tahun sampai pintu tak lagi muat.</p><p>Selama setahun saya mengikuti tiga keluarga itu, seorang nelayan, seorang kepala sekolah, dan pria yang menjalankan satu-satunya pompa penjaga pasar tetap kering, juga para insinyur yang mengukur tanah di bawah mereka.</p><h3>Liputan</h3><p>Kami datang setiap tiga bulan, pada pasang yang sama, dari tiga titik yang sama, agar pembaca bisa melihat air bergerak di dinding yang sama.</p>",
							]),
							{
								id: "w-coast-g",
								type: "images",
								layout: "grid",
								images: [
									{
										...picture("warta-g1.svg", ["Boats moored by the sea wall", "Perahu di tepi tanggul laut"]),
										caption: t([
											"Tambak Lorok, March: the boats moor above the old road",
											"Tambak Lorok, Maret: perahu tertambat di atas jalan lama",
										]),
									},
									{
										...picture("warta-g2.svg", [
											"How far the ground dropped each year",
											"Penurunan tanah setiap tahun",
										]),
										caption: t(["How far the ground dropped, 2015–2024", "Penurunan tanah, 2015–2024"]),
									},
									{
										...picture("warta-g3.svg", ["Map of the sinking coast", "Peta pesisir yang turun"]),
										caption: t(["The coast that sinks fastest, in red", "Pesisir yang turun paling cepat, merah"]),
									},
								],
							},
							text("w-coast-p", [
								"<h3>Editing</h3><p>The first draft had eleven thousand words. The one we ran had four thousand two hundred, and every number in it came with a picture of what it meant: a step, a doorframe, a classroom floor.</p><blockquote><p>Nobody here says the sea is coming. They say the land is leaving.</p></blockquote><p>The feature won Best Long-Form Feature at the 2024 Anugerah Pena Nusantara, and two city councils cited it in hearings on groundwater.</p>",
								"<h3>Penyuntingan</h3><p>Draf pertama berisi sebelas ribu kata. Yang terbit empat ribu dua ratus, dan setiap angka di dalamnya disertai gambaran maknanya: sebuah anak tangga, sebuah kusen pintu, sebuah lantai kelas.</p><blockquote><p>Tak ada yang bilang laut datang. Mereka bilang tanahnya yang pergi.</p></blockquote><p>Tulisan ini meraih Feature Panjang Terbaik di Anugerah Pena Nusantara 2024, dan dua DPRD mengutipnya dalam rapat tentang air tanah.</p>",
							]),
							{
								id: "w-coast-a",
								type: "embed",
								provider: "spotify",
								ref: "episode/4kTq8Rm2LxNw7PbZc3Ve9H",
								title: t([
									"Ruang Tunggu, episode 31: the land is leaving",
									"Ruang Tunggu, episode 31: tanahnya yang pergi",
								]),
								thumbnail: picture("warta-audio.svg", ["The podcast's cover", "Sampul podcast"], {
									width: 600,
									height: 600,
								}),
							},
							{
								id: "w-coast-v",
								type: "video",
								provider: "youtube",
								videoId: "Lk7pQw2NmZr",
								title: t(["Short film: three walls, one year", "Film pendek: tiga dinding, satu tahun"]),
								thumbnail: picture("warta-video.svg", [
									"Video: three walls, one year",
									"Video: tiga dinding, satu tahun",
								]),
							},
							{
								id: "w-coast-pdf",
								type: "pdf",
								file: pdf("coast-print", "The city that sinks slowly", 8),
								title: t(["The print edition, 8 pages", "Edisi cetak, 8 halaman"]),
								pages: 8,
								bytes: 3_200_000,
								preview: picture("warta-pdf.svg", ["The feature's opening spread", "Halaman pembuka feature"], {
									width: 800,
									height: 1131,
								}),
							},
							{
								id: "w-coast-l",
								type: "link",
								url: "https://medium.com/@laraskusuma/the-land-is-leaving",
								title: t(["Notes on reporting a slow story", "Catatan meliput cerita yang lambat"]),
								description: t([
									"How we planned a year of visits around the tide table.",
									"Cara kami merencanakan setahun kunjungan mengikuti tabel pasang.",
								]),
								siteName: "medium.com",
								brandIcon: "medium",
							},
						],
					}),
					primaryLink: {
						label: t(["Read the feature", "Baca tulisannya"]),
						url: "https://lembayung.example/feature/kota-tenggelam",
					},
				},
				work({
					id: "w-kitchen",
					slug: "dapur-terakhir",
					title: ["The last kitchen in Gang Sayidan", "Dapur terakhir di Gang Sayidan"],
					summary: [
						"A year inside a 70-year-old family warung, from the 4 a.m. market run to the last plate.",
						"Setahun di dalam warung keluarga berusia 70 tahun, dari belanja pasar pukul empat pagi sampai piring terakhir.",
					],
					role: ["Writer", "Penulis"],
					date: "2023",
					tags: [
						["Food", "Kuliner"],
						["Long read", "Tulisan panjang"],
					],
					cover: "warta-2.svg",
					metrics: [metric("m-kitchen", ["Readers", "Pembaca"], 86_000, { format: "compact" })],
					blocks: [
						text("w-kitchen-t", [
							"<p>Bu Sri has cooked the same gudeg since 1989, in the same pot her mother used. The lane around her has turned into cafés; her kitchen has not moved an inch.</p><p>I wrote it in the order of her day, so the story ends when the last plate does.</p>",
							"<p>Bu Sri memasak gudeg yang sama sejak 1989, di panci yang sama milik ibunya. Gang di sekitarnya kini penuh kafe; dapurnya tak bergeser sejengkal pun.</p><p>Saya menulisnya mengikuti urutan harinya, sehingga cerita berakhir saat piring terakhir habis.</p>",
						]),
					],
				}),
				{
					...work({
						id: "w-podcast",
						slug: "ruang-tunggu",
						title: ["Ruang Tunggu, a podcast about waiting", "Ruang Tunggu, podcast tentang menunggu"],
						summary: [
							"A weekly show on public services: the queues, the forms and the people behind the counter.",
							"Acara mingguan tentang layanan publik: antrean, formulir, dan orang-orang di balik loket.",
						],
						role: ["Creator and host", "Penggagas dan pembawa acara"],
						date: "2022–2025",
						tags: ["Podcast", ["Public services", "Layanan publik"]],
						cover: "warta-3.svg",
						metrics: [metric("m-podcast", ["Listeners a month", "Pendengar per bulan"], 45_000, { format: "compact" })],
						blocks: [
							text("w-podcast-t", [
								"<p>Every episode starts in a waiting room: a hospital, a land office, a passport queue. We wait with the people there, then ask the office why.</p>",
								"<p>Setiap episode dimulai di ruang tunggu: rumah sakit, kantor pertanahan, antrean paspor. Kami ikut menunggu bersama orang-orang di sana, lalu bertanya kepada kantornya mengapa.</p>",
							]),
							{
								id: "w-podcast-s",
								type: "embed",
								provider: "soundcloud",
								ref: "laraskusuma/sets/ruang-tunggu",
								title: t(["Ruang Tunggu, season two", "Ruang Tunggu, musim kedua"]),
								thumbnail: picture("warta-audio.svg", ["The podcast's cover", "Sampul podcast"], {
									width: 600,
									height: 600,
								}),
							},
						],
					}),
					primaryLink: { label: t(["Listen", "Dengarkan"]), url: "https://lembayung.example/ruang-tunggu" },
				},
				work({
					id: "w-newsletter",
					slug: "lembayung-weekly",
					title: ["Lembayung Weekly, a paid newsletter", "Lembayung Weekly, newsletter berbayar"],
					summary: [
						"Eighteen thousand subscribers in the first year, with an open rate that never fell below 52%.",
						"Delapan belas ribu pelanggan di tahun pertama, dengan tingkat buka yang tak pernah di bawah 52%.",
					],
					role: ["Editor", "Editor"],
					date: "2023",
					tags: ["Newsletter", ["Audience", "Pembaca"]],
					cover: "warta-4.svg",
					metrics: [metric("m-newsletter", ["Subscribers", "Pelanggan"], 18_000, { format: "compact" })],
					blocks: [
						text("w-newsletter-t", [
							"<p>One long read, three short notes and one recommendation, every Friday at six in the morning.</p>",
							"<p>Satu tulisan panjang, tiga catatan singkat, dan satu rekomendasi, setiap Jumat pukul enam pagi.</p>",
						]),
					],
				}),
				work({
					id: "w-calendar",
					slug: "kalender-redaksi",
					title: ["An editorial calendar built on reading", "Kalender redaksi berbasis waktu baca"],
					summary: [
						"Planning around what readers finish, not what they click: reading time rose from 2:40 to 6:15 minutes.",
						"Merencanakan dari apa yang selesai dibaca, bukan yang diklik: waktu baca naik dari 2:40 menjadi 6:15 menit.",
					],
					role: ["Content strategist", "Ahli strategi konten"],
					date: "2022",
					tags: [["Strategy", "Strategi"], "Analytics"],
					cover: "warta-5.svg",
					metrics: [
						metric("m-calendar", ["Reading time", "Waktu baca"], "6:15", {
							change: { direction: "up", text: ["from 2:40", "dari 2:40"], good: true },
						}),
					],
					blocks: [
						text("w-calendar-t", [
							"<p>Fewer stories, longer lead times, and a Monday meeting that starts with last week's finished reads.</p>",
							"<p>Lebih sedikit tulisan, waktu persiapan lebih panjang, dan rapat Senin yang dimulai dari tulisan yang selesai dibaca pekan lalu.</p>",
						]),
					],
				}),
				work({
					id: "w-headlines",
					slug: "uji-judul",
					title: ["Headline testing for a newsroom", "Uji judul untuk ruang redaksi"],
					summary: [
						"A one-page guide and a weekly test: search traffic to features doubled in a year.",
						"Panduan satu halaman dan uji mingguan: trafik pencarian ke feature berlipat dua dalam setahun.",
					],
					role: ["Author", "Penulis"],
					date: "2019",
					tags: ["SEO", ["Guide", "Panduan"]],
					cover: "warta-6.svg",
					metrics: [metric("m-headlines", ["Search traffic", "Trafik pencarian"], 2, { format: "multiplier" })],
					blocks: [
						text("w-headlines-t", [
							"<p>Two headlines per story, one week of traffic, and a rule: the winner says what the story is about.</p>",
							"<p>Dua judul per tulisan, satu minggu trafik, dan satu aturan: pemenangnya mengatakan isi tulisannya.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["Long-form features", "Feature panjang"]),
					description: t([
						"Reported features on cities, food and public services, from pitch to final edit.",
						"Feature hasil liputan tentang kota, makanan, dan layanan publik, dari usulan sampai suntingan akhir.",
					]),
					price: t(["From IDR 6m / story", "Mulai Rp6 jt / tulisan"]),
					cta: { kind: "contact", label: t(["Pitch me a story", "Ajukan tulisan"]) },
				},
				{
					id: "sv-2",
					title: t(["Editorial strategy", "Strategi redaksi"]),
					description: t([
						"A calendar and newsletter plan built on what your readers actually finish.",
						"Rencana kalender dan newsletter yang dibangun dari apa yang benar-benar selesai dibaca pembaca Anda.",
					]),
					price: t(["From IDR 20m", "Mulai Rp20 jt"]),
					cta: { kind: "contact", label: t(["Ask through the form", "Tanya lewat form"]) },
				},
				{
					id: "sv-3",
					title: t(["Writing workshops", "Lokakarya menulis"]),
					description: t([
						"One-day workshops for newsrooms and communications teams: structure, numbers and headlines.",
						"Lokakarya sehari untuk ruang redaksi dan tim komunikasi: struktur, angka, dan judul.",
					]),
					price: t(["IDR 8m / day", "Rp8 jt / hari"]),
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Laras edits the way a good reporter interviews: she listens first, then asks the one question that changes the story.",
						"Laras menyunting seperti reporter yang baik mewawancarai: ia mendengar lebih dulu, lalu menanyakan satu hal yang mengubah ceritanya.",
					]),
					name: "Dimas Wirawan",
					role: t(["Editor-in-chief, Majalah Lembayung", "Pemimpin redaksi, Majalah Lembayung"]),
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"Her calendar turned our site from clicks into reading.",
						"Kalendernya mengubah situs kami dari sekadar klik menjadi bacaan.",
					]),
					name: "Rani Hapsari",
					role: "Audience Director, Kanal Kota",
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"Our team still follows the rule from her workshop: say the number, then say what it means.",
						"Tim kami masih memakai aturan dari lokakaryanya: sebutkan angkanya, lalu sebutkan maknanya.",
					]),
					name: "Yudha Pratama",
					role: t(["Head of Communications, Yayasan Kota Kita", "Kepala Komunikasi, Yayasan Kota Kita"]),
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Majalah Lembayung" },
				{ id: "cl-2", name: "Kanal Kota" },
				{ id: "cl-3", name: "Warta Jogja" },
				{ id: "cl-4", name: "Yayasan Kota Kita", logo: logo("Yayasan Kota Kita", 5, "#9A3412") },
				{ id: "cl-5", name: "Penerbit Serambi" },
				{ id: "cl-6", name: "Radio Suara Kampung", logo: logo("Suara Kampung", 3, "#1E3A5F") },
			],
		},
		custom: [
			{
				id: "teaching",
				title: t(["Teaching", "Mengajar"]),
				content: t([
					"<p>Guest lecturer in feature writing at Universitas Gadjah Mada since 2023. Each term, my students report one story from start to finish; the best three run in Majalah Lembayung.</p>",
					"<p>Dosen tamu penulisan feature di Universitas Gadjah Mada sejak 2023. Setiap semester, mahasiswa saya meliput satu cerita dari awal sampai akhir; tiga terbaik terbit di Majalah Lembayung.</p>",
				]),
				hidden: false,
			},
		],
		location: {
			label: "Yogyakarta, Indonesia",
			point: { lat: -7.8, lng: 110.36, precision: "city" },
			showMap: true,
			map: {
				light: picture("map-lugas-light.svg", ["Map around Yogyakarta", "Peta sekitar Yogyakarta"], {
					width: 800,
					height: 480,
				}),
				dark: picture("map-lugas-dark.svg", ["Map around Yogyakarta", "Peta sekitar Yogyakarta"], {
					width: 800,
					height: 480,
				}),
			},
			workModes: ["hybrid", "remote"],
			relocate: true,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: true,
			whatsapp: { show: true, number: "6281355524471" },
			form: false,
			profiles: true,
			note: t([
				"Pitching a story, or need an editor for one? Write to me; I reply within two working days.",
				"Punya usulan tulisan, atau butuh editor? Kirim pesan; saya membalas dalam dua hari kerja.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
