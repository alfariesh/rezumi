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

type NoticeRowProps = { label: string; value: string };

// One line per detail, "Label: value", so the plain-text version reads as well as the HTML one.
function NoticeRow({ label, value }: NoticeRowProps) {
	return (
		<Text className="m-0 mt-2">
			<span className="text-zinc-400">{label}:</span> {value}
		</Text>
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
 * A plain billing message: an alert or the daily summary for the owner, or a plan ending soon or a QRIS pass receipt
 * for a customer. Text first, so the plain-text version reads as well as the HTML one; no countdowns or urgency.
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
									<NoticeRow key={row.label} label={row.label} value={row.value} />
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
