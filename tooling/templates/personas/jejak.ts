import type { Persona } from "./persona";

/** Jejak: an engineering manager in Bandung whose career reads as a path, from intern to manager. */
export const jejak: Persona = {
	name: "Intan Permatasari",
	headline: "Engineering Manager · Agritech Platform",
	email: "intan.permatasari@email.com",
	phone: "+62 822 5554 7318",
	location: "Bandung, Indonesia",
	details: [
		{
			icon: "linkedin-02",
			text: "linkedin.com/in/intanpermatasari",
			link: "https://linkedin.com/in/intanpermatasari",
		},
		{ icon: "github", text: "github.com/intanpermata", link: "https://github.com/intanpermata" },
	],
	summary: [
		"**Engineering manager who started as an intern writing SQL reports** and grew through backend, platform and team leadership. I lead two squads building the ordering and payout systems behind 48,000 farmers, and I care about calm releases, clear ownership and engineers who keep growing.",
		"**Engineering manager yang memulai karier sebagai intern penulis laporan SQL**, lalu bertumbuh lewat backend, platform, hingga memimpin tim. Kini saya memimpin dua squad sistem pemesanan dan pembayaran bagi 48.000 petani, dengan fokus pada rilis yang tenang, kepemilikan yang jelas, dan engineer yang terus berkembang.",
	],
	experience: [
		{
			company: "Tanibumi",
			position: "Engineering Manager",
			location: "Bandung",
			period: ["Jan 2023 – Present", "Jan 2023 – Sekarang"],
			bullets: [
				[
					"Lead 14 engineers in two squads owning farmer ordering and payouts.",
					"Memimpin 14 engineer di dua squad pemesanan dan pembayaran petani.",
				],
				[
					"Raised deploys from once a week to 30 a week while cutting the change failure rate from 14% to 4%.",
					"Menaikkan frekuensi deploy dari mingguan menjadi 30 kali per minggu sekaligus menekan tingkat kegagalan rilis dari 14% ke 4%.",
				],
				[
					"Hired nine engineers and promoted four; one-year retention at 93%.",
					"Merekrut 9 engineer, mempromosikan 4 orang; retensi satu tahun 93%.",
				],
			],
		},
		{
			company: "Tanibumi",
			position: "Senior Software Engineer",
			location: "Bandung",
			period: ["Mar 2021 – Dec 2022", "Mar 2021 – Des 2022"],
			bullets: [
				[
					"Rebuilt farmer payouts in Go with idempotent jobs; failed transfers dropped from 2.1% to 0.2%.",
					"Membangun ulang sistem pembayaran petani dengan Go dan job idempoten; transfer gagal turun dari 2,1% menjadi 0,2%.",
				],
				[
					"Moved 22 services from a single VM to Kubernetes with zero downtime.",
					"Memindahkan 22 layanan dari satu VM ke Kubernetes tanpa downtime.",
				],
			],
		},
		{
			company: "Pustaka Digital Nusantara",
			position: "Senior Software Engineer",
			location: "Bandung",
			period: ["Jul 2018 – Feb 2021", "Jul 2018 – Feb 2021"],
			bullets: [
				[
					"Owned e-book search over 2 million titles; p95 latency from 900 to 120 ms.",
					"Memegang layanan pencarian untuk katalog 2 juta judul e-book; latensi p95 turun dari 900 ms ke 120 ms.",
				],
				[
					"Split a monolith into five services; three teams now release independently.",
					"Memecah monolit menjadi lima layanan; tiga tim kini merilis secara mandiri.",
				],
				[
					"Mentored six junior engineers and started the team’s written design reviews.",
					"Membimbing enam engineer junior dan memulai design review tertulis.",
				],
			],
		},
		{
			company: "Gerbang Data Indonesia",
			position: "Software Engineer",
			location: "Bandung",
			period: ["Aug 2015 – Jun 2018", "Agu 2015 – Jun 2018"],
			bullets: [
				[
					"Built Java and PostgreSQL APIs for school-admission systems in 11 cities.",
					"Membangun API Java dan PostgreSQL untuk penerimaan sekolah di 11 kota.",
				],
				[
					"Wrote the team’s first automated tests, with 70% coverage on core modules.",
					"Menyusun tes otomatis pertama tim, dengan cakupan 70% pada modul inti.",
				],
			],
		},
		{
			company: "Gerbang Data Indonesia",
			position: "Software Engineering Intern",
			location: "Bandung",
			period: ["Jan 2015 – Jul 2015", "Jan 2015 – Jul 2015"],
			bullets: [
				[
					"Automated 12 monthly SQL reports, saving analysts two days a month.",
					"Mengotomatiskan 12 laporan SQL bulanan, menghemat dua hari kerja analis.",
				],
			],
		},
	],
	education: [
		{
			school: "Institut Teknologi Bandung",
			degree: ["Master of Engineering", "Magister Teknik (M.T.)"],
			area: ["Informatics (part-time)", "Informatika (kelas paruh waktu)"],
			grade: ["GPA 3.81", "IPK 3,81"],
			location: "Bandung",
			period: "2019 – 2021",
		},
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Informatics", "Informatika"],
			grade: ["GPA 3.58", "IPK 3,58"],
			location: "Bandung",
			period: "2011 – 2015",
		},
	],
	skills: [
		{ name: ["Engineering", "Engineering"], keywords: ["Go", "Java", "PostgreSQL", "Kafka", "Kubernetes", "AWS"] },
		{
			name: ["Leadership", "Kepemimpinan"],
			keywords: [
				["Hiring", "Rekrutmen"],
				["Career ladders", "Jenjang karier"],
				["Incident reviews", "Tinjauan insiden"],
				"OKR",
			],
		},
		{
			name: ["Delivery", "Delivery"],
			keywords: ["Scrum", "DORA metrics", ["Roadmapping", "Penyusunan roadmap"]],
		},
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Sundanese", "Bahasa Sunda"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Professional", "Profesional"], level: 4 },
	],
	certifications: [
		{ title: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", date: "2020" },
		{ title: "Certified Kubernetes Application Developer", issuer: "The Linux Foundation", date: "2022" },
		{ title: "Professional Scrum Master I", issuer: "Scrum.org", date: "2023" },
	],
	volunteer: [
		{
			organization: "Perempuan Koding Bandung",
			location: "Bandung",
			period: ["2019 – Present", "2019 – Sekarang"],
			description: [
				"Volunteer mentor; helped 40 career-switching women land first engineering jobs.",
				"Mentor sukarela; membantu 40 perempuan alih karier ke pekerjaan engineering.",
			],
		},
	],
	interests: [
		{ name: ["Bouldering", "Panjat tebing"] },
		{ name: ["Teaching kids to code", "Mengajar anak ngoding"] },
		{ name: ["Sundanese cooking", "Masakan Sunda"] },
	],
	layout: {
		main: ["summary", "experience", "education", "volunteer"],
		sidebar: ["skills", "languages", "certifications", "interests"],
	},
};
