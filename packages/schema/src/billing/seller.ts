/**
 * Who runs Rezumi, for support and the legal pages. Null means owner confirmation is still required. Card subscriptions
 * are sold by Dodo Payments as the merchant of record: it charges, invoices, and handles sales tax. QRIS passes (Indonesia)
 * are sold by the owner directly, an individual who isn't VAT-registered; Sumopod only processes the QRIS payment.
 */
export const BILLING_SELLER = {
	name: "Salman Alfariesh",
	brand: "Rezumi",
	supportEmail: "hi@rezumi.app",
	mailingAddress:
		"Apartement Centerpoint, Tower A, 1211, Jl. Ahmad Yani No.kav20, RT.005/RW.002, Marga Jaya, Kec. Bekasi Sel., Kota Bks, Jawa Barat 17141",
	complaintPhone: "08125800097",
	supportHours: "Senin–Jumat, 09.00–17.00 WIB",
	supportTimezone: "Asia/Jakarta",
	responseDeadline: "3 hari kerja",
	resolutionDeadline: "2 x 24 jam",
	minimumAge: 18,
	identityConfirmed: true,
	supportEmailConfirmed: true,
	/** The reseller and merchant of record of card subscriptions, named at checkout and on invoices. */
	merchantOfRecord: "Dodo Payments, Inc.",
	/** Who processes QRIS payments for passes the owner sells: SumoPod, run by this company. */
	qrisProcessor: "SumoPod (PT Koding Kreasi Indonesia)",
} as const;

/** Indonesian legal text governs; English translations remain available from each legal page. */
export const LEGAL_URLS = {
	terms: "https://docs.rezumi.app/legal/syarat-dan-ketentuan",
	privacy: "https://docs.rezumi.app/legal/kebijakan-privasi",
	refund: "https://docs.rezumi.app/legal/kebijakan-pengembalian-dana",
	contact: "https://docs.rezumi.app/legal/kontak",
	license: "https://docs.rezumi.app/legal/license",
} as const;
