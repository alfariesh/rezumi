import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { Segment } from "@heroui-pro/react";
import { Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { webPageImageUrl } from "@rezumi/pdf/web-page";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView } from "@rezumi/portfolio/view";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { pageLocaleOf, usePortfolioOwner, useSourceResume } from "./context";
import { usePortfolioData } from "./store";
import { usePortfolioEditorUi } from "./ui";
// The page's own text, declared for translators; see the module.
import "../page-text";

type Device = "desktop" | "phone";

type PreviewInput = {
	data: PortfolioData;
	resume: ResumeData | null;
	owner: { name: string; username: string };
	/** Which resume buttons the page would show; the preview's links lead nowhere. */
	links: { resume: boolean; resumePdf: boolean };
	/** A work's detail anchor to show open, while that work is being edited. */
	openAnchor?: string | null;
};

let glyphs: Promise<Readonly<Record<string, string>>> | undefined;

/** The page a visitor gets, drawn by the server's renderer from the draft, as an inert document. */
export async function renderPortfolioPreview({
	data,
	resume,
	owner,
	links,
	openAnchor,
}: PreviewInput): Promise<string> {
	const origin = window.location.origin;
	const locale = pageLocaleOf(data, resume);
	const messages = portfolioMessages(locale);
	const view = buildPortfolioView({
		portfolio: { data },
		resume: resume ? { data: resume } : null,
		owner,
		// Plans arrive in Phase 07; until then every portfolio shows the credit.
		entitlements: { hidePortfolioCredit: false },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `${origin}/${key}`,
		links: { resume: links.resume ? "#" : null, resumePdf: links.resumePdf ? "#" : null },
	});
	const names = portfolioIconNames(view);
	let icons: Record<string, string> = {};
	if (names.length) {
		glyphs ??= import("@rezumi/pdf/icon-glyphs").then(({ loadIconGlyphs }) => loadIconGlyphs("standard"));
		const loaded = await glyphs.catch(() => ({}) as Record<string, string>);
		icons = Object.fromEntries(names.flatMap((name) => (loaded[name] ? [[name, loaded[name]]] : [])));
	}
	const page = renderPortfolioPage({
		view,
		messages,
		icons,
		imageUrl: webPageImageUrl(origin),
		year: new Date().getFullYear(),
		creditUrl: origin,
	});
	const html = renderPortfolioDocument({ page });
	// The page opens a detail by its address (`:target`); an inert preview has no address to change, so the detail of
	// the work being edited is shown by a rule instead. Anchors are `work-<slug>`, letters, digits and dashes only.
	if (!openAnchor || !/^work-[\da-z-]+$/.test(openAnchor)) return html;
	return html.replace("</head>", `<style>#${openAnchor}{display:block}</style></head>`);
}

type PortfolioPreviewProps = {
	/** Phones show the preview full screen, so the size switch is left out there. */
	showDeviceSwitch?: boolean;
};

/**
 * The editor's canvas: the portfolio as visitors see it, at a computer's width or a phone's. It follows the draft, so
 * every change shows here before it's saved, and nothing on it runs or calls out (`02-teknis.md` 5.4).
 */
export default function PortfolioPreview({ showDeviceSwitch = true }: PortfolioPreviewProps) {
	const data = usePortfolioData();
	const owner = usePortfolioOwner();
	const source = useSourceResume();
	const [device, setDevice] = useState<Device>("desktop");
	const [document, setDocument] = useState<string>();
	const [debouncedData] = useDebounceValue(data, 250);
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const openWork = debouncedData.works.items.find((work) => work.id === openWorkId && !work.hidden);
	const openAnchor = openWork ? `work-${openWork.slug}` : null;
	const frame = useRef<HTMLIFrameElement>(null);
	// Where the reader was, so a redrawn preview opens at the same place instead of the top.
	const scroll = useRef({ page: 0, detail: 0, anchor: null as string | null });

	const resume = source.resume;
	const showResume = Boolean(resume?.isPublic);
	const showPdf = showResume && resume?.showDownloadButtons !== false && !resume?.hasPassword;

	useEffect(() => {
		if (source.isLoading) return;
		let current = true;
		void renderPortfolioPreview({
			data: debouncedData,
			resume: source.data,
			owner: { name: owner.name, username: owner.username },
			links: { resume: showResume, resumePdf: showPdf },
			openAnchor,
		})
			.then((html) => {
				if (!current) return;
				const view = frame.current?.contentWindow;
				const detail = scroll.current.anchor ? view?.document.getElementById(scroll.current.anchor) : null;
				scroll.current = {
					page: view?.scrollY ?? scroll.current.page,
					// Another work opened starts at its top.
					detail: scroll.current.anchor === openAnchor ? (detail?.scrollTop ?? 0) : 0,
					anchor: openAnchor,
				};
				setDocument(html);
			})
			.catch((error: unknown) => console.error("Portfolio preview failed", error));
		return () => {
			current = false;
		};
	}, [debouncedData, source.data, source.isLoading, owner.name, owner.username, showResume, showPdf, openAnchor]);

	const restoreScroll = () => {
		const view = frame.current?.contentWindow;
		if (!view) return;
		const { page, detail, anchor } = scroll.current;
		view.scrollTo(0, page);
		const opened = anchor ? view.document.getElementById(anchor) : null;
		if (opened) opened.scrollTop = detail;
	};

	return (
		<div className="flex h-full min-h-0 flex-col items-center gap-3 bg-background p-3 md:p-4">
			{showDeviceSwitch && (
				<Segment
					aria-label={t`Preview size`}
					selectedKey={device}
					onSelectionChange={(key) => setDevice(key as Device)}
					className="shrink-0"
				>
					<Segment.Item id="desktop">
						<Icon name="desktop" size={16} variant={device === "desktop" ? "duotone" : "stroke"} />
						<Trans>Computer</Trans>
					</Segment.Item>
					<Segment.Item id="phone">
						<Icon name="device-mobile" size={16} variant={device === "phone" ? "duotone" : "stroke"} />
						<Trans>Phone</Trans>
					</Segment.Item>
				</Segment>
			)}
			<div
				className={cn(
					"relative min-h-0 w-full flex-1 overflow-hidden rounded-xl bg-surface transition-[max-width] duration-standard ease-enter after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-black/5 after:ring-inset dark:after:ring-white/10",
					device === "phone" && showDeviceSwitch ? "max-w-[390px]" : "max-w-full",
				)}
			>
				{document ? (
					// Sandboxed without scripts: links open in a new tab and nothing on the page runs. It keeps the app's origin
					// (scripts stay off, so that grants nothing) because uploads are served `Cross-Origin-Resource-Policy:
					// same-site`, which an opaque origin can't load.
					<iframe
						ref={frame}
						title={t`Portfolio preview`}
						srcDoc={document}
						onLoad={restoreScroll}
						sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
						className="size-full border-0"
					/>
				) : (
					<div className="grid size-full place-items-center">
						<Spinner size="md" color="current" />
					</div>
				)}
			</div>
		</div>
	);
}
