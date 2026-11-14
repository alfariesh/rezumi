import type { CSSProperties } from "react";
import { HoloCard } from "@heroui-pro/react";
import { Button, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { saveFile } from "../save-file";
import { businessCardAddress, businessCardPrintSheet, cardFileName } from "./qr";

/** The PNG's width and height: sharp when printed large or placed in a design. */
const PNG_SIZE = 1024;

/** The on-screen card: the printed card's 55 × 85 mm turned upright, narrowing on small phones. */
const CARD_SIZE = {
	"--holo-card-width": "min(240px, calc(100vw - 8rem))",
	"--holo-card-height": "calc(var(--holo-card-width) * 85 / 55)",
	"--holo-card-radius": "18px",
	"--holo-card-bleed": "24px",
} as CSSProperties;

/** Blue into purple, dark enough that white text reads on every part of it. */
const CARD_GRADIENT =
	"linear-gradient(155deg, rgb(37 99 235) 0%, rgb(67 56 202) 45%, rgb(109 40 217) 80%, rgb(88 28 135) 100%)";

type BusinessCardIdentity = {
	name: string;
	headline: string;
	username: string;
	/** The portfolio's address (`usePortfolioPageUrl`); the QR adds `utm_source=qr` to it. */
	pageUrl: string;
};

type BusinessCardButtonProps = BusinessCardIdentity & { className?: string };

/** "Business card": opens the card with its QR code, downloads, printing, and the full-screen code. */
export function BusinessCardButton({ className, ...identity }: BusinessCardButtonProps) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button variant="secondary" className={cn("w-full", className)} onPress={() => setOpen(true)}>
				<Icon name="qr-code" size={18} />
				<Trans>Business card</Trans>
			</Button>
			{open && <BusinessCardDialog {...identity} onClose={() => setOpen(false)} />}
		</>
	);
}

type BusinessCardDialogProps = BusinessCardIdentity & { onClose: () => void };

/**
 * The portfolio as a business card (Phase 13 3.2): a preview with the QR code, downloads of the code as PNG and SVG,
 * a printable sheet of ten cards, and the code full screen for showing from a phone. The code is drawn here in the
 * app; public pages never draw one.
 */
export function BusinessCardDialog({ name, headline, username, pageUrl, onClose }: BusinessCardDialogProps) {
	const id = useId();
	const { i18n } = useLingui();
	const { qr, shown } = businessCardAddress(pageUrl);
	const svgHolder = useRef<HTMLDivElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const [fullScreen, setFullScreen] = useState(false);
	const displayName = name.trim() || username;
	const caption = t`Scan to see my portfolio`;
	const qrTitle = t`QR code for ${shown}`;

	const svgMarkup = () => {
		const svg = svgHolder.current?.querySelector("svg");
		if (!svg) return null;
		const copy = svg.cloneNode(true) as SVGSVGElement;
		copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
		// The card shows the code on a see-through tile; the file and the printed sheet get it on solid white.
		for (const path of copy.querySelectorAll('path[fill="transparent"]')) path.setAttribute("fill", "#FFFFFF");
		return new XMLSerializer().serializeToString(copy);
	};

	const downloadSvg = () => {
		const markup = svgMarkup();
		if (!markup) return;
		saveFile(new Blob([markup], { type: "image/svg+xml" }), cardFileName(username, "svg"));
	};

	const downloadPng = () => {
		canvas.current?.toBlob((blob) => {
			if (blob) saveFile(blob, cardFileName(username, "png"));
			else toast.add({ type: "error", description: t`The picture couldn't be made. Try the SVG instead.` });
		}, "image/png");
	};

	const print = () => {
		const markup = svgMarkup();
		if (!markup) return;
		const html = businessCardPrintSheet({
			name: displayName,
			headline: headline.trim(),
			qrSvg: markup,
			address: shown,
			caption,
			title: t`Business card`,
			lang: i18n.locale,
		});
		// A frame of its own, so only the sheet prints, not the app around the dialog.
		const frame = document.createElement("iframe");
		frame.title = t`Business cards to print`;
		frame.setAttribute("aria-hidden", "true");
		frame.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";
		document.body.append(frame);
		const remove = () => setTimeout(() => frame.remove(), 1000);
		frame.addEventListener("load", () => {
			const view = frame.contentWindow;
			if (!view) return remove();
			view.addEventListener("afterprint", remove, { once: true });
			view.focus();
			view.print();
			// Browsers without `afterprint` (some phones) still get the frame removed.
			setTimeout(remove, 60_000);
		});
		frame.srcdoc = html;
	};

	return (
		<>
			<Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
				<Modal.Container size="md">
					<Modal.Dialog aria-labelledby={`${id}-title`}>
						<Modal.CloseTrigger aria-label={t`Close`} />
						<Modal.Header>
							<Modal.Heading id={`${id}-title`}>
								<Trans>Business card</Trans>
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body className="grid gap-4">
							{/*
							 * The card on screen: a holographic card that tilts under the pointer. The code sits on a white tile in a
							 * content layer, which stacks above the glare, so it always reads. Printing and downloads stay plain.
							 */}
							<div className="flex justify-center">
								<HoloCard style={CARD_SIZE} gradient={CARD_GRADIENT}>
									<HoloCard.Rotator>
										<HoloCard.Frame>
											<HoloCard.Surface>
												<HoloCard.Inset />
												<HoloCard.Pattern />
												<HoloCard.Content className="flex-col items-center justify-between p-6 text-center">
													<div className="grid w-full gap-1">
														<p className="line-clamp-2 text-lg font-semibold wrap-anywhere text-white">{displayName}</p>
														{headline.trim() && (
															<p className="line-clamp-2 text-body-xs wrap-anywhere text-white/70">{headline.trim()}</p>
														)}
													</div>
													{/* The address the code holds, for tests and anyone inspecting the page. */}
													<div
														ref={svgHolder}
														data-qr-value={qr}
														className="overflow-clip rounded-xl bg-white/80 shadow-lg backdrop-blur-sm"
													>
														<QRCodeSVG
															value={qr}
															size={132}
															bgColor="transparent"
															level="M"
															marginSize={3}
															title={qrTitle}
															style={{ width: "min(132px, calc(var(--holo-card-width) * 0.55))", height: "auto" }}
														/>
													</div>
													<div className="grid w-full gap-0.5">
														<p className="text-[10px] font-medium text-white/60">{caption}</p>
														<p dir="ltr" className="font-mono text-body-xs wrap-anywhere text-white/90">
															{shown}
														</p>
													</div>
												</HoloCard.Content>
												<HoloCard.Shine />
											</HoloCard.Surface>
										</HoloCard.Frame>
									</HoloCard.Rotator>
								</HoloCard>
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button variant="secondary" className="w-full" onPress={downloadPng}>
									<Icon name="download-simple" size={18} />
									<Trans>Download QR (PNG)</Trans>
								</Button>
								<Button variant="secondary" className="w-full" onPress={downloadSvg}>
									<Icon name="download-simple" size={18} />
									<Trans>Download QR (SVG)</Trans>
								</Button>
								<Button variant="secondary" className="w-full" onPress={print}>
									<Icon name="printer" size={18} />
									<Trans>Print cards</Trans>
								</Button>
								<Button variant="secondary" className="w-full" onPress={() => setFullScreen(true)}>
									<Icon name="arrows-out-simple" size={18} />
									<Trans>Show full screen</Trans>
								</Button>
							</div>
							<p className="text-body-xs text-muted">
								<Trans>Print cards makes an A4 sheet of 10 cards (85 × 55 mm) with lines to cut along.</Trans>
							</p>
							{/* Drawn once at full size for the PNG; never shown. */}
							<QRCodeCanvas
								ref={canvas}
								value={qr}
								size={PNG_SIZE}
								level="M"
								marginSize={4}
								className="hidden"
								aria-hidden
							/>
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
			{fullScreen && (
				<FullScreenCode value={qr} name={displayName} title={qrTitle} onClose={() => setFullScreen(false)} />
			)}
		</>
	);
}

type FullScreenCodeProps = { value: string; name: string; title: string; onClose: () => void };

/** The code as large as the screen allows, with the name, for showing from a phone; the screen stays on meanwhile. */
function FullScreenCode({ value, name, title, onClose }: FullScreenCodeProps) {
	const id = useId();

	// Phones dim and lock while someone scans; ask them not to, where the browser can (not everywhere can).
	useEffect(() => {
		let lock: WakeLockSentinel | null = null;
		let released = false;
		void navigator.wakeLock
			?.request("screen")
			.then((sentinel) => {
				if (released) void sentinel.release().catch(() => {});
				else lock = sentinel;
			})
			.catch(() => {});
		return () => {
			released = true;
			void lock?.release().catch(() => {});
		};
	}, []);

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
			<Modal.Container size="full">
				<Modal.Dialog aria-labelledby={`${id}-name`} className="bg-white text-neutral-900">
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Body className="grid h-full place-items-center content-center gap-6 p-6">
						<QRCodeSVG
							value={value}
							size={512}
							level="M"
							marginSize={4}
							title={title}
							style={{ width: "min(80vmin, 100%)", height: "auto" }}
						/>
						<p id={`${id}-name`} className="text-center text-2xl font-semibold wrap-anywhere text-neutral-900">
							{name}
						</p>
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
