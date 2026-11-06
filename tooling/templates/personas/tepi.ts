import type { Persona } from "./persona";

/** Tepi: a machine learning researcher building language models for Indonesian and regional languages. */
export const tepi: Persona = {
	name: "Arya Mahardika",
	headline: ["Machine Learning Researcher · Indonesian NLP", "Peneliti Machine Learning · NLP Bahasa Indonesia"],
	email: "arya.mahardika@email.com",
	phone: "+62 812 5553 8146",
	location: "Jakarta, Indonesia",
	website: { url: "https://aryamahardika.ai", label: "aryamahardika.ai" },
	details: [
		{ icon: "github", text: "github.com/aryamahardika", link: "https://github.com/aryamahardika" },
		{ icon: "id-card", text: "ORCID 0000-0003-5552-7719", link: "https://orcid.org/0000-0003-5552-7719" },
	],
	summary: [
		"**Applied scientist building language models that work for Indonesia’s regional languages, not just Indonesian.** Nine years in NLP research and production, from low-resource machine translation to speech recognition for Javanese and Sundanese. My models serve 4 million requests a day, and my open datasets are used by more than 30 research groups.",
		"**Applied scientist yang membangun model bahasa untuk bahasa-bahasa daerah Indonesia, bukan hanya bahasa Indonesia.** Sembilan tahun berkiprah di riset dan produksi NLP, dari terjemahan mesin sumber daya rendah hingga pengenalan ucapan bahasa Jawa dan Sunda. Model saya melayani 4 juta permintaan per hari, dan dataset terbuka saya dipakai lebih dari 30 kelompok riset.",
	],
	experience: [
		{
			company: "Lentera Nalar AI Lab",
			position: ["Senior Research Scientist, NLP", "Senior Research Scientist, NLP"],
			location: "Jakarta",
			period: ["Jan 2023 – Present", "Jan 2023 – Sekarang"],
			bullets: [
				[
					"Lead a team of five training a 7-billion-parameter model for Indonesian and 12 regional languages; it beats open baselines by 9 points on our benchmark.",
					"Memimpin tim lima orang melatih model 7 miliar parameter untuk bahasa Indonesia dan 12 bahasa daerah; unggul 9 poin dari model terbuka di benchmark kami.",
				],
				[
					"Released NusaEval, a 40-task benchmark now used by more than 30 universities and labs.",
					"Merilis NusaEval, benchmark 40 tugas yang kini dipakai lebih dari 30 kampus dan lab.",
				],
			],
		},
		{
			company: "Suarakata",
			position: ["Applied Scientist, Speech", "Applied Scientist, Speech"],
			location: "Bandung",
			period: ["Mar 2020 – Dec 2022", "Mar 2020 – Des 2022"],
			bullets: [
				[
					"Built Javanese and Sundanese speech recognition for a call-centre product; word error rate fell from 31% to 14%.",
					"Membangun pengenalan ucapan bahasa Jawa dan Sunda untuk produk call center; word error rate turun dari 31% ke 14%.",
				],
				[
					"Designed the pipeline that collected 6,000 hours of speech from 1,900 paid volunteer speakers.",
					"Merancang pipeline yang menghimpun 6.000 jam rekaman suara dari 1.900 penutur relawan berbayar.",
				],
			],
		},
		{
			company: "Institut Teknologi Bandung",
			position: ["Research Assistant, Computational Linguistics", "Asisten Peneliti, Linguistik Komputasional"],
			location: "Bandung",
			period: ["Sep 2017 – Feb 2020", "Sep 2017 – Feb 2020"],
			bullets: [
				[
					"Built a 2-million-sentence Indonesian–Javanese parallel corpus, released under an open licence.",
					"Menyusun korpus paralel Indonesia–Jawa berisi 2 juta kalimat yang dirilis dengan lisensi terbuka.",
				],
			],
		},
	],
	publications: [
		{
			title: "NusaEval: a benchmark for language models in Indonesian and twelve regional languages",
			publisher: "Conference on Low-Resource Language Technology 2025",
			date: "2025",
			description: [
				"First author, with S. Hutapea, N. Rahim and M. Tan",
				"Penulis utama, bersama S. Hutapea, N. Rahim dan M. Tan",
			],
		},
		{
			title: "Cheap tokens, fair models: vocabulary design for Austronesian languages",
			publisher: "Journal of Computational Linguistics in Asia 8(1)",
			date: "2024",
		},
		{
			title: "Crowd-sourced speech corpora for Javanese and Sundanese ASR",
			publisher: "Workshop on Speech for Under-Resourced Languages",
			date: "2022",
		},
	],
	education: [
		{
			school: "University of Edinburgh",
			degree: ["Master of Science", "Master of Science"],
			area: ["Artificial Intelligence", "Artificial Intelligence"],
			grade: ["With distinction", "Predikat distinction"],
			location: ["Edinburgh, United Kingdom", "Edinburgh, Inggris"],
			period: "2016 – 2017",
		},
		{
			school: "Institut Teknologi Bandung",
			degree: ["Bachelor of Engineering", "Sarjana Teknik (S.T.)"],
			area: ["Informatics", "Teknik Informatika"],
			grade: ["GPA 3.71", "IPK 3,71"],
			location: "Bandung",
			period: "2011 – 2015",
		},
	],
	skills: [
		{
			name: ["Research", "Riset"],
			keywords: [
				["Language modelling", "Pemodelan bahasa"],
				["Machine translation", "Terjemahan mesin"],
				["Speech recognition", "Pengenalan ucapan"],
				["Evaluation", "Evaluasi"],
			],
		},
		{
			name: ["Engineering", "Rekayasa"],
			keywords: [["Distillation", "Distilasi"], ["Data pipelines", "Pipeline data"], "MLOps"],
		},
		{ name: ["Tools", "Perangkat"], keywords: ["Python", "PyTorch", "JAX", "Hugging Face", "Kubernetes"] },
	],
	awards: [
		{
			title: ["Best Paper Award", "Makalah Terbaik"],
			awarder: "Conference on Low-Resource Language Technology",
			date: "2025",
		},
		{
			title: ["Young Researcher Grant", "Hibah Peneliti Muda"],
			awarder: ["Yayasan Riset Bahasa Nusantara · IDR 600 million", "Yayasan Riset Bahasa Nusantara · Rp600 juta"],
			date: "2024",
		},
		{ title: ["Master’s Scholarship", "Beasiswa Magister"], awarder: "LPDP", date: "2016" },
	],
	languages: [
		{ language: ["Indonesian", "Bahasa Indonesia"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["Balinese", "Bahasa Bali"], fluency: ["Native", "Bahasa ibu"], level: 5 },
		{ language: ["English", "Bahasa Inggris"], fluency: ["Fluent (IELTS 7.5)", "Fasih (IELTS 7,5)"], level: 5 },
		{ language: ["Javanese", "Bahasa Jawa"], fluency: ["Conversational", "Percakapan"], level: 3 },
	],
	layout: {
		main: ["summary", "experience", "publications", "education"],
		sidebar: ["skills", "awards", "languages"],
	},
};
