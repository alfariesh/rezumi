import type { PersonaDefinition } from "../persona";

/** Mozaik: Citra Maharani, a brand and visual designer in Denpasar (`mockups/mozaik.html`). */
export const citra: PersonaDefinition = {
	id: "citra",
	theme: "mozaik",
	resume: "kirana",
	username: "citra",
	accent: "rgba(29, 111, 115, 1)",
	photo: "citra.jpg",
	profiles: [
		{ network: "Behance", username: "citramaharani", url: "https://www.behance.net/citramaharani", icon: "behance-01" },
		{ network: "Dribbble", username: "citramaharani", url: "https://dribbble.com/citramaharani", icon: "dribbble" },
		{
			network: "Instagram",
			username: "citra.maharani",
			url: "https://instagram.com/citra.maharani",
			icon: "instagram",
		},
	],
	minimal: ["Brand designer in Denpasar, Bali.", "Brand designer di Denpasar, Bali."],
	long: {
		name: "Ni Luh Putu Citra Maharani Suryakusumadewiningrat",
		headline: [
			"Brand & Visual Designer for brand identity, packaging, brand guidelines and wayfinding for businesses in Bali",
			"Brand & Visual Designer untuk identitas merek, kemasan, panduan merek, dan wayfinding usaha di Bali",
		],
	},
	arabic: {
		headline: "مصممة علامات تجارية وهوية بصرية",
		greeting: "مصممة علامات تجارية في بالي، أساعد الفلل والمقاهي والحرفيين على امتلاك هوية سهلة التذكر ومتّسقة.",
		availability: "تتوفر مواعيد لمشاريع يناير 2026",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		hero: {
			greeting: t([
				"Brand designer in Bali. I help villas, coffee shops and makers get an identity that is easy to remember and stays consistent.",
				"Brand designer di Bali. Saya membantu vila, kedai kopi, dan perajin punya identitas yang mudah diingat dan konsisten.",
			]),
			showPicture: true,
			availability: {
				show: true,
				text: t(["Project slots open for January 2026", "Slot proyek Januari 2026 tersedia"]),
			},
			highlights: [
				metric("hl-1", ["identity clients", "klien identitas"], 25, { suffix: "+" }),
				metric("hl-2", ["skincare stockists", "toko penjual skincare"], 85, {
					change: { direction: "up", text: ["from 12", "dari 12"], good: true },
					before: 12,
				}),
			],
			buttons: [{ kind: "whatsapp" }, { kind: "contact", label: t(["Send a brief", "Kirim brief"]) }],
			effect: {
				phrases: [t(["Packaging designer", "Desainer kemasan"]), t(["Wayfinding designer", "Desainer wayfinding"])],
			},
		},
		about: {
			content: t([
				"<p><strong>Brand designer with nine years of identity work for hospitality, food and lifestyle.</strong></p><p>I turn a brief into a clear visual system, from logo and type to packaging and signage, then keep it consistent as the brand grows.</p>",
				"<p><strong>Brand designer dengan sembilan tahun pengalaman membangun identitas untuk hospitality, kuliner, dan gaya hidup.</strong></p><p>Saya mengubah brief menjadi sistem visual yang jelas, dari logo dan tipografi hingga kemasan dan signage, lalu menjaganya tetap konsisten saat merek berkembang.</p>",
			]),
		},
		works: {
			items: [
				work({
					id: "w-tenun",
					slug: "tenun-lestari",
					title: ["Tenun Lestari identity", "Identitas Tenun Lestari"],
					summary: [
						"Identity, packaging and a pop-up shop for a cooperative of 120 weavers.",
						"Identitas, kemasan, dan toko pop-up untuk koperasi 120 perajin tenun.",
					],
					role: "Lead brand designer",
					date: "2024",
					tags: [["Identity", "Identitas"], ["Packaging", "Kemasan"], "Pop-up"],
					cover: "mozaik-1.svg",
					featured: true,
					metrics: [
						metric("m-fair", ["Fair sales", "Penjualan pameran"], 2, {
							format: "multiplier",
							change: { direction: "up", text: ["vs last fair", "dari Rp93 jt"], good: true },
							context: ["first Jakarta fair", "pameran Jakarta pertama"],
						}),
						metric("m-repeat", ["Repeat buyers", "Pembeli kembali"], 38, {
							format: "percent",
							change: { direction: "up", text: ["+21 pts", "+21 poin"], good: true },
							before: 17,
							series: [17, 21, 26, 30, 34, 38],
							context: ["6 months after the fair", "6 bulan setelah pameran"],
						}),
						metric("m-weavers", ["Active weavers", "Perajin aktif"], 120, {
							change: { direction: "up", text: "+34", good: true },
							before: 86,
							context: ["cooperative members", "anggota koperasi"],
						}),
					],
					blocks: [
						text("w-tenun-t", [
							"<h3>Problem</h3><p>A cooperative of 120 weavers in Karangasem sells the finest cloth, yet at fairs it stood out less than city brands. Packaging and signs were improvised.</p><h3>My role</h3><ul><li>Researched motifs with 12 senior weavers.</li><li>Designed the logo, colour system, cloth labels and boxes.</li><li>Directed the pop-up shop for the Jakarta fair.</li></ul>",
							"<h3>Masalah</h3><p>Koperasi 120 penenun di Karangasem menjual kain terbaik, tapi di pameran mereka kalah menonjol dari merek kota. Kemasan dan papan nama dibuat seadanya.</p><h3>Peran saya</h3><ul><li>Riset motif bersama 12 penenun senior.</li><li>Merancang logo, sistem warna, label kain, dan kotak kemasan.</li><li>Mengarahkan desain toko pop-up untuk pameran Jakarta.</li></ul>",
						]),
						{
							id: "w-tenun-g",
							type: "images",
							layout: "carousel",
							images: [
								{
									...picture("mozaik-g1.svg", ["Base motif from gringsing cloth", "Motif dasar dari kain gringsing"]),
									caption: t(["Base motif from gringsing cloth", "Motif dasar dari kain gringsing"]),
								},
								{
									...picture("mozaik-g2.svg", ["Labels and cloth boxes", "Label dan kotak kain"]),
									caption: t(["Labels and cloth boxes", "Label dan kotak kain"]),
								},
								{
									...picture("mozaik-g3.svg", ["The pop-up shop in Jakarta", "Toko pop-up di Jakarta"]),
									caption: t(["The pop-up shop in Jakarta", "Toko pop-up di Jakarta"]),
								},
							],
						},
						text("w-tenun-p", [
							"<h3>Process</h3><p>The logo comes from the base pattern of gringsing cloth, simplified to four shapes. Every weaver gets a label with her name and village.</p><p>The boxes use recycled card and one print colour, so each costs under IDR 4,000.</p><blockquote><p>Buyers want to know who wove their cloth. That label is now the most photographed part.</p></blockquote>",
							"<h3>Proses</h3><p>Logo diambil dari pola dasar kain gringsing yang disederhanakan menjadi empat bentuk. Setiap penenun mendapat label dengan nama dan desanya.</p><p>Kemasan memakai karton daur ulang dan satu warna cetak agar biaya per kotak tetap di bawah Rp4.000.</p><blockquote><p>Pembeli ingin tahu siapa yang menenun kainnya. Label itu kini jadi bagian yang paling sering difoto.</p></blockquote>",
						]),
						{
							id: "w-tenun-v",
							type: "video",
							provider: "youtube",
							videoId: "Vq7nLm3RkTe",
							title: t(["Process: from motif to logo", "Proses: dari motif ke logo"]),
							thumbnail: picture("mozaik-video.svg", ["Video: from motif to logo", "Video: dari motif ke logo"]),
						},
						{
							id: "w-tenun-pdf",
							type: "pdf",
							file: pdf("brand-guide", "Tenun Lestari brand guidelines", 32),
							title: t(["Tenun Lestari brand guidelines", "Panduan merek Tenun Lestari"]),
							pages: 32,
							bytes: 6_200_000,
							preview: picture("mozaik-pdf.svg", ["The guidelines' cover", "Sampul panduan merek"], {
								width: 800,
								height: 1131,
							}),
						},
						{
							id: "w-tenun-l",
							type: "link",
							url: "https://www.behance.net/gallery/tenun-lestari-identity",
							title: t(["Tenun Lestari — identity & packaging", "Tenun Lestari — identitas & kemasan"]),
							description: t([
								"The full case study with mockups and pop-up photos.",
								"Studi kasus lengkap dengan mockup dan foto pop-up.",
							]),
							siteName: "behance.net",
							brandIcon: "behance-01",
						},
						text("w-tenun-r", [
							"<h3>Result</h3><p>Sales at the first Jakarta fair doubled on the fair before, and 38% of buyers came back within six months.</p>",
							"<h3>Hasil</h3><p>Penjualan di pameran Jakarta pertama naik dua kali lipat dibanding pameran sebelumnya, dan 38% pembeli kembali membeli dalam enam bulan.</p>",
						]),
					],
				}),
				work({
					id: "w-ubud",
					slug: "ubud-food-walk",
					title: ["Ubud Food Walk wayfinding", "Penunjuk arah Ubud Food Walk"],
					summary: [
						"Maps, signs and an icon set for a 3 km food trail.",
						"Peta, signage, dan set ikon untuk jalur kuliner sepanjang 3 km.",
					],
					role: ["Wayfinding designer", "Desainer wayfinding"],
					date: "2023",
					tags: ["Signage", ["Icons", "Ikon"]],
					cover: "mozaik-2.svg",
					metrics: [metric("m-ubud", ["Visitors a month", "Pengunjung/bulan"], 9000, { format: "compact" })],
					blocks: [
						text("w-ubud-t", [
							"<p>Twelve stops, one colour per street, and icons a tourist reads without words.</p>",
							"<p>Dua belas titik, satu warna per jalan, dan ikon yang terbaca turis tanpa kata.</p>",
						]),
					],
				}),
				work({
					id: "w-segara",
					slug: "sari-segara",
					title: ["Sari Segara rebrand", "Rebranding Sari Segara"],
					summary: [
						"A Balinese skincare label in new packaging; stockists grew from 12 to 85.",
						"Skincare lokal Bali dengan kemasan baru; toko penjualnya naik dari 12 ke 85.",
					],
					role: "Senior brand designer",
					date: "2023",
					tags: [["Packaging", "Kemasan"], "Rebranding"],
					cover: "mozaik-3.svg",
					metrics: [
						metric("m-segara", ["Stockists", "Toko penjual"], 85, {
							change: { direction: "up", text: ["from 12", "dari 12"], good: true },
							before: 12,
						}),
					],
					blocks: [
						text("w-segara-t", [
							"<p>Sea-glass bottles, a wave mark and labels that survive a wet bathroom shelf.</p>",
							"<p>Botol bening kehijauan, tanda ombak, dan label yang tahan di rak kamar mandi yang basah.</p>",
						]),
					],
				}),
				work({
					id: "w-sanur",
					slug: "kopi-pagi-sanur",
					title: ["Kopi Pagi Sanur identity system", "Sistem identitas Kopi Pagi Sanur"],
					summary: [
						"One brand guide for 40 outlets, from cups to menu boards.",
						"Satu panduan merek untuk 40 gerai, dari cangkir sampai papan menu.",
					],
					role: "Brand designer",
					date: "2022",
					tags: [["Brand guidelines", "Panduan merek"]],
					cover: "mozaik-4.svg",
					metrics: [metric("m-sanur", ["Outlets", "Gerai"], 40)],
					blocks: [
						text("w-sanur-t", [
							"<p>Every outlet manager got the same 24-page guide and a box of ready files.</p>",
							"<p>Setiap kepala gerai mendapat panduan 24 halaman yang sama dan satu folder file siap pakai.</p>",
						]),
					],
				}),
				work({
					id: "w-library",
					slug: "pustaka-ilustrasi",
					title: ["A shared illustration library", "Pustaka ilustrasi bersama"],
					summary: [
						"Modular illustrations for 10 retail brands; content production time halved.",
						"Ilustrasi modular untuk 10 merek ritel; waktu produksi konten turun separuh.",
					],
					role: "Visual designer · Ombak Digital",
					date: "2021",
					tags: [
						["Illustration", "Ilustrasi"],
						["System", "Sistem"],
					],
					cover: "mozaik-5.svg",
					metrics: [
						metric("m-library", ["Production time", "Waktu produksi"], -50, {
							format: "percent",
							change: { direction: "down", text: "−50%", good: true },
						}),
					],
					blocks: [
						text("w-library-t", [
							"<p>Two hundred shapes that combine into scenes, each brand with its own palette.</p>",
							"<p>Dua ratus bentuk yang bisa digabung menjadi adegan, setiap merek dengan paletnya sendiri.</p>",
						]),
					],
				}),
				work({
					id: "w-homecoming",
					slug: "pulang-kampung",
					title: ["“Pulang Kampung” campaign", "Kampanye “Pulang Kampung”"],
					summary: [
						"An Eid campaign for a retail chain that reached 6 million people.",
						"Kampanye Lebaran untuk jaringan ritel yang menjangkau 6 juta orang.",
					],
					role: "Visual designer",
					date: "2020",
					tags: [
						["Campaign", "Kampanye"],
						["Social", "Sosial"],
					],
					cover: "mozaik-6.svg",
					metrics: [metric("m-homecoming", ["Reach", "Jangkauan"], 6_000_000, { format: "compact" })],
					blocks: [
						text("w-homecoming-t", [
							"<p>Stories of the trip home, drawn as postcards from twelve towns.</p>",
							"<p>Cerita perjalanan pulang, digambar sebagai kartu pos dari dua belas kota.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["Complete brand identity", "Identitas merek lengkap"]),
					description: t([
						"Logo, colour, type and the main applications in six weeks.",
						"Logo, warna, tipografi, dan aplikasi utama dalam enam minggu.",
					]),
					price: t(["From IDR 18m", "Mulai Rp18 jt"]),
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
				{
					id: "sv-2",
					title: t(["Packaging design", "Desain kemasan"]),
					description: t([
						"Print-ready packaging, with mockups and help at the printer's.",
						"Kemasan siap cetak, termasuk mockup dan pendampingan ke percetakan.",
					]),
					price: t(["From IDR 6m / SKU", "Mulai Rp6 jt / SKU"]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
				{
					id: "sv-3",
					title: t(["Brand guidelines", "Panduan merek"]),
					description: t([
						"A guide your team and vendors use without having to ask.",
						"Buku panduan yang dipakai tim dan vendor tanpa perlu bertanya.",
					]),
					price: t(["From IDR 8m", "Mulai Rp8 jt"]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
				{
					id: "sv-4",
					title: "Signage & wayfinding",
					description: t([
						"Signs, maps and icons for public spaces or a business.",
						"Papan nama, peta, dan ikon untuk ruang publik atau usaha.",
					]),
					price: t(["Priced by scope", "Sesuai cakupan"]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Citra made our cooperative look like a boutique without losing the weavers' story.",
						"Citra membuat koperasi kami terlihat sekelas butik, tanpa kehilangan cerita para penenun.",
					]),
					name: "Ni Made Sari",
					role: t(["Chair, Koperasi Tenun Lestari", "Ketua, Koperasi Tenun Lestari"]),
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"Her brand guide is so tidy. Our team at 40 outlets finally uses the same logo.",
						"Panduan mereknya rapi sekali. Tim kami di 40 gerai akhirnya memakai logo yang sama.",
					]),
					name: "Gede Arimbawa",
					role: t(["Operations, Kopi Pagi Sanur", "Operasional, Kopi Pagi Sanur"]),
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"Fast, careful, and always arrives with three truly different directions.",
						"Cepat, teliti, dan selalu datang dengan tiga arah yang benar-benar berbeda.",
					]),
					name: "Laura Hendrawan",
					role: "Marketing Lead, Sari Segara",
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Tenun Lestari", logo: logo("Tenun Lestari", 4, "#9F1239") },
				{ id: "cl-2", name: "Kopi Pagi Sanur", logo: logo("Kopi Pagi Sanur", 0, "#6B4423") },
				{ id: "cl-3", name: "Sari Segara", logo: logo("Sari Segara", 5, "#1D6F73") },
				{ id: "cl-4", name: "Vila Teras Ubud", logo: logo("Vila Teras Ubud", 3, "#15803D") },
				{ id: "cl-5", name: "Ombak Digital" },
				{ id: "cl-6", name: "Rumah Kopi Senja" },
			],
		},
		custom: [
			{
				id: "process",
				title: t(["How I work", "Cara saya bekerja"]),
				content: t([
					"<ol><li><strong>Brief.</strong> An hour's talk about the business, its customers and its competitors.</li><li><strong>Directions.</strong> Three truly different visual directions to choose from.</li><li><strong>System.</strong> Logo, colour, type and the main applications.</li><li><strong>Handover.</strong> Ready-to-use files and a brand guide.</li></ol>",
					"<ol><li><strong>Brief.</strong> Satu jam ngobrol tentang usaha, pelanggan, dan pesaing.</li><li><strong>Arah.</strong> Tiga arah visual yang benar-benar berbeda untuk dipilih.</li><li><strong>Sistem.</strong> Logo, warna, huruf, dan aplikasi utama.</li><li><strong>Serah terima.</strong> File siap pakai dan panduan merek.</li></ol>",
				]),
				hidden: false,
			},
		],
		location: {
			label: "Denpasar, Bali",
			point: { lat: -8.65, lng: 115.22, precision: "city" },
			showMap: true,
			map: {
				light: picture("map-mozaik-light.svg", ["Map around Denpasar", "Peta sekitar Denpasar"], {
					width: 800,
					height: 480,
				}),
				dark: picture("map-mozaik-dark.svg", ["Map around Denpasar", "Peta sekitar Denpasar"], {
					width: 800,
					height: 480,
				}),
			},
			workModes: ["remote", "onsite"],
			relocate: true,
			timezone: "Asia/Makassar",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: true,
			whatsapp: { show: true, number: "6281755506125" },
			form: false,
			profiles: true,
			note: t([
				"Got a business that needs a new identity? Send your brief and I'll reply within 24 hours.",
				"Punya usaha yang butuh identitas baru? Kirim briefmu, saya balas dalam 24 jam.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
