import type { Persona } from "./persona";

/** Meridian, the default: a product manager at a payments company. */
export const meridian: Persona = {
	photo: true,
	name: "Nadia Rahmawati",
	headline: "Senior Product Manager · Payments",
	email: "nadia.rahmawati@email.com",
	phone: "+62 812 5550 1824",
	location: "Jakarta, Indonesia",
	website: { url: "https://nadiarahmawati.id", label: "nadiarahmawati.id" },
	details: [
		{ icon: "linkedin-02", text: "linkedin.com/in/nadiarahmawati", link: "https://linkedin.com/in/nadiarahmawati" },
	],
	summary: [
		"**Product manager with eight years in digital payments**, from merchant onboarding to QR checkout used by 4 million people a month. I turn research and data into roadmaps engineers trust, and I ship in small, measured steps.",
		"**Product manager dengan delapan tahun pengalaman di pembayaran digital**, dari pendaftaran merchant hingga pembayaran QR yang dipakai 4 juta orang setiap bulan. Saya mengubah riset dan data menjadi roadmap yang dipercaya tim engineering, dan merilis dalam langkah kecil yang terukur.",
	],
	experience: [
		{
			company: "Kilau Pay",
			position: "Senior Product Manager",
			location: "Jakarta",
			period: ["Mar 2022 – Present", "Mar 2022 – Sekarang"],
			bullets: [
				[
					"Lead the QR checkout squad of 11 engineers and designers; raised payment success from 91% to 97.5% in four quarters.",
					"Memimpin tim QR checkout berisi 11 engineer dan desainer; menaikkan tingkat keberhasilan pembayaran dari 91% menjadi 97,5% dalam empat kuartal.",
				],
				[
					"Launched split bills and saved cards, now 18% of monthly transaction volume.",
					"Meluncurkan fitur patungan dan kartu tersimpan, kini 18% dari volume transaksi bulanan.",
				],
				[
					"Set up a weekly experiment review with data science; 40+ A/B tests a year with written decisions.",
					"Membentuk tinjauan eksperimen mingguan bersama data science; lebih dari 40 uji A/B per tahun dengan keputusan tertulis.",
				],
			],
		},
		{
			company: "Kilau Pay",
			position: "Product Manager, Merchant Platform",
			location: "Jakarta",
			period: "Jan 2019 – Feb 2022",
			bullets: [
				[
					"Cut merchant onboarding from five days to under one hour with automated document checks.",
					"Memangkas waktu pendaftaran merchant dari lima hari menjadi kurang dari satu jam dengan verifikasi dokumen otomatis.",
				],
				[
					"Grew active small merchants from 60,000 to 310,000 with a self-serve dashboard in Indonesian and English.",
					"Menumbuhkan merchant kecil aktif dari 60.000 menjadi 310.000 lewat dasbor swalayan dalam bahasa Indonesia dan Inggris.",
				],
			],
		},
		{
			company: "Rantai Logistik",
			position: ["Associate Product Manager", "Associate Product Manager"],
			location: "Bandung",
			period: "Jul 2016 – Dec 2018",
			bullets: [
				[
					"Shipped live courier tracking for 1,200 drivers, reducing “where is my parcel” calls by a third.",
					"Merilis pelacakan kurir langsung untuk 1.200 pengemudi, mengurangi telepon “paket saya di mana” hingga sepertiga.",
				],
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Engineering", "Sarjana Teknik"],
			area: ["Industrial Engineering", "Teknik Industri"],
			grade: ["GPA 3.71", "IPK 3,71"],
			location: "Bandung",
			period: "2012 – 2016",
		},
	],
	skills: [
		{
			name: ["Product", "Produk"],
			keywords: ["Discovery", "Roadmapping", ["Pricing", "Penetapan harga"], "OKR"],
		},
		{ name: "Data", keywords: ["SQL", "A/B testing", "Amplitude", "Looker"] },
		{ name: ["Delivery", "Eksekusi"], keywords: ["Scrum", ["Writing specs", "Menulis spesifikasi"], "Figma"] },
	],
	certifications: [
		{ title: "Certified Scrum Product Owner", issuer: "Scrum Alliance", date: "2021" },
		{
			title: ["Payments Risk Management", "Manajemen Risiko Pembayaran"],
			issuer: "Akademi Pembayaran Nusantara",
			date: "2023",
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	layout: {
		main: ["summary", "experience", "education"],
		sidebar: ["skills", "certifications", "languages"],
	},
	columns: { skills: 3, certifications: 2, languages: 2 },
};
