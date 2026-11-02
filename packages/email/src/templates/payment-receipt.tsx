import { PaymentReceiptEmail } from "./billing";

export default Object.assign(PaymentReceiptEmail, {
	PreviewProps: {
		seller: {
			name: "Nama Penjual",
			brand: "Rezumi",
			supportEmail: "hi@rezumi.app",
			mailingAddress: "Alamat penjual",
		},
		orderId: "RZ-0197f326-973a-743c-b0a9-77cfc3c95d53",
		paidAt: "2 November 2026, 14.05 WIB",
		planName: "Pro AI",
		validFrom: "2 November 2026, 14.05 WIB",
		validUntil: "2 Desember 2026, 14.05 WIB",
		amount: "Rp79.000",
		method: "QRIS",
		credits: 100,
		durationDays: 30,
		billingUrl: "https://rezumi.app/dashboard/settings/billing",
	} satisfies Parameters<typeof PaymentReceiptEmail>[0],
});
