import * as React from "react";
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	pixelBasedPreset,
	Preview,
	Section,
	Tailwind,
	Text,
} from "react-email";

// ponytail: server dev consumes this source through tsx, which emits React.createElement here.
void React;

const logoUrl = "https://rezumi.app/icon/dark.svg";

export type PaymentReceiptEmailProps = {
	seller: { name: string; brand: string; supportEmail: string; mailingAddress: string };
	/** The Midtrans order number, RZ-…. */
	orderId: string;
	/** Already formatted in the account's time zone, e.g. "2 November 2026, 14.05 WIB". */
	paidAt: string;
	planName: string;
	/** When the pass starts and ends, formatted. */
	validFrom: string;
	validUntil: string;
	/** Formatted Rupiah, e.g. "Rp79.000". */
	amount: string;
	method: string;
	/** Rezumi AI credits that came with it; 0 hides the line. */
	credits: number;
	/** How long one pass lasts. */
	durationDays: number;
	billingUrl: string;
};

type ReceiptRowProps = { label: string; value: string };

// One line per detail, "Label: value", so the plain-text version reads as well as the HTML one.
function ReceiptRow({ label, value }: ReceiptRowProps) {
	return (
		<Text className="m-0 mt-2">
			<span className="text-zinc-400">{label}:</span> {value}
		</Text>
	);
}

/** "Bukti Pembayaran": proof of payment for a pass. The seller isn't VAT-registered, so it is not a tax invoice. */
export function PaymentReceiptEmail(props: PaymentReceiptEmailProps) {
	return (
		<Html lang="id">
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Head />
				<Body className="m-0 bg-zinc-950 p-0 font-sans text-sm text-zinc-50">
					<Preview>{`Bukti pembayaran ${props.planName} — ${props.amount}`}</Preview>
					<Container className="mx-auto w-full max-w-xl bg-zinc-900 p-6 text-zinc-50">
						<Section>
							<Img src={logoUrl} alt={props.seller.brand} width="48" height="48" className="block" />
						</Section>

						<Section className="mt-6">
							<Heading className="text-2xl font-medium tracking-tight">Bukti Pembayaran</Heading>
							<Text>Terima kasih. Pembayaranmu sudah kami terima dan paketmu sudah aktif.</Text>
						</Section>

						<Section className="mt-4">
							<ReceiptRow label="Nomor pesanan" value={props.orderId} />
							<ReceiptRow label="Tanggal bayar" value={props.paidAt} />
							<ReceiptRow label="Paket" value={props.planName} />
							<ReceiptRow label="Berlaku" value={`${props.validFrom} – ${props.validUntil}`} />
							{props.credits > 0 ? (
								<ReceiptRow label="Kredit Rezumi AI" value={`${props.credits} kredit, berlaku sampai akhir paket`} />
							) : null}
							<ReceiptRow label="Metode" value={props.method} />
							<ReceiptRow label="Jumlah dibayar" value={props.amount} />
						</Section>

						<Text className="mt-4 text-zinc-400">
							Akses berlaku {props.durationDays} hari dan tidak diperpanjang otomatis. Bukti pembayaran ini bukan faktur
							pajak.
						</Text>

						<Button
							target="_blank"
							href={props.billingUrl}
							className="mt-4 box-border inline-block bg-zinc-200 px-6 py-3 text-center text-zinc-900 no-underline"
						>
							Lihat paket
						</Button>

						<Hr className="my-8 border-zinc-700" />

						<Text className="text-xs leading-5 text-zinc-400">
							Penjual: {props.seller.name} ({props.seller.brand})
							<br />
							{props.seller.mailingAddress}
							<br />
							Pertanyaan atau pengembalian dana: {props.seller.supportEmail}
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

export type BillingNoticeEmailProps = {
	lang: "id" | "en";
	/** The inbox preview line. */
	preview: string;
	heading: string;
	paragraphs: readonly string[];
	/** "Label: value" lines under the text. */
	rows?: readonly { label: string; value: string }[];
	action?: { label: string; url: string };
	/** Small print at the bottom. */
	footer?: string;
};

/**
 * A plain billing message: an alert or the daily summary for the owner, or a pass ending soon for a customer. Text
 * first, so the plain-text version reads as well as the HTML one; no countdowns or urgency.
 */
export function BillingNoticeEmail(props: BillingNoticeEmailProps) {
	return (
		<Html lang={props.lang}>
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Head />
				<Body className="m-0 bg-zinc-950 p-0 font-sans text-sm text-zinc-50">
					<Preview>{props.preview}</Preview>
					<Container className="mx-auto w-full max-w-xl bg-zinc-900 p-6 text-zinc-50">
						<Section>
							<Img src={logoUrl} alt="Rezumi" width="48" height="48" className="block" />
						</Section>

						<Section className="mt-6">
							<Heading className="text-2xl font-medium tracking-tight">{props.heading}</Heading>
							{props.paragraphs.map((paragraph) => (
								<Text key={paragraph}>{paragraph}</Text>
							))}
						</Section>

						{props.rows?.length ? (
							<Section className="mt-2">
								{props.rows.map((row) => (
									<ReceiptRow key={row.label} label={row.label} value={row.value} />
								))}
							</Section>
						) : null}

						{props.action ? (
							<Button
								target="_blank"
								href={props.action.url}
								className="mt-6 box-border inline-block bg-zinc-200 px-6 py-3 text-center text-zinc-900 no-underline"
							>
								{props.action.label}
							</Button>
						) : null}

						{props.footer ? (
							<>
								<Hr className="my-8 border-zinc-700" />
								<Text className="text-xs leading-5 text-zinc-400">{props.footer}</Text>
							</>
						) : null}
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
