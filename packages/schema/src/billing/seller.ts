/** Public seller details shared by receipts and support. Null means owner confirmation is still required. */
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
	resolutionDeadline: null,
	minimumAge: 18,
	identityConfirmed: true,
	supportEmailConfirmed: false,
	vatRegistered: false,
} as const;

/** Indonesian legal text governs; English translations remain available from each legal page. */
export const LEGAL_URLS = {
	terms: "https://docs.rezumi.app/legal/syarat-dan-ketentuan",
	privacy: "https://docs.rezumi.app/legal/kebijakan-privasi",
	refund: "https://docs.rezumi.app/legal/kebijakan-pengembalian-dana",
	contact: "https://docs.rezumi.app/legal/kontak",
	license: "https://docs.rezumi.app/legal/license",
} as const;
