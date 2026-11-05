import type { Persona } from "./persona";

/** Selaras, the split header: a former management consultant leading product strategy at an SME lending fintech. */
export const selaras: Persona = {
	name: "Teuku Rizal Fahmi",
	headline: ["Product Strategy Lead · Fintech & SME Lending", "Product Strategy Lead · Fintech & Pembiayaan UMKM"],
	email: "teuku.fahmi@email.com",
	phone: "+62 811 5556 3018",
	location: "Jakarta, Indonesia",
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/teukurizalfahmi", link: "https://linkedin.com/in/teukurizalfahmi" },
	],
	summary: [
		"**Product strategist with twelve years across management consulting and fintech.** I size the market, build the business case and turn it into a roadmap of clear bets, then stay close to delivery until the numbers move. I now shape SME lending products that disburse Rp 3.2 trillion a year.",
		"**Product strategist dengan dua belas tahun pengalaman di konsultan manajemen dan fintech.** Saya mengukur pasar, menyusun business case dan menerjemahkannya menjadi roadmap dengan taruhan yang jelas, lalu mengawal eksekusinya hingga angka bergerak. Kini saya membentuk produk pembiayaan UMKM yang menyalurkan Rp 3,2 triliun per tahun.",
	],
	experience: [
		{
			company: "Pundi Niaga",
			position: "Product Strategy Lead",
			location: "Jakarta",
			period: ["Jun 2023 – Present", "Jun 2023 – Sekarang"],
			bullets: [
				[
					"Own strategy for invoice financing and working-capital loans; yearly disbursement grew from Rp 900 billion to Rp 3.2 trillion.",
					"Bertanggung jawab atas strategi pembiayaan invoice dan modal kerja; penyaluran tahunan naik dari Rp 900 miliar menjadi Rp 3,2 triliun.",
				],
				[
					"Built risk-based pricing with the credit team; 90-day defaults fell from 4.1% to 2.6% while approvals rose 18%.",
					"Membangun penetapan harga berbasis risiko bersama tim kredit; gagal bayar 90 hari turun dari 4,1% ke 2,6%, persetujuan naik 18%.",
				],
			],
		},
		{
			company: "Sarana Strategy Group",
			position: "Engagement Manager",
			location: ["Jakarta & Singapore", "Jakarta & Singapura"],
			period: "Sep 2019 – May 2023",
			bullets: [
				[
					"Led 11 engagements for banks, insurers and e-wallets in Indonesia and Malaysia, with teams of up to 8 consultants.",
					"Memimpin 11 proyek untuk bank, asuransi dan dompet digital di Indonesia dan Malaysia dengan tim hingga 8 konsultan.",
				],
				[
					"Designed a digital lending blueprint for a regional bank; its SME loan book grew 27% in the first year.",
					"Merancang cetak biru kredit digital untuk sebuah bank daerah; portofolio kredit UMKM-nya tumbuh 27% pada tahun pertama.",
				],
			],
		},
		{
			company: "Sarana Strategy Group",
			position: ["Business Analyst, then Consultant", "Business Analyst, lalu Consultant"],
			location: "Jakarta",
			period: ["Aug 2013 – Jun 2018", "Agu 2013 – Jun 2018"],
			bullets: [
				[
					"Built market models and cost programmes for 15 clients in banking, telecoms and retail; one cost review saved Rp 210 billion a year.",
					"Menyusun model pasar dan program efisiensi untuk 15 klien perbankan, telekomunikasi dan ritel; salah satunya menghemat Rp 210 miliar per tahun.",
				],
			],
		},
	],
	education: [
		{
			school: "INSEAD",
			degree: ["Master of Business Administration", "Master of Business Administration (MBA)"],
			area: ["Business Administration", "Administrasi Bisnis"],
			location: ["Fontainebleau & Singapore", "Fontainebleau & Singapura"],
			period: "2018 – 2019",
		},
		{
			school: "Universitas Syiah Kuala",
			degree: ["Bachelor of Economics", "Sarjana Ekonomi (S.E.)"],
			area: ["Management", "Manajemen"],
			grade: ["GPA 3.74", "IPK 3,74"],
			location: "Banda Aceh",
			period: "2009 – 2013",
		},
	],
	skills: [
		{
			name: ["Strategy", "Strategi"],
			keywords: [["Market sizing", "Estimasi pasar"], "Business case", ["Pricing", "Penetapan harga"], "OKR"],
		},
		{
			name: ["Fintech & risk", "Fintech & risiko"],
			keywords: [["Credit risk", "Risiko kredit"], "Unit economics", ["OJK regulation", "Regulasi OJK"]],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["SQL", "Excel", "Tableau", "Jira"] },
	],
	certifications: [
		{ title: "Financial Risk Manager (FRM)", issuer: "GARP", date: "2021" },
		{ title: "Professional Scrum Product Owner I", issuer: "Scrum.org", date: "2023" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent", "Fasih"], level: 5 },
		{ language: ["Acehnese", "Bahasa Aceh"], fluency: ["Native", "Bahasa ibu"], level: 5 },
	],
	columns: { skills: 3, certifications: 2, languages: 3 },
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "certifications", "languages"],
	},
};
