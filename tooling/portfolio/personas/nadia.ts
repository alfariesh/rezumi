import type { PersonaDefinition } from "../persona";

/** Lugas: Nadia Rahmawati, a payments product manager in Jakarta (`mockups/lugas.html`). */
export const nadia: PersonaDefinition = {
	id: "nadia",
	theme: "lugas",
	resume: "meridian",
	username: "nadia",
	accent: "rgba(31, 58, 104, 1)",
	photo: "nadia.jpg",
	profiles: [
		{
			network: "LinkedIn",
			username: "nadiarahmawati",
			url: "https://www.linkedin.com/in/nadiarahmawati",
			icon: "linkedin-02",
		},
	],
	minimal: ["Payments product manager in Jakarta.", "Product manager pembayaran digital di Jakarta."],
	long: {
		name: "Nadia Kusumawardhaniputri Rahmawati Puspitasari",
		headline: [
			"Senior Product Manager for digital payments, merchants and large-scale product experiments",
			"Senior Product Manager untuk pembayaran digital, merchant, dan eksperimen produk berskala besar",
		],
	},
	arabic: {
		headline: "مديرة منتجات أولى · المدفوعات",
		greeting: "أبني منتجات دفع يستخدمها الملايين كل يوم، وأحرص على أن يكون كل إصدار قابلاً للقياس.",
		availability: "متاحة لدور قائدة منتجات",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		hero: {
			greeting: t([
				"I build payment products millions of people use every day, and make sure every release can be measured.",
				"Saya membangun produk pembayaran yang dipakai jutaan orang setiap hari, dan memastikan setiap rilis bisa diukur.",
			]),
			showPicture: true,
			availability: {
				show: true,
				text: t(["Open to Lead PM roles", "Terbuka untuk peran Lead PM"]),
				roles: ["Lead Product Manager", "Head of Payments Product"],
				types: ["full-time"],
			},
			highlights: [
				metric("hl-1", ["QR users a month", "pengguna QR per bulan"], 4_000_000, { format: "compact" }),
				metric("hl-2", ["payments succeed", "pembayaran berhasil"], 97.5, { format: "percent" }),
				metric("hl-3", ["A/B tests a year", "uji A/B per tahun"], 40, { suffix: "+" }),
			],
			buttons: [{ kind: "resume" }, { kind: "pdf" }, { kind: "contact" }],
			effect: {
				phrases: [
					t(["Payments product lead", "Pemimpin produk pembayaran"]),
					t(["Experiment coach", "Pelatih eksperimen"]),
				],
			},
		},
		about: {
			content: t([
				"<p><strong>Product manager with eight years in digital payments</strong>, from merchant onboarding to QR checkout used by 4 million people a month.</p><p>I turn research and data into roadmaps engineering trusts, then ship in small, measured steps. Outside work I mentor new PMs and write product notes every Friday.</p>",
				"<p><strong>Product manager dengan delapan tahun pengalaman di pembayaran digital</strong>, dari pendaftaran merchant hingga pembayaran QR yang dipakai 4 juta orang setiap bulan.</p><p>Saya mengubah riset dan data menjadi roadmap yang dipercaya tim engineering, lalu merilis dalam langkah kecil yang terukur. Di luar kantor, saya membimbing PM pemula dan menulis catatan produk setiap Jumat.</p>",
			]),
		},
		works: {
			items: [
				work({
					id: "w-qr",
					slug: "qr-checkout",
					title: ["QR checkout that rarely fails", "QR checkout yang jarang gagal"],
					summary: [
						"Reworked QR payment for 4 million users: from 91% to 97.5% successful payments in four quarters.",
						"Menata ulang alur bayar QR untuk 4 juta pengguna: dari 91% menjadi 97,5% pembayaran berhasil dalam empat kuartal.",
					],
					role: ["Senior PM · team of 11", "Senior PM · tim 11 orang"],
					date: "2022–2024",
					tags: [["Payments", "Pembayaran"], ["Experiments", "Eksperimen"], "Mobile"],
					cover: "lugas-1.svg",
					featured: true,
					metrics: [
						metric("m-qr", ["Successful payments", "Pembayaran berhasil"], 97.5, {
							format: "percent",
							change: { direction: "up", text: ["+6.5 pts", "+6,5 poin"], good: true },
							before: 91,
							series: [91, 92.4, 93.1, 95, 95.9, 97.2, 97.5],
							context: ["4 quarters after launch", "4 kuartal setelah rilis"],
						}),
					],
					blocks: [
						text("w-qr-t", [
							"<h3>Problem</h3><p>One in eleven QR payments failed on the last screen. People tried again, then gave up and paid cash.</p><h3>My role</h3><ul><li>Led discovery with 2 designers and 1 researcher.</li><li>Wrote the spec and experiment plan for 9 engineers.</li><li>Reported results weekly to the risk team and the board.</li></ul>",
							"<h3>Masalah</h3><p>Satu dari sebelas pembayaran QR gagal di layar terakhir. Pengguna mencoba lagi, lalu menyerah dan membayar tunai.</p><h3>Peran saya</h3><ul><li>Memimpin discovery bersama 2 desainer dan 1 peneliti.</li><li>Menulis spesifikasi dan rencana eksperimen untuk 9 engineer.</li><li>Melaporkan hasil mingguan ke tim risiko dan direksi.</li></ul>",
						]),
						{
							id: "w-qr-g",
							type: "images",
							layout: "grid",
							images: [
								{
									...picture("lugas-g1.svg", ["QR screen before the change", "Layar QR sebelum perubahan"]),
									caption: t(["QR screen before the change", "Layar QR sebelum perubahan"]),
								},
								{
									...picture("lugas-g2.svg", ["A clearer amount confirmation", "Konfirmasi nominal yang lebih jelas"]),
									caption: t(["A clearer amount confirmation", "Konfirmasi nominal yang lebih jelas"]),
								},
								picture("lugas-g3.svg", ["Instant receipt after paying", "Struk instan setelah bayar"]),
							],
						},
						{
							id: "w-qr-m2",
							type: "metrics",
							items: [
								metric("m-qr-2", ["Average time to pay", "Waktu bayar rata-rata"], 38, {
									suffix: [" s", " dtk"],
									change: { direction: "down", text: "−42%", good: true },
									before: 66,
									series: [66, 61, 55, 49, 44, 40, 38],
									context: ["from scan to receipt", "dari scan sampai struk"],
								}),
								metric("m-qr-3", ["QR support tickets", "Tiket bantuan soal QR"], 1200, {
									format: "compact",
									suffix: ["/mo", "/bln"],
									change: { direction: "down", text: "−58%", good: true },
									before: 2860,
								}),
							],
						},
						text("w-qr-p", [
							"<h3>Process</h3><p>We recorded 60 payment sessions in stalls and cafés and found two main causes: mistyped amounts and connections dropping on the confirmation screen.</p><p>Every change went to 5% of users first. Only changes that raised success without adding time to pay went to everyone.</p><blockquote><p>If a change can't be measured in two weeks, we split it again until it can.</p></blockquote>",
							"<h3>Proses</h3><p>Kami merekam 60 sesi pembayaran di warung dan kafe, lalu menemukan dua penyebab utama: nominal yang salah ketik dan koneksi yang putus di layar konfirmasi.</p><p>Setiap perubahan dirilis ke 5% pengguna lebih dulu. Hanya yang menaikkan keberhasilan tanpa menambah waktu bayar yang lanjut ke semua pengguna.</p><blockquote><p>Kalau satu perubahan tidak bisa diukur dalam dua minggu, kami pecah lagi sampai bisa.</p></blockquote>",
						]),
						{
							id: "w-qr-v",
							type: "video",
							provider: "youtube",
							videoId: "nRzPq7Lk2Xa",
							title: t(["Demo of the new QR checkout", "Demo alur QR checkout baru"]),
							thumbnail: picture("lugas-video.svg", ["Video: the new QR checkout", "Video: alur QR checkout baru"]),
						},
						{
							id: "w-qr-figma",
							type: "embed",
							provider: "figma",
							ref: "design/Qx7RkP2mVt9LcN4wZb8H?node-id=12-408",
							title: t(["QR checkout flow in Figma", "Alur QR checkout di Figma"]),
							thumbnail: picture("lugas-2.svg", ["Figma: the QR checkout flow", "Figma: alur QR checkout"]),
						},
						{
							id: "w-qr-loom",
							type: "embed",
							provider: "loom",
							ref: "5f2c8a71d04e4b93a6e1c07d8b25f3a9",
							title: t(["Walkthrough for the risk team", "Penjelasan untuk tim risiko"]),
						},
						{
							id: "w-qr-pdf",
							type: "pdf",
							file: pdf("qr-case-study", "QR checkout case study", 12),
							title: t(["QR checkout case study (public version)", "Studi kasus QR checkout (versi publik)"]),
							pages: 12,
							bytes: 2_400_000,
							preview: picture("lugas-pdf.svg", ["First page of the case study", "Halaman pertama studi kasus"], {
								width: 800,
								height: 1131,
							}),
						},
						{
							id: "w-qr-l",
							type: "link",
							url: "https://medium.com/@nadiarahmawati/fewer-failed-payments",
							title: t([
								"How we cut failed payments without adding a step",
								"Cara kami menurunkan pembayaran gagal tanpa menambah langkah",
							]),
							description: t([
								"Product notes on the three experiments that mattered most.",
								"Catatan produk tentang tiga eksperimen yang paling berpengaruh.",
							]),
							siteName: "medium.com",
							brandIcon: "medium",
						},
						text("w-qr-r", [
							"<h3>Result</h3><p>In four quarters successful payments rose from 91% to 97.5% and failed-payment complaints fell by 58%. Three other teams now release the same way.</p>",
							"<h3>Hasil</h3><p>Dalam empat kuartal, pembayaran berhasil naik dari 91% menjadi 97,5%, dan keluhan gagal bayar turun 58%. Pola rilis bertahap ini kini dipakai tiga tim lain.</p>",
						]),
					],
				}),
				work({
					id: "w-split",
					slug: "patungan",
					title: ["Split bills and saved cards", "Patungan dan kartu tersimpan"],
					summary: [
						"Two features that now carry 18% of monthly transaction volume.",
						"Dua fitur yang kini menyumbang 18% volume transaksi bulanan.",
					],
					role: "Senior PM",
					date: "2023",
					tags: [["Payments", "Pembayaran"]],
					cover: "lugas-2.svg",
					metrics: [metric("m-split", ["Transaction volume", "Volume transaksi"], 18, { format: "percent" })],
					blocks: [
						text("w-split-t", [
							"<p>Interviews showed friends paying for each other by bank transfer after every meal. Split bills turned that into one tap.</p>",
							"<p>Wawancara menunjukkan teman saling transfer setelah makan bersama. Patungan mengubahnya jadi satu ketukan.</p>",
						]),
					],
				}),
				work({
					id: "w-merchant",
					slug: "pendaftaran-merchant",
					title: ["Merchant sign-up in under an hour", "Pendaftaran merchant di bawah satu jam"],
					summary: [
						"Automatic document checks cut sign-up from five days to 52 minutes.",
						"Verifikasi dokumen otomatis memangkas waktu daftar dari lima hari menjadi 52 menit.",
					],
					role: ["PM, Merchant Platform", "PM, Merchant Platform"],
					date: "2020",
					tags: ["Onboarding"],
					cover: "lugas-3.svg",
					metrics: [metric("m-merchant", ["Time to sign up", "Waktu daftar"], ["52 min", "52 mnt"])],
					blocks: [
						text("w-merchant-t", [
							"<p>Most of the five days went to someone reading ID photos. A model now checks them, and people only see the doubtful ones.</p>",
							"<p>Sebagian besar dari lima hari habis untuk membaca foto KTP. Kini model memeriksanya, dan manusia hanya melihat yang meragukan.</p>",
						]),
					],
				}),
				work({
					id: "w-dashboard",
					slug: "dasbor-merchant",
					title: ["A self-service dashboard for small merchants", "Dasbor swalayan untuk merchant kecil"],
					summary: [
						"A two-language dashboard that grew active merchants from 60,000 to 310,000.",
						"Dasbor dua bahasa yang menumbuhkan merchant aktif dari 60 ribu menjadi 310 ribu.",
					],
					role: ["PM, Merchant Platform", "PM, Merchant Platform"],
					date: "2019–2021",
					tags: ["Dashboard"],
					cover: "lugas-4.svg",
					metrics: [
						metric("m-dashboard", ["Active merchants", "Merchant aktif"], 310_000, {
							format: "compact",
							before: 60_000,
						}),
					],
					blocks: [
						text("w-dashboard-t", [
							"<p>Sales, payouts and refunds on one screen, readable on a cheap phone.</p>",
							"<p>Penjualan, pencairan, dan refund di satu layar, terbaca di HP murah.</p>",
						]),
					],
				}),
				work({
					id: "w-experiments",
					slug: "ritme-eksperimen",
					title: ["A weekly experiment rhythm", "Ritme eksperimen mingguan"],
					summary: [
						"A review with data science: more than 40 A/B tests a year, each with a written decision.",
						"Tinjauan bersama data science: lebih dari 40 uji A/B per tahun, semuanya dengan keputusan tertulis.",
					],
					role: "Senior PM",
					date: ["2022–now", "2022–kini"],
					tags: [["Experiments", "Eksperimen"]],
					cover: "lugas-5.svg",
					metrics: [metric("m-experiments", ["A/B tests a year", "Uji A/B per tahun"], 40, { suffix: "+" })],
					blocks: [
						text("w-experiments-t", [
							"<p>Thirty minutes every Tuesday: what we tested, what we learned, what we decided.</p>",
							"<p>Tiga puluh menit setiap Selasa: apa yang diuji, apa yang dipelajari, apa yang diputuskan.</p>",
						]),
					],
				}),
				work({
					id: "w-courier",
					slug: "pelacakan-kurir",
					title: ["Live courier tracking", "Pelacakan kurir langsung"],
					summary: [
						"A courier map for 1,200 drivers; “where is my parcel” calls fell by a third.",
						"Peta kurir untuk 1.200 pengemudi; telepon “paket saya di mana” turun sepertiga.",
					],
					role: ["Associate PM · Rantai Logistik", "Associate PM · Rantai Logistik"],
					date: "2017",
					tags: [["Logistics", "Logistik"]],
					cover: "lugas-6.svg",
					metrics: [
						metric("m-courier", ["Calls to support", "Telepon ke CS"], -33, {
							format: "percent",
							change: { direction: "down", text: "−33%", good: true },
						}),
					],
					blocks: [
						text("w-courier-t", [
							"<p>My first product: a map that refreshes every 30 seconds and a message when the courier is near.</p>",
							"<p>Produk pertama saya: peta yang diperbarui tiap 30 detik dan pesan saat kurir sudah dekat.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["Payment flow audit", "Audit alur pembayaran"]),
					description: t([
						"I walk through your checkout, mark where it fails, and give you an ordered list of fixes.",
						"Saya menelusuri checkout-mu, menandai titik gagal, lalu memberi daftar perbaikan berurutan.",
					]),
					price: t(["From IDR 7.5m", "Mulai Rp7,5 jt"]),
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
				{
					id: "sv-2",
					title: t(["PM mentoring", "Mentoring PM"]),
					description: t([
						"Four 60-minute sessions for PMs with 0–3 years: discovery, priorities and writing specs.",
						"Empat sesi 60 menit untuk PM 0–3 tahun: discovery, prioritas, dan menulis spesifikasi.",
					]),
					price: t(["IDR 1.2m / session", "Rp1,2 jt / sesi"]),
					cta: { kind: "contact", label: t(["Send a message", "Kirim pesan"]) },
				},
				{
					id: "sv-3",
					title: t(["Talks & workshops", "Pembicara & workshop"]),
					description: t([
						"Topics: product experiments, digital payments, and PM work with data.",
						"Topik: eksperimen produk, pembayaran digital, dan kerja PM bersama data.",
					]),
					cta: { kind: "contact", label: t(["Send a message", "Kirim pesan"]) },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Nadia makes priority meetings short: the data is clear, the decision is written down, and the team knows why.",
						"Nadia membuat rapat prioritas jadi singkat: datanya jelas, keputusannya tertulis, dan tim tahu alasannya.",
					]),
					name: "Damar Wicaksana",
					role: "Engineering Manager, Kilau Pay",
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"Nadia's specs raise the fewest follow-up questions. We can start building right away.",
						"Spesifikasi dari Nadia paling jarang memicu pertanyaan ulang. Kami bisa langsung membangun.",
					]),
					name: "Sinta Halim",
					role: "Lead Designer, Kilau Pay",
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"A patient mentor who is strict about data. After four sessions I ran my first A/B test.",
						"Mentor yang sabar tapi tegas soal data. Setelah empat sesi, saya berani memimpin uji A/B pertama.",
					]),
					name: "Yoga Pratama",
					role: "Product Manager, Ladang Digital",
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Kilau Pay", logo: logo("Kilau Pay", 0, "#1F3A68") },
				{ id: "cl-2", name: "Rantai Logistik", logo: logo("Rantai Logistik", 1, "#B45309") },
				{ id: "cl-3", name: "Ladang Digital", logo: logo("Ladang Digital", 2, "#15803D") },
				{ id: "cl-4", name: "Pasar Pagi", logo: logo("Pasar Pagi", 3, "#0F766E") },
				{ id: "cl-5", name: "Koperasi Arta" },
				{ id: "cl-6", name: "Nusa Kurir" },
			],
		},
		custom: [
			{
				id: "notes",
				title: t(["Product notes", "Catatan produk"]),
				content: t([
					"<p>Every Friday I write down one lesson from that week's experiments: what we tested, what failed and what we decided. 86 notes since 2024.</p>",
					"<p>Setiap Jumat saya menulis satu pelajaran dari eksperimen minggu itu: apa yang diuji, apa yang gagal, dan keputusan yang diambil. Sudah 86 catatan sejak 2024.</p>",
				]),
				button: {
					kind: "link",
					label: t(["Read the notes", "Baca catatannya"]),
					url: "https://nadiarahmawati.id/catatan",
				},
				hidden: false,
			},
		],
		location: {
			label: "Jakarta, Indonesia",
			point: { lat: -6.2, lng: 106.85, precision: "city" },
			showMap: true,
			map: {
				light: picture("map-lugas-light.svg", ["Map around Jakarta", "Peta sekitar Jakarta"], {
					width: 800,
					height: 480,
				}),
				dark: picture("map-lugas-dark.svg", ["Map around Jakarta", "Peta sekitar Jakarta"], {
					width: 800,
					height: 480,
				}),
			},
			workModes: ["hybrid", "remote"],
			relocate: false,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: true,
			whatsapp: { show: true, number: "6281255501824" },
			form: false,
			profiles: true,
			note: t([
				"Looking for a PM for a payments product? Let's talk.",
				"Sedang mencari PM untuk produk pembayaran? Mari ngobrol.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
