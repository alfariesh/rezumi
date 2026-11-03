import { BillingNoticeEmail } from "./billing";

export default Object.assign(BillingNoticeEmail, {
	PreviewProps: {
		lang: "id",
		preview: "Paket Pro AI-mu berakhir 6 November 2026",
		heading: "Paket Pro AI-mu berakhir 6 November 2026",
		paragraphs: [
			"Akses Pro AI-mu berakhir pada 6 November 2026 pukul 14.05 WIB. Paket ini tidak diperpanjang otomatis, jadi tidak ada tagihan apa pun.",
			"Setelah itu akunmu kembali ke Gratis. Semua CV dan surat tetap bisa dibuka, diedit, dan diunduh sebagai PDF.",
		],
		action: { label: "Lihat paket", url: "https://rezumi.app/dashboard/settings/billing" },
		footer: "Kamu menerima email ini karena membeli paket Rezumi.",
	} satisfies Parameters<typeof BillingNoticeEmail>[0],
});
