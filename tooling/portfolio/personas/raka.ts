import type { PersonaDefinition } from "../persona";

/**
 * Sintaks: Raka Mahendra, who leads data analytics and analytics engineering at a marketplace in Jakarta (the
 * gallery's Horizon resume). His works read as repositories, so their tags are the tools they're built with. Every
 * company, repository, number and person here is made up; the drawings are `mockups/img/sintaks-*.svg`.
 */
export const raka: PersonaDefinition = {
	id: "raka",
	theme: "sintaks",
	resume: "horizon",
	username: "raka",
	accent: "rgba(34, 197, 94, 1)",
	photo: "raka.jpg",
	profiles: [
		{ network: "GitHub", username: "rakamahendra", url: "https://github.com/rakamahendra", icon: "github" },
		{
			network: "LinkedIn",
			username: "rakamahendra",
			url: "https://www.linkedin.com/in/rakamahendra",
			icon: "linkedin-02",
		},
	],
	minimal: ["Analytics engineer in Jakarta.", "Analytics engineer di Jakarta."],
	long: {
		name: "Raden Mas Raka Mahendra Wiryodiningratkusumo",
		headline: [
			"Head of Data Analytics and analytics engineering for marketplaces, experimentation platforms and metric layers",
			"Head of Data Analytics dan analytics engineering untuk marketplace, platform eksperimen, dan lapisan metrik",
		],
	},
	arabic: {
		headline: "قائد هندسة التحليلات · SQL وPython وdbt",
		greeting: "أبني طبقة بيانات تثق بها الشركة: تعريف واحد لكل مقياس، مُختبَر مثل الشيفرة، وسريع بما يكفي للسؤال التالي.",
		availability: "متاح لأدوار مهندس تحليلات أول",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		basics: {
			headline: t(["Analytics engineering lead · SQL, Python, dbt", "Lead analytics engineering · SQL, Python, dbt"]),
		},
		hero: {
			greeting: t([
				"I build the data layer a company can trust: one definition per metric, tested like code, fast enough for the next question.",
				"Saya membangun lapisan data yang bisa dipercaya: satu definisi per metrik, diuji seperti kode, cukup cepat untuk pertanyaan berikutnya.",
			]),
			showPicture: true,
			availability: {
				show: true,
				text: t(["Open to staff analytics engineer roles", "Terbuka untuk peran staff analytics engineer"]),
				roles: ["Staff Analytics Engineer", "Head of Data"],
				types: ["full-time", "contract"],
			},
			highlights: [
				metric("hl-1", ["Weekly metric users", "Pengguna metrik per minggu"], 1800),
				metric("hl-2", ["Warehouse cost", "Biaya warehouse"], -46, { format: "percent" }),
				metric("hl-3", ["Experiments a year", "Eksperimen per tahun"], 220),
				metric("hl-4", ["Extra GMV in 2025", "Tambahan GMV 2025"], 310_000_000_000, {
					format: "currency",
					currency: "IDR",
				}),
			],
			buttons: [
				{ kind: "link", url: "https://github.com/rakamahendra", label: "GitHub" },
				{ kind: "resume", label: t(["View resume", "Lihat CV"]) },
				{ kind: "contact", label: t(["Get in touch", "Hubungi saya"]) },
			],
			effect: { phrases: [t(["Analytics engineer", "Analytics engineer"]), "dbt · BigQuery · Python"] },
		},
		about: {
			content: t([
				"<p><strong>Twelve years turning questions into tested SQL.</strong> I started in credit risk at a bank, moved to logistics, and now lead 24 analysts and analytics engineers at Seranta, a marketplace with 30 million buyers.</p><p>I care about the boring parts: metric definitions in version control, tests that fail before a dashboard does, and documentation people actually read. That is what lets a team ask the next question instead of arguing about the last one.</p>",
				"<p><strong>Dua belas tahun mengubah pertanyaan menjadi SQL yang teruji.</strong> Saya mulai di risiko kredit sebuah bank, pindah ke logistik, dan kini memimpin 24 analis dan analytics engineer di Seranta, marketplace dengan 30 juta pembeli.</p><p>Saya peduli pada bagian yang membosankan: definisi metrik di version control, tes yang gagal sebelum dasbor salah, dan dokumentasi yang benar-benar dibaca. Itulah yang membuat tim bisa bertanya hal berikutnya, bukan berdebat soal angka kemarin.</p>",
			]),
		},
		works: {
			items: [
				{
					...work({
						id: "w-metrics",
						slug: "metrics-layer",
						title: ["A shared metrics layer on dbt", "Lapisan metrik bersama di dbt"],
						summary: [
							"One tested definition for 340 business metrics, used by 1,800 people a week; warehouse query costs fell 46%.",
							"Satu definisi teruji untuk 340 metrik bisnis, dipakai 1.800 orang per minggu; biaya kueri warehouse turun 46%.",
						],
						role: ["Tech lead", "Tech lead"],
						date: "2023–2025",
						tags: ["dbt", "SQL", "BigQuery"],
						cover: "sintaks-1.svg",
						featured: true,
						metrics: [
							metric("m-cost", ["Warehouse query cost", "Biaya kueri warehouse"], -46, {
								format: "percent",
								change: { direction: "down", text: ["vs 2023", "vs 2023"], good: true },
								series: [100, 96, 88, 79, 70, 63, 58, 54],
								context: ["monthly, against the year before", "per bulan, dibanding tahun sebelumnya"],
							}),
							metric("m-users", ["People using it weekly", "Pengguna per minggu"], 1800, {
								change: { direction: "up", text: ["from 240", "dari 240"], good: true },
								before: 240,
								series: [240, 410, 690, 920, 1240, 1500, 1800],
							}),
							metric("m-tests", ["Data tests in CI", "Tes data di CI"], 1260, {
								progress: 84,
								context: ["84% of models covered", "84% model sudah teruji"],
							}),
						],
						blocks: [
							text("w-metrics-t", [
								"<h3>Problem</h3><p>Finance, marketing and product each had their own <strong>GMV</strong>. Three dashboards, three numbers, and a weekly meeting spent deciding which one was right.</p><h3>What I built</h3><ul><li>A dbt project where every metric has one definition, an owner and a test.</li><li>Incremental models and partitioned tables, so a dashboard reads days, not years.</li><li>A short review rule: no metric reaches a dashboard without a pull request.</li></ul>",
								"<h3>Masalah</h3><p>Keuangan, pemasaran, dan produk masing-masing punya <strong>GMV</strong> sendiri. Tiga dasbor, tiga angka, dan satu rapat mingguan untuk menentukan mana yang benar.</p><h3>Yang saya bangun</h3><ul><li>Proyek dbt tempat setiap metrik punya satu definisi, satu pemilik, dan satu tes.</li><li>Model inkremental dan tabel berpartisi, jadi dasbor membaca hari, bukan tahun.</li><li>Aturan tinjauan singkat: tak ada metrik masuk dasbor tanpa pull request.</li></ul>",
							]),
							{
								id: "w-metrics-g",
								type: "images",
								layout: "grid",
								images: [
									{
										...picture("sintaks-g1.svg", ["The metrics dashboard", "Dasbor metrik"]),
										caption: t(["The dashboard every team now reads", "Dasbor yang kini dibaca semua tim"]),
									},
									{
										...picture("sintaks-g2.svg", ["Lineage from sources to metrics", "Silsilah dari sumber ke metrik"]),
										caption: t(["Lineage from raw orders to GMV", "Silsilah dari pesanan mentah ke GMV"]),
									},
									{
										...picture("sintaks-g3.svg", ["Warehouse cost by month", "Biaya warehouse per bulan"]),
										caption: t(["Warehouse cost by month", "Biaya warehouse per bulan"]),
									},
								],
							},
							text("w-metrics-p", [
								"<h3>How we rolled it out</h3><p>We moved one metric a week, starting with the one people argued about most. Each move came with a short note: the old number, the new one, and why they differ.</p><blockquote><p>A metric nobody argues about is worth more than ten dashboards.</p></blockquote>",
								"<h3>Cara kami menerapkannya</h3><p>Kami memindahkan satu metrik setiap minggu, mulai dari yang paling sering diperdebatkan. Setiap perpindahan disertai catatan singkat: angka lama, angka baru, dan alasan perbedaannya.</p><blockquote><p>Satu metrik yang tak lagi diperdebatkan lebih berharga dari sepuluh dasbor.</p></blockquote>",
							]),
							{
								id: "w-metrics-v",
								type: "video",
								provider: "youtube",
								videoId: "Rk3mXb7QpLs",
								title: t(["Talk: testing metrics like code", "Talk: menguji metrik seperti kode"]),
								thumbnail: picture("sintaks-video.svg", [
									"Video: testing metrics like code",
									"Video: menguji metrik seperti kode",
								]),
							},
							{
								id: "w-metrics-s",
								type: "embed",
								provider: "google-slides",
								ref: "1sKq9RkM4fJ2tLwPz8VbXn3HcYdQe7UaBm5",
								title: t(["Slides: one number per question", "Slide: satu angka per pertanyaan"]),
								thumbnail: picture("sintaks-slides.svg", ["The talk's first slide", "Slide pertama talk"]),
							},
							{
								id: "w-metrics-pdf",
								type: "pdf",
								file: pdf("metric-handbook", "Metric definitions handbook", 14),
								title: t(["Metric definitions handbook (public sample)", "Buku saku definisi metrik (contoh publik)"]),
								pages: 14,
								bytes: 1_600_000,
								preview: picture("sintaks-pdf.svg", ["The handbook's first page", "Halaman pertama buku saku"], {
									width: 800,
									height: 1131,
								}),
							},
							{
								id: "w-metrics-l",
								type: "link",
								url: "https://medium.com/@rakamahendra/one-definition-per-metric",
								title: t([
									"One definition per metric: notes from a dbt migration",
									"Satu definisi per metrik: catatan migrasi dbt",
								]),
								description: t([
									"What we moved first, what broke, and the review rule that stuck.",
									"Apa yang dipindahkan lebih dulu, apa yang rusak, dan aturan tinjauan yang bertahan.",
								]),
								siteName: "medium.com",
								brandIcon: "medium",
							},
							text("w-metrics-r", [
								"<h3>Result</h3><p>Three GMV numbers became one. The weekly argument turned into a weekly review, and the warehouse bill fell by almost half.</p>",
								"<h3>Hasil</h3><p>Tiga angka GMV menjadi satu. Debat mingguan berubah jadi tinjauan mingguan, dan tagihan warehouse turun hampir separuh.</p>",
							]),
						],
					}),
					primaryLink: { label: t(["Source", "Kode"]), url: "https://github.com/rakamahendra/metrics-layer" },
				},
				{
					...work({
						id: "w-experiments",
						slug: "experiment-platform",
						title: ["An experimentation platform", "Platform eksperimen"],
						summary: [
							"From six tests a quarter to 220 a year, with results the whole company reads the same way.",
							"Dari enam uji per kuartal menjadi 220 per tahun, dengan hasil yang dibaca sama oleh seluruh perusahaan.",
						],
						role: ["Product owner", "Product owner"],
						date: "2022–2024",
						tags: ["Python", "Airflow", ["Statistics", "Statistika"]],
						cover: "sintaks-2.svg",
						metrics: [metric("m-exp", ["Tests a year", "Uji per tahun"], 220)],
						blocks: [
							text("w-experiments-t", [
								"<p>A test starts from a template with its metric, its minimum effect and its sample size already worked out. Airflow checks the split every hour and stops a test that drifts.</p><p>Results come with one sentence a product manager can repeat in a meeting.</p>",
								"<p>Setiap uji dimulai dari templat yang sudah berisi metrik, efek minimum, dan ukuran sampelnya. Airflow memeriksa pembagian setiap jam dan menghentikan uji yang menyimpang.</p><p>Hasilnya datang dengan satu kalimat yang bisa diulang product manager di rapat.</p>",
							]),
						],
					}),
					primaryLink: { label: t(["Source", "Kode"]), url: "https://github.com/rakamahendra/abacus" },
				},
				work({
					id: "w-uplift",
					slug: "voucher-uplift",
					title: ["An uplift model for vouchers", "Model uplift untuk voucher"],
					summary: [
						"Vouchers go to buyers who would not order without one: the same GMV on 28% less promo spend.",
						"Voucher hanya untuk pembeli yang tak akan berbelanja tanpanya: GMV sama dengan biaya promo 28% lebih hemat.",
					],
					role: ["Lead analyst", "Analis utama"],
					date: "2024",
					tags: ["Python", "scikit-learn", "SQL"],
					cover: "sintaks-3.svg",
					metrics: [
						metric("m-uplift", ["Promo spend", "Biaya promo"], -28, {
							format: "percent",
							change: { direction: "down", text: "−28%", good: true },
						}),
					],
					blocks: [
						text("w-uplift-t", [
							"<p>A two-model uplift approach, checked against a holdout every week. The hard part was not the model: it was agreeing that a buyer who orders anyway is a voucher wasted.</p>",
							"<p>Pendekatan uplift dua model, diperiksa terhadap kelompok kontrol setiap minggu. Bagian tersulit bukan modelnya, tetapi menyepakati bahwa pembeli yang tetap berbelanja adalah voucher yang terbuang.</p>",
						]),
					],
				}),
				work({
					id: "w-forecast",
					slug: "seller-forecasts",
					title: ["Demand forecasts for every seller", "Prakiraan permintaan per seller"],
					summary: [
						"Weekly forecasts for 60,000 sellers, sent where they restock; stock-outs fell 23%.",
						"Prakiraan mingguan untuk 60.000 seller, dikirim ke tempat mereka mengisi stok; stok habis turun 23%.",
					],
					role: ["Analytics lead", "Analytics lead"],
					date: "2020–2022",
					tags: ["Python", ["Time series", "Deret waktu"], "BigQuery"],
					cover: "sintaks-4.svg",
					metrics: [
						metric("m-forecast", ["Stock-outs", "Stok habis"], -23, {
							format: "percent",
							change: { direction: "down", text: "−23%", good: true },
						}),
					],
					blocks: [
						text("w-forecast-t", [
							"<p>One model per category, not per seller: small sellers borrow strength from the shelf they sit on.</p>",
							"<p>Satu model per kategori, bukan per seller: seller kecil meminjam kekuatan dari rak tempat mereka berada.</p>",
						]),
					],
				}),
				work({
					id: "w-eta",
					slug: "delivery-eta",
					title: ["Delivery times for 140 hubs", "Waktu kirim untuk 140 hub"],
					summary: [
						"A delivery-time model the hubs plan their shifts with; late parcels fell 18%.",
						"Model waktu kirim yang dipakai hub untuk menyusun shift; paket terlambat turun 18%.",
					],
					role: ["Senior data analyst", "Senior data analyst"],
					date: "2017–2019",
					tags: ["SQL", "Python", ["Geospatial", "Geospasial"]],
					cover: "sintaks-5.svg",
					metrics: [
						metric("m-eta", ["Late parcels", "Paket terlambat"], -18, {
							format: "percent",
							change: { direction: "down", text: "−18%", good: true },
						}),
					],
					blocks: [
						text("w-eta-t", [
							"<p>Each hub got its own morning number: how many parcels will be late today if nothing changes.</p>",
							"<p>Setiap hub mendapat angka paginya sendiri: berapa paket akan terlambat hari ini bila tak ada yang diubah.</p>",
						]),
					],
				}),
				work({
					id: "w-academy",
					slug: "analytics-academy",
					title: ["Analytics Academy", "Analytics Academy"],
					summary: [
						"An internal SQL course: 420 people in product, marketing and operations now answer their own questions.",
						"Kursus SQL internal: 420 staf produk, pemasaran, dan operasional kini menjawab pertanyaannya sendiri.",
					],
					role: ["Founder and teacher", "Penggagas dan pengajar"],
					date: "2023–2025",
					tags: ["SQL", "Looker"],
					cover: "sintaks-6.svg",
					metrics: [metric("m-academy", ["People certified", "Peserta lulus"], 420)],
					blocks: [
						text("w-academy-t", [
							"<p>Six weeks, one real question per week, and a final project that ships to a team's own dashboard.</p>",
							"<p>Enam minggu, satu pertanyaan nyata per minggu, dan proyek akhir yang masuk ke dasbor tim sendiri.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["dbt project review", "Tinjauan proyek dbt"]),
					description: t([
						"Two weeks on your models, tests and warehouse bill, ending with a fix list in order of what it saves.",
						"Dua minggu meninjau model, tes, dan tagihan warehouse Anda, diakhiri daftar perbaikan berurut sesuai penghematannya.",
					]),
					price: t(["From IDR 25m", "Mulai Rp25 jt"]),
					icon: "source-code",
					cta: { kind: "contact", label: t(["Ask through the form", "Tanya lewat form"]) },
				},
				{
					id: "sv-2",
					title: t(["Metrics workshop", "Lokakarya metrik"]),
					description: t([
						"One day with your product and finance leads to agree on the ten numbers that matter, and who owns each.",
						"Satu hari bersama pimpinan produk dan keuangan untuk menyepakati sepuluh angka terpenting dan pemiliknya.",
					]),
					price: t(["IDR 15m / day", "Rp15 jt / hari"]),
					icon: "analytics-01",
					cta: { kind: "contact", label: t(["Ask through the form", "Tanya lewat form"]) },
				},
				{
					id: "sv-3",
					title: t(["Mentoring for data analysts", "Mentoring untuk analis data"]),
					description: t([
						"Four sessions on SQL, modelling and presenting a result in one sentence.",
						"Empat sesi tentang SQL, pemodelan, dan menyampaikan hasil dalam satu kalimat.",
					]),
					price: t(["IDR 750k / session", "Rp750 rb / sesi"]),
					icon: "teaching",
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Raka made our numbers boring in the best way: every team now gets the same answer to the same question.",
						"Raka membuat angka kami membosankan dalam arti terbaik: setiap tim kini mendapat jawaban yang sama untuk pertanyaan yang sama.",
					]),
					name: "Dewi Anggraini",
					role: "VP Finance, Seranta",
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"The experiment platform changed how we ship. We stopped arguing about results and started running more tests.",
						"Platform eksperimen mengubah cara kami merilis. Kami berhenti berdebat soal hasil dan mulai menjalankan lebih banyak uji.",
					]),
					name: "Bimo Prasetyo",
					role: "Group Product Manager, Seranta",
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"His dbt review cut our monthly BigQuery bill almost in half within six weeks.",
						"Tinjauan dbt-nya memangkas tagihan BigQuery bulanan kami hampir separuh dalam enam minggu.",
					]),
					name: "Sekar Wulandari",
					role: "CTO, Kedai Daring",
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Seranta", logo: logo("Seranta", 4, "#16A34A") },
				{ id: "cl-2", name: "Jalur Kirim", logo: logo("Jalur Kirim", 2, "#2563EB") },
				{ id: "cl-3", name: "Kedai Daring", logo: logo("Kedai Daring", 0, "#D97706") },
				{ id: "cl-4", name: "Bank Cakrawala Nusantara", logo: logo("Bank Cakrawala", 1, "#0891B2") },
				{ id: "cl-5", name: "Pasar Pagi" },
				{ id: "cl-6", name: "Lumbung Data" },
			],
		},
		custom: [
			{
				id: "now",
				title: t(["Now", "Sekarang"]),
				content: t([
					"<ul><li>Writing a short guide to testing metrics in dbt.</li><li>Mentoring two analysts moving into analytics engineering.</li><li>Rebuilding the Academy's SQL course for BigQuery's new pipe syntax.</li></ul>",
					"<ul><li>Menulis panduan singkat menguji metrik di dbt.</li><li>Membimbing dua analis yang pindah ke analytics engineering.</li><li>Menyusun ulang kursus SQL Academy untuk sintaks pipe baru BigQuery.</li></ul>",
				]),
				hidden: false,
			},
		],
		location: {
			label: "Jakarta, Indonesia",
			point: { lat: -6.2, lng: 106.85, precision: "city" },
			showMap: true,
			map: {
				light: picture("map-prima-light.svg", ["Map around Jakarta", "Peta sekitar Jakarta"], {
					width: 800,
					height: 480,
				}),
				dark: picture("map-prima-dark.svg", ["Map around Jakarta", "Peta sekitar Jakarta"], {
					width: 800,
					height: 480,
				}),
			},
			workModes: ["remote", "hybrid"],
			relocate: false,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: false,
			whatsapp: { show: true, number: "6281155532690" },
			form: false,
			profiles: true,
			note: t([
				"Have a data problem that needs a second pair of eyes? I reply within two working days.",
				"Punya masalah data yang butuh mata kedua? Saya membalas dalam dua hari kerja.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
