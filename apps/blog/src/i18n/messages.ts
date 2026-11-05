import type { Locale } from "./config";

/**
 * The blog's interface copy. Articles, topics and tags are content and live in EmDash; these are the words around
 * them. Indonesian follows the app's catalog (apps/web/locales/id-ID.po) where the same phrase exists there.
 */
const en = {
	"meta.homeTitle": "Resume, job search and interview advice",
	"meta.homeDescription":
		"Practical guides on resumes, applications and interviews from the team building Rezumi, the resume builder with an ATS check and AI tailoring.",
	"meta.searchTitle": "Search",
	"meta.categoryDescription": "Articles about {topic} from the Rezumi Blog.",
	"meta.tagDescription": "Articles tagged {tag} on the Rezumi Blog.",

	"nav.skip": "Skip to content",
	"nav.home": "Rezumi Blog home",
	"nav.topics": "Topics",
	"nav.search": "Search",
	"nav.language": "Language",

	"home.eyebrow": "Rezumi Blog",
	"home.title": "Advice for the job search you're in right now.",
	"home.description": "Practical guides on resumes, applications and interviews, from the team building Rezumi.",
	"home.latest": "Latest articles",
	"home.empty": "No articles yet. The first ones are on their way.",

	"post.readingTime": "{minutes} min read",
	"post.updated": "Updated {date}",
	"post.by": "By {names}",
	"post.onThisPage": "On this page",
	"post.tags": "Tags",
	"post.keepReading": "Keep reading",
	"post.translated": "This article is not available in {language} yet.",

	"archive.category": "Topic",
	"archive.tag": "Tag",
	"archive.empty": "No articles here yet.",

	"pagination.label": "More articles",
	"pagination.older": "Older articles",
	"pagination.latest": "Back to the latest",

	"search.title": "Search the blog",
	"search.label": "Search articles",
	"search.placeholder": "Search articles",
	"search.submit": "Search",
	"search.results": "Results for “{query}”",
	"search.empty": "Nothing matched “{query}”. Try another word, or browse a topic.",

	"notFound.title": "Page not found",
	"notFound.description": "The page you're looking for doesn't exist or has moved.",
	"notFound.back": "Go to the blog",

	"cta.build-resume.title": "Your next resume is a few minutes away.",
	"cta.build-resume.description":
		"Start from scratch or import the one you have. The free plan is yours for as long as you need it.",
	"cta.build-resume.action": "Build your resume",
	"cta.ats-checker.title": "Can software read your resume?",
	"cta.ats-checker.description":
		"Upload a PDF and see the text an applicant tracking system extracts, and how to fix what's missing. Free, no account needed.",
	"cta.ats-checker.action": "Check your resume",
	"cta.templates.title": "Start from a template that reads well.",
	"cta.templates.description": "Browse free resume templates and sample PDFs, then make one yours.",
	"cta.templates.action": "Browse templates",

	"footer.tagline": "The resume builder that stays with you until the offer.",
	"footer.product": "Product",
	"footer.features": "Features",
	"footer.templates": "Templates",
	"footer.atsChecker": "ATS checker",
	"footer.pricing": "Pricing",
	"footer.blog": "Blog",
	"footer.rss": "RSS feed",
	"footer.follow": "Follow Rezumi",
	"footer.legal": "Legal",
	"footer.privacy": "Privacy policy",
	"footer.terms": "Terms of service",
	"footer.contact": "Contact",

	"language.en": "English",
	"language.id": "Bahasa Indonesia",
} as const;

export type MessageKey = keyof typeof en;

export const messageKeys = Object.keys(en) as MessageKey[];

const id: Record<MessageKey, string> = {
	"meta.homeTitle": "Tips CV, cari kerja, dan wawancara",
	"meta.homeDescription":
		"Panduan praktis seputar CV, lamaran, dan wawancara kerja dari tim Rezumi, pembuat CV dengan pemeriksa ATS dan penyesuaian berbasis AI.",
	"meta.searchTitle": "Cari",
	"meta.categoryDescription": "Artikel tentang {topic} di Blog Rezumi.",
	"meta.tagDescription": "Artikel dengan tag {tag} di Blog Rezumi.",

	"nav.skip": "Lewati ke konten",
	"nav.home": "Beranda Blog Rezumi",
	"nav.topics": "Topik",
	"nav.search": "Cari",
	"nav.language": "Bahasa",

	"home.eyebrow": "Blog Rezumi",
	"home.title": "Saran untuk pencarian kerja yang sedang Anda jalani.",
	"home.description": "Panduan praktis seputar CV, lamaran, dan wawancara kerja, dari tim yang membangun Rezumi.",
	"home.latest": "Artikel terbaru",
	"home.empty": "Belum ada artikel. Yang pertama segera hadir.",

	"post.readingTime": "{minutes} menit baca",
	"post.updated": "Diperbarui {date}",
	"post.by": "Oleh {names}",
	"post.onThisPage": "Di halaman ini",
	"post.tags": "Tag",
	"post.keepReading": "Baca juga",
	"post.translated": "Artikel ini belum tersedia dalam {language}.",

	"archive.category": "Topik",
	"archive.tag": "Tag",
	"archive.empty": "Belum ada artikel di sini.",

	"pagination.label": "Artikel lainnya",
	"pagination.older": "Artikel sebelumnya",
	"pagination.latest": "Kembali ke yang terbaru",

	"search.title": "Cari di blog",
	"search.label": "Cari artikel",
	"search.placeholder": "Cari artikel",
	"search.submit": "Cari",
	"search.results": "Hasil untuk “{query}”",
	"search.empty": "Tidak ada yang cocok dengan “{query}”. Coba kata lain, atau jelajahi topik.",

	"notFound.title": "Halaman tidak ditemukan",
	"notFound.description": "Halaman yang Anda cari tidak ada atau sudah dipindahkan.",
	"notFound.back": "Buka blog",

	"cta.build-resume.title": "CV Anda berikutnya hanya beberapa menit lagi.",
	"cta.build-resume.description":
		"Mulai dari nol atau impor CV yang sudah ada. Paket gratis bisa Anda pakai selama dibutuhkan.",
	"cta.build-resume.action": "Buat CV Anda",
	"cta.ats-checker.title": "Apakah sistem rekrutmen bisa membaca CV Anda?",
	"cta.ats-checker.description":
		"Unggah PDF dan lihat teks yang diambil oleh sistem pelacak pelamar, beserta cara memperbaiki yang hilang. Gratis, tanpa akun.",
	"cta.ats-checker.action": "Periksa CV Anda",
	"cta.templates.title": "Mulai dari template yang mudah dibaca.",
	"cta.templates.description": "Telusuri template CV gratis dan contoh PDF-nya, lalu jadikan milik Anda.",
	"cta.templates.action": "Lihat template",

	"footer.tagline": "Pembuat CV yang menemani Anda sampai tawaran kerja datang.",
	"footer.product": "Produk",
	"footer.features": "Fitur",
	"footer.templates": "Template",
	"footer.atsChecker": "Pemeriksa ATS",
	"footer.pricing": "Harga",
	"footer.blog": "Blog",
	"footer.rss": "Feed RSS",
	"footer.follow": "Ikuti Rezumi",
	"footer.legal": "Hukum",
	"footer.privacy": "Kebijakan privasi",
	"footer.terms": "Syarat dan Ketentuan",
	"footer.contact": "Kontak",

	"language.en": "English",
	"language.id": "Bahasa Indonesia",
};

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, id };

/** The message for `key` in `locale`, with `{name}` placeholders replaced from `values`. */
export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}): string {
	return catalogs[locale][key].replaceAll(/\{(\w+)\}/g, (match, name: string) =>
		name in values ? String(values[name]) : match,
	);
}

export type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

/** A `translate` bound to one locale, for templates: `const t = getTranslator(locale)`. */
export function getTranslator(locale: Locale): Translator {
	return (key, values) => translate(locale, key, values);
}
