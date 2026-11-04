import type { Persona } from "./persona";
import { iconDesignOf } from "@rezumi/schema/resume/data";

/** Vector, for developers: a backend engineer at a commerce company, with tool logos on the stack chips. */
export const vector: Persona = {
	name: "Fajar Nugraha",
	headline: "Senior Backend Engineer · Payments & Order Systems",
	email: "fajar.nugraha@email.com",
	phone: "+62 811 5550 2468",
	location: "Jakarta, Indonesia",
	website: { url: "https://fajarnugraha.dev", label: "fajarnugraha.dev" },
	details: [
		{ icon: "github", text: "github.com/fajarnugraha", link: "https://github.com/fajarnugraha" },
		{ icon: "linkedin-02", text: "linkedin.com/in/fajarnugraha", link: "https://linkedin.com/in/fajarnugraha" },
	],
	summary: [
		"**Backend engineer with seven years building order, payment and logistics services** in TypeScript and Java. I design APIs that stay fast at peak traffic and keep money flows correct with idempotent, tested code.",
		"**Backend engineer dengan tujuh tahun pengalaman membangun layanan pesanan, pembayaran dan logistik** dengan TypeScript dan Java. Fokus pada API yang tetap cepat saat trafik puncak dan alur uang yang akurat.",
	],
	skills: [
		{ name: ["Languages", "Bahasa"], keywords: ["TypeScript", "Java", "Python", "SQL", "Bash"] },
		{ name: ["Data & cloud", "Data & cloud"], keywords: ["PostgreSQL", "MySQL", "AWS Lambda"] },
		{ name: ["Tooling", "Perangkat"], keywords: ["Git", "GitHub", "GitLab", "npm", "Visual Studio Code"] },
		{ name: ["Frontend & team", "Frontend & tim"], keywords: ["React", "Tailwind CSS", "Figma", "Notion", "Slack"] },
	],
	experience: [
		{
			company: "Sagara Commerce",
			position: "Senior Backend Engineer",
			location: "Jakarta",
			period: ["Jan 2024 – Present", "Jan 2024 – Sekarang"],
			bullets: [
				[
					"Lead 5 engineers on the checkout and payment services, which handle 1.8 million orders a day at peak.",
					"Memimpin 5 engineer di layanan checkout dan pembayaran yang memproses 1,8 juta pesanan per hari.",
				],
				[
					"Split the order monolith into 6 Node.js services on Kafka; p99 latency fell from 1.2 s to 280 ms.",
					"Memecah monolit pesanan jadi 6 layanan Node.js dan Kafka; latensi p99 turun dari 1,2 s ke 280 ms.",
				],
				[
					"Introduced idempotency keys and a reconciliation job; duplicate charges dropped to zero and refunds by 37%.",
					"Menerapkan idempotency key dan job rekonsiliasi; tagihan ganda menjadi nol dan refund turun 37%.",
				],
			],
		},
		{
			company: "Sagara Commerce",
			position: "Backend Engineer",
			location: "Jakarta",
			period: ["Feb 2021 – Dec 2023", "Feb 2021 – Des 2023"],
			bullets: [
				[
					"Built the Java promotions engine: 12,000 campaigns a month and flash sales for 300,000 concurrent users.",
					"Membangun mesin promo Java untuk 12.000 kampanye/bulan dan flash sale 300.000 pengguna serentak.",
				],
				[
					"Moved nightly reports to AWS Lambda and cut their infrastructure cost by 62%.",
					"Memindahkan laporan malam ke AWS Lambda dan memangkas biaya infrastrukturnya hingga 62%.",
				],
			],
		},
		{
			company: "Lintas Kargo",
			position: "Software Engineer",
			location: "Jakarta",
			period: ["Aug 2019 – Jan 2021", "Agu 2019 – Jan 2021"],
			bullets: [
				[
					"Wrote the shipment-tracking API in TypeScript used by 40 partner couriers; kept uptime at 99.95%.",
					"Menulis API pelacakan pengiriman dengan TypeScript yang dipakai 40 kurir mitra; menjaga uptime 99,95%.",
				],
			],
		},
	],
	projects: [
		{
			name: "antre",
			period: ["2022 – Present", "2022 – Sekarang"],
			website: { url: "https://github.com/fajarnugraha/antre", label: "github.com/fajarnugraha/antre" },
			description: [
				"PostgreSQL-backed job queue for TypeScript with retries and scheduling; 1,400 stars, 30 contributors.",
				"Job queue TypeScript berbasis PostgreSQL, lengkap dengan retry dan jadwal; 1.400 bintang GitHub.",
			],
		},
		{
			name: "rupiah-ts",
			period: "2020",
			description: [
				"Exact money arithmetic and Rupiah formatting; 9,000 weekly downloads on npm.",
				"Aritmetika uang yang presisi dan format Rupiah; 9.000 unduhan per minggu di npm.",
			],
		},
	],
	education: [
		{
			school: "Universitas Indonesia",
			degree: ["Bachelor of Computer Science", "Sarjana Ilmu Komputer (S.Kom.)"],
			area: ["Computer Science", "Ilmu Komputer"],
			grade: ["GPA 3.62", "IPK 3,62"],
			location: "Depok",
			period: "2015 – 2019",
		},
	],
	certifications: [
		{ title: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", date: "2023" },
		{ title: "AWS Certified Developer – Associate", issuer: "Amazon Web Services", date: "2022" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 0 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 0 },
	],
	columns: { skills: 2, certifications: 2, languages: 2 },
	layout: {
		main: ["summary", "skills", "experience", "projects", "education"],
		sidebar: ["certifications", "languages"],
	},
	finish: (data) => {
		data.metadata.design.icons = { ...iconDesignOf(data.metadata.design), logos: true };
	},
};
