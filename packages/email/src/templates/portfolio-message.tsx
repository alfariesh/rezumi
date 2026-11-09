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

export type PortfolioMessageEmailProps = {
	lang: "id" | "en";
	/** How many new messages this email covers. One shows in full; more are only counted. */
	count: number;
	/** The message, when there is exactly one. */
	message?: { name: string; email: string; body: string; service: string | null } | undefined;
	inboxUrl: string;
};

const TEXT = {
	id: {
		oneHeading: "Ada pesan baru di portofoliomu",
		manyHeading: (count: number) => `Ada ${count} pesan baru di portofoliomu`,
		from: "Dari",
		service: "Layanan",
		reply: "Balas email ini untuk membalas pengirimnya.",
		many: "Pesan-pesan ini digabung supaya kotak masukmu tidak penuh. Baca semuanya di dasbor.",
		open: "Buka pesan",
		footer: "Kamu menerima email ini karena form kontak di portofoliomu menyala. Pesan disimpan 90 hari.",
	},
	en: {
		oneHeading: "You have a new message on your portfolio",
		manyHeading: (count: number) => `You have ${count} new messages on your portfolio`,
		from: "From",
		service: "Service",
		reply: "Reply to this email to answer the sender.",
		many: "These are merged so your inbox doesn't fill up. Read them all in your dashboard.",
		open: "Open messages",
		footer: "You get this email because the contact form on your portfolio is on. Messages are kept for 90 days.",
	},
} as const;

/** The subject of the notification. Generic on purpose: nothing a visitor wrote appears in it. */
export function portfolioMessageSubject(lang: PortfolioMessageEmailProps["lang"], count: number): string {
	return count > 1 ? TEXT[lang].manyHeading(count) : TEXT[lang].oneHeading;
}

/** Tells a portfolio's owner about visitors' messages: one in full, several merged into a count. */
export function PortfolioMessageEmail({ lang, count, message, inboxUrl }: PortfolioMessageEmailProps) {
	const text = TEXT[lang];
	const heading = portfolioMessageSubject(lang, count);
	return (
		<Html lang={lang}>
			<Head />
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Body className="bg-white font-sans text-zinc-900">
					<Preview>{heading}</Preview>
					<Container className="mx-auto max-w-[520px] px-6 py-8">
						<Img src={logoUrl} width="32" height="32" alt="Rezumi" />
						<Heading as="h1" className="mt-6 mb-4 text-xl font-semibold">
							{heading}
						</Heading>
						{message ? (
							<Section>
								<Text className="m-0 mt-2">
									<span className="text-zinc-400">{text.from}:</span> {message.name} ({message.email})
								</Text>
								{message.service && (
									<Text className="m-0 mt-2">
										<span className="text-zinc-400">{text.service}:</span> {message.service}
									</Text>
								)}
								<Text className="mt-4 whitespace-pre-wrap">{message.body}</Text>
								<Text className="text-zinc-500">{text.reply}</Text>
							</Section>
						) : (
							<Text>{text.many}</Text>
						)}
						<Button href={inboxUrl} className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white">
							{text.open}
						</Button>
						<Hr className="my-6 border-zinc-200" />
						<Text className="m-0 text-xs text-zinc-500">{text.footer}</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

export default Object.assign(PortfolioMessageEmail, {
	PreviewProps: {
		lang: "id",
		count: 1,
		message: {
			name: "Budi Santoso",
			email: "budi@example.test",
			body: "Halo, saya tertarik dengan layanan desain Anda.\nBisa minta penawaran?",
			service: "Desain produk",
		},
		inboxUrl: "https://rezumi.app/dashboard/portfolio",
	} satisfies PortfolioMessageEmailProps,
});
