import type { PersonaDefinition } from "../persona";

/** Prima: Anindya Dewi, a private banker in Jakarta (`mockups/prima.html`). Client names are disguised. */
export const anindya: PersonaDefinition = {
	id: "anindya",
	theme: "prima",
	resume: "purnama",
	username: "anindya",
	accent: "rgba(22, 30, 52, 1)",
	photo: "anindya.jpg",
	profiles: [
		{
			network: "LinkedIn",
			username: "anindyadewi",
			url: "https://www.linkedin.com/in/anindyadewi",
			icon: "linkedin-02",
		},
	],
	minimal: ["Private banker in Jakarta.", "Private banker di Jakarta."],
	long: {
		name: "Raden Ajeng Anindya Dewi Prameswarikusumaningrum",
		headline: [
			"Senior Relationship Manager for private banking, family succession planning and fixed-income portfolios",
			"Senior Relationship Manager untuk private banking, perencanaan suksesi keluarga, dan portofolio pendapatan tetap",
		],
	},
	arabic: {
		headline: "مديرة علاقات أولى · الخدمات المصرفية الخاصة",
		greeting: "أرافق العائلات في إدارة ثرواتها عبر الأجيال، من خلافة الأعمال إلى تعليم الأبناء في الخارج.",
		availability: "متاحة لمنصب رئيسة الخدمات المصرفية الخاصة",
	},
	portfolio: ({ t, picture, logo, pdf, metric, text, work }) => ({
		hero: {
			greeting: t([
				"I help families manage their wealth across generations, from business succession to children's education abroad.",
				"Saya mendampingi keluarga menata kekayaan lintas generasi, dari suksesi usaha hingga pendidikan anak di luar negeri.",
			]),
			showPicture: true,
			availability: {
				show: true,
				text: t(["Open to Head of Private Banking roles", "Terbuka untuk peran Head of Private Banking"]),
				roles: ["Head of Private Banking", "Wealth Advisory Lead"],
				types: ["full-time"],
			},
			highlights: [
				metric("hl-1", ["Assets managed", "Aset dikelola"], 4_600_000_000_000, {
					format: "currency",
					currency: "IDR",
					context: ["48 families", "48 keluarga"],
				}),
				metric("hl-2", ["Portfolio growth", "Pertumbuhan portofolio"], 38, {
					format: "percent",
					prefix: "+",
					context: ["over 3 years", "dalam 3 tahun"],
				}),
				metric("hl-3", ["New money 2025", "Dana baru 2025"], 1_200_000_000_000, {
					format: "currency",
					currency: "IDR",
					context: ["highest of 26 bankers", "tertinggi dari 26 banker"],
				}),
				metric("hl-4", ["Top client retention", "Retensi nasabah utama"], 100, {
					format: "percent",
					context: ["last 5 years", "5 tahun terakhir"],
				}),
			],
			buttons: [
				{ kind: "pdf", label: t(["Download CV (PDF)", "Unduh CV (PDF)"]) },
				{ kind: "contact", label: t(["Schedule an intro", "Jadwalkan perkenalan"]) },
			],
			effect: {
				phrases: [
					t(["Wealth adviser", "Penasihat kekayaan"]),
					t(["Succession planner", "Pendamping suksesi keluarga"]),
				],
			},
		},
		about: {
			content: t([
				"<p><strong>Private banker with fourteen years in wealth management.</strong> I now advise 48 families with combined assets of IDR 4.6 trillion.</p><p>I build portfolios around a family's goals and keep relationships for the long term: none of my top 20 clients has left in the last five years.</p>",
				"<p><strong>Private banker dengan empat belas tahun pengalaman di manajemen kekayaan.</strong> Kini saya mendampingi 48 keluarga dengan total aset Rp4,6 T.</p><p>Saya menyusun portofolio sesuai tujuan keluarga dan menjaga hubungan jangka panjang: tak satu pun dari 20 nasabah utama saya berpindah dalam lima tahun terakhir.</p>",
			]),
		},
		works: {
			items: [
				work({
					id: "w-succession",
					slug: "suksesi-keluarga",
					title: ["Second-generation family business succession", "Suksesi usaha keluarga generasi kedua"],
					summary: [
						"Restructured IDR 1.1 trillion of assets so three siblings could carry on the business without a dispute.",
						"Menata ulang aset Rp1,1 T agar tiga bersaudara bisa meneruskan usaha tanpa sengketa.",
					],
					role: ["Lead relationship manager", "Relationship manager utama"],
					date: "2024",
					tags: [["Succession", "Suksesi"], "Family office"],
					cover: "prima-1.svg",
					featured: true,
					metrics: [
						metric("m-assets", ["Assets restructured", "Aset yang ditata"], 1_100_000_000_000, {
							format: "currency",
							currency: "IDR",
							change: { direction: "up", text: "+77%", good: true },
							before: 620_000_000_000,
							series: [620, 690, 760, 840, 930, 1020, 1100],
							context: ["business, property and portfolio", "usaha, properti, dan portofolio"],
						}),
						metric("m-meetings", ["Family meetings to agree", "Rapat keluarga sampai sepakat"], 3, {
							change: { direction: "down", text: ["from 11", "dari 11"], good: true },
							before: 11,
							context: ["per major decision", "per keputusan besar"],
						}),
						metric("m-tax", ["Transfer tax cost", "Biaya pajak peralihan"], -18, {
							format: "percent",
							change: { direction: "down", text: "−18%", good: true },
							context: ["against the first scenario", "dibanding skenario awal"],
						}),
					],
					blocks: [
						text("w-succession-t", [
							"<h3>Problem</h3><p>Three siblings inherited a distribution business and property. Without a written plan, every family meeting ended without a decision.</p><h3>My role</h3><ul><li>Led 14 family meetings with the tax adviser and the notary.</li><li>Mapped the assets and a five-year transfer scenario.</li><li>Kept one decision document all three heirs signed off.</li></ul>",
							"<h3>Masalah</h3><p>Tiga bersaudara mewarisi usaha distribusi dan aset properti. Tanpa rencana tertulis, setiap rapat keluarga berakhir tanpa keputusan.</p><h3>Peran saya</h3><ul><li>Memimpin 14 rapat keluarga bersama penasihat pajak dan notaris.</li><li>Menyusun peta aset dan skenario peralihan lima tahun.</li><li>Menjaga satu dokumen keputusan yang disetujui ketiga ahli waris.</li></ul>",
						]),
						{
							id: "w-succession-g",
							type: "images",
							layout: "grid",
							images: [
								{
									...picture("prima-g1.svg", ["Asset map before the plan", "Peta aset sebelum penataan"]),
									caption: t(["Asset map before the plan", "Peta aset sebelum penataan"]),
								},
								{
									...picture("prima-g2.svg", ["The new ownership structure", "Struktur kepemilikan baru"]),
									caption: t(["The new ownership structure", "Struktur kepemilikan baru"]),
								},
								{
									...picture("prima-g3.svg", ["Five-year transfer schedule", "Jadwal peralihan lima tahun"]),
									caption: t(["Five-year transfer schedule", "Jadwal peralihan lima tahun"]),
								},
							],
						},
						text("w-succession-p", [
							"<h3>Process</h3><p>We started from questions, not products: who wants to run the business, who wants out, and what the parents consider fair.</p><p>Every scenario was written with its tax, its risk and its effect on the business, then discussed one by one.</p><blockquote><p>Families don't need a new product. They need one document they all understand.</p></blockquote>",
							"<h3>Proses</h3><p>Kami mulai dari pertanyaan, bukan produk: siapa yang ingin menjalankan usaha, siapa yang ingin keluar, dan apa yang dianggap adil oleh orang tua.</p><p>Setiap skenario ditulis dengan angka pajak, risiko, dan dampaknya pada usaha, lalu dibahas satu per satu.</p><blockquote><p>Keluarga tidak butuh produk baru. Mereka butuh satu dokumen yang sama-sama mereka pahami.</p></blockquote>",
						]),
						{
							id: "w-succession-v",
							type: "video",
							provider: "youtube",
							videoId: "Hq4mTt9WbZe",
							title: t(["Interview: preparing the next generation", "Wawancara: menyiapkan generasi penerus"]),
							thumbnail: picture("prima-video.svg", [
								"Video: preparing the next generation",
								"Video: menyiapkan generasi penerus",
							]),
						},
						{
							id: "w-fam-slides",
							type: "embed",
							provider: "google-slides",
							ref: "1Kq8ZtR4mVn2Lc7Pw9Xb3Hy6Jd0Fs5Ga1Te",
							title: t(["Family succession workshop slides", "Slide lokakarya suksesi keluarga"]),
						},
						{
							id: "w-succession-pdf",
							type: "pdf",
							file: pdf("family-review", "Family review framework", 9),
							title: t([
								"Family review framework (sample without client data)",
								"Kerangka tinjauan keluarga (contoh tanpa data nasabah)",
							]),
							pages: 9,
							bytes: 1_100_000,
							preview: picture("prima-pdf.svg", ["First page of the framework", "Halaman pertama kerangka"], {
								width: 800,
								height: 1131,
							}),
						},
						{
							id: "w-succession-l",
							type: "link",
							url: "https://www.linkedin.com/pulse/five-questions-succession-anindya-dewi",
							title: t([
								"Five questions before drafting a succession plan",
								"Lima pertanyaan sebelum menyusun rencana suksesi",
							]),
							description: t([
								"Written for the client newsletter, now part of RM training.",
								"Tulisan untuk buletin nasabah, kini dipakai sebagai bahan pelatihan RM.",
							]),
							siteName: "linkedin.com",
							brandIcon: "linkedin-02",
						},
						text("w-succession-r", [
							"<h3>Result</h3><p>The three siblings signed the succession plan in seven months. The business kept running without disruption, and the restructured assets now stand at IDR 1.1 trillion.</p>",
							"<h3>Hasil</h3><p>Ketiga bersaudara menandatangani rencana suksesi dalam tujuh bulan. Usaha tetap berjalan tanpa gangguan, dan aset yang ditata kini Rp1,1 T.</p>",
						]),
					],
				}),
				work({
					id: "w-education",
					slug: "dana-pendidikan",
					title: ["Education funds for three children abroad", "Dana pendidikan tiga anak di luar negeri"],
					summary: [
						"A 12-year plan with laddered bonds; the target was reached two years early.",
						"Rencana 12 tahun dengan obligasi bertingkat; target dana tercapai dua tahun lebih cepat.",
					],
					role: ["Portfolio planner", "Perencana portofolio"],
					date: "2021–2025",
					tags: [
						["Education", "Pendidikan"],
						["Bonds", "Obligasi"],
					],
					cover: "prima-2.svg",
					metrics: [
						metric("m-education", ["Ahead of plan", "Lebih cepat"], ["2 years", "2 tahun"], {
							change: { direction: "up", text: ["vs plan", "dari rencana"], good: true },
						}),
					],
					blocks: [
						text("w-education-t", [
							"<p>Each child's tuition date got its own bond, so no payment ever depended on the market that month.</p>",
							"<p>Setiap tanggal kuliah anak punya obligasinya sendiri, jadi tak ada pembayaran yang bergantung pada pasar bulan itu.</p>",
						]),
					],
				}),
				work({
					id: "w-review",
					slug: "tinjauan-kuartalan",
					title: ["Quarterly family reviews", "Tinjauan keluarga per kuartal"],
					summary: [
						"A meeting format with tax and legal advisers, adopted by the whole private banking team.",
						"Format rapat bersama penasihat pajak dan hukum, diadopsi seluruh tim private banking.",
					],
					role: ["Initiator", "Penggagas"],
					date: "2021",
					tags: [
						["Process", "Proses"],
						["Team", "Tim"],
					],
					cover: "prima-3.svg",
					metrics: [metric("m-review", ["Bankers using it", "Banker yang memakai"], 26)],
					blocks: [
						text("w-review-t", [
							"<p>One agenda, one page of numbers and one list of decisions, sent to the family the next day.</p>",
							"<p>Satu agenda, satu halaman angka, dan satu daftar keputusan yang dikirim ke keluarga keesokan harinya.</p>",
						]),
					],
				}),
				work({
					id: "w-audit",
					slug: "obligasi-audit",
					title: ["A bond portfolio with no audit findings", "Portofolio obligasi tanpa temuan audit"],
					summary: [
						"Four audits in a row without a finding for an IDR 2.1 trillion fixed-income portfolio.",
						"Empat audit berturut-turut tanpa temuan untuk portofolio pendapatan tetap Rp2,1 T.",
					],
					role: "Relationship manager",
					date: "2018–2021",
					tags: [
						["Compliance", "Kepatuhan"],
						["Fixed income", "Pendapatan tetap"],
					],
					cover: "prima-4.svg",
					metrics: [metric("m-audit", ["Audit findings", "Temuan audit"], 0, { context: ["4 audits", "4 audit"] })],
					blocks: [
						text("w-audit-t", [
							"<p>Every trade carried its suitability note and the client's signature before it went out.</p>",
							"<p>Setiap transaksi membawa catatan kesesuaian dan tanda tangan nasabah sebelum dieksekusi.</p>",
						]),
					],
				}),
				work({
					id: "w-coaching",
					slug: "pembinaan-rm",
					title: ["Coaching junior RMs", "Membina RM junior"],
					summary: [
						"Six months of coaching; two of three RMs were promoted within 18 months.",
						"Pendampingan enam bulan; dua dari tiga RM dipromosikan dalam 18 bulan.",
					],
					role: "Mentor",
					date: "2023–2025",
					tags: [["Leadership", "Kepemimpinan"]],
					cover: "prima-5.svg",
					metrics: [metric("m-coaching", ["Promoted", "Dipromosikan"], ["2 of 3", "2 dari 3"])],
					blocks: [
						text("w-coaching-t", [
							"<p>Weekly client calls together, then one written lesson after each.</p>",
							"<p>Telepon nasabah bersama setiap minggu, lalu satu pelajaran tertulis setelahnya.</p>",
						]),
					],
				}),
				work({
					id: "w-priority",
					slug: "nasabah-prioritas",
					title: ["Plans for each priority client segment", "Rencana per segmen nasabah prioritas"],
					summary: [
						"Reorganised 220 priority clients holding IDR 1.3 trillion; fee income rose 52%.",
						"Menata ulang 220 nasabah prioritas berdana Rp1,3 T; pendapatan fee naik 52%.",
					],
					role: "Relationship manager",
					date: "2014–2018",
					tags: [
						["Segmentation", "Segmentasi"],
						["Sales", "Penjualan"],
					],
					cover: "prima-6.svg",
					metrics: [
						metric("m-priority", ["Fee income", "Pendapatan fee"], 52, {
							format: "percent",
							prefix: "+",
							change: { direction: "up", text: "+52%", good: true },
						}),
					],
					blocks: [
						text("w-priority-t", [
							"<p>Four segments, each with its own call rhythm and product shelf.</p>",
							"<p>Empat segmen, masing-masing dengan ritme kontak dan pilihan produknya sendiri.</p>",
						]),
					],
				}),
			],
		},
		services: {
			items: [
				{
					id: "sv-1",
					title: t(["Seminar speaker", "Pembicara seminar"]),
					description: t([
						"Topics: family succession planning, fixed-income investing and an adviser's ethics.",
						"Topik: perencanaan suksesi keluarga, investasi pendapatan tetap, dan etika penasihat.",
					]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
				{
					id: "sv-2",
					title: t(["Relationship manager training", "Pelatihan relationship manager"]),
					description: t([
						"A two-day class for new RMs: reading a family's needs, KYC and regular reviews.",
						"Kelas dua hari untuk RM baru: membaca kebutuhan keluarga, KYC, dan tinjauan berkala.",
					]),
					price: t(["From IDR 12m / class", "Mulai Rp12 jt / kelas"]),
					cta: { kind: "contact", label: t(["Book through the form", "Pesan lewat form"]) },
				},
				{
					id: "sv-3",
					title: t(["Banking career mentoring", "Mentoring karier perbankan"]),
					description: t([
						"Four sessions for graduates and young officers who want to move into private banking.",
						"Empat sesi untuk lulusan dan officer muda yang ingin masuk private banking.",
					]),
					price: t(["IDR 900k / session", "Rp900 rb / sesi"]),
					cta: { kind: "whatsapp", label: t(["Ask on WhatsApp", "Tanya lewat WhatsApp"]) },
				},
			],
		},
		testimonials: {
			items: [
				{
					id: "ts-1",
					quote: t([
						"Anindya is the reason many families stay with us. She listens first, then advises.",
						"Anindya adalah alasan banyak keluarga bertahan bersama kami. Ia mendengar lebih dulu, baru menyarankan.",
					]),
					name: "Ratna Dewanti",
					role: "Head of Private Banking, Bank Karsa Utama",
					consent: true,
				},
				{
					id: "ts-2",
					quote: t([
						"The quarterly review she designed is now the team standard. Shorter meetings, clearer decisions.",
						"Tinjauan kuartalan yang ia rancang kini jadi standar tim. Rapat lebih singkat, keputusan lebih jelas.",
					]),
					name: "Harun Siswanto",
					role: t(["Family tax adviser", "Penasihat pajak keluarga"]),
					consent: true,
				},
				{
					id: "ts-3",
					quote: t([
						"Mentoring with Anindya got me ready to hold my first portfolio.",
						"Mentoring dengan Bu Anindya membuat saya siap memegang portofolio pertama saya.",
					]),
					name: "Alya Prameswari",
					role: "Relationship Manager, Bank Karsa Utama",
					consent: true,
				},
			],
		},
		clients: {
			items: [
				{ id: "cl-1", name: "Bank Karsa Utama", logo: logo("Bank Karsa Utama", 4, "#161E34") },
				{ id: "cl-2", name: "Bank Samudra Raya", logo: logo("Bank Samudra Raya", 5, "#1D4ED8") },
				{ id: "cl-3", name: "Akademi Perbankan Nusa", logo: logo("Akademi Perbankan Nusa", 1, "#7C2D12") },
				{ id: "cl-4", name: "Forum Keluarga Usaha", logo: logo("Forum Keluarga Usaha", 0, "#0F766E") },
				{ id: "cl-5", name: "Mandala Perencana" },
				{ id: "cl-6", name: "Asuransi Jiwa Teduh" },
			],
		},
		custom: [
			{
				id: "principles",
				title: t(["How I work", "Prinsip kerja"]),
				content: t([
					"<ol><li>The family's interest comes before sales targets.</li><li>Every recommendation is written down, with its risks.</li><li>Regular reviews, not only when markets fall.</li></ol>",
					"<ol><li>Kepentingan keluarga di atas target penjualan.</li><li>Setiap saran ditulis, lengkap dengan risikonya.</li><li>Tinjauan rutin, bukan hanya saat pasar turun.</li></ol>",
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
			workModes: ["onsite", "hybrid"],
			relocate: false,
			timezone: "Asia/Jakarta",
			showLocalTime: true,
		},
		contact: {
			email: true,
			phone: false,
			website: false,
			whatsapp: { show: true, number: "6281555560937" },
			form: false,
			profiles: true,
			note: t([
				"Want to talk about a role or a speaking invitation? I reply within two working days.",
				"Ingin berdiskusi tentang peran atau undangan bicara? Saya membalas dalam dua hari kerja.",
			]),
		},
		sections: { order: [], hidden: ["profiles"], titles: {}, hiddenItems: {} },
	}),
};
