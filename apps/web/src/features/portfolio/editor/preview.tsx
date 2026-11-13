import type { PortfolioPageKind } from "@rezumi/portfolio";
import type { PortfolioSource } from "@rezumi/portfolio/view";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import { Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { portfolioIconNames, renderPortfolioPage } from "@rezumi/portfolio";
import { renderPortfolioDocument } from "@rezumi/portfolio/document";
import { PREVIEW_STILL_CSS, replayIntroEffect } from "@rezumi/portfolio/effects";
import { portfolioMessages, portfolioViewMessages } from "@rezumi/portfolio/messages";
import { buildPortfolioView, portfolioSourceResume } from "@rezumi/portfolio/view";
import { themeEffect } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { pageLocaleOf, usePortfolioOwner, usePortfolioSource } from "./context";
import { ownFileUrl, useOwnOrigins, withOwnPicture } from "./pictures";
import { usePortfolioData, usePortfolioEditorStore } from "./store";
import { usePortfolioEditorUi } from "./ui";
import { useResumeLinks } from "./use-view";
import { usePlanFeature } from "@/features/billing/plan";
// The page's own text, declared for translators; see the module.
import "../page-text";

type PreviewInput = {
	data: PortfolioData;
	/** The source's content: the source resume, or the Profile as resume data. */
	source: PortfolioSource | null;
	owner: { name: string; username: string };
	/** Which resume buttons the page would show; the preview's links lead nowhere. */
	links: { resume: boolean; resumePdf: boolean };
	/** The work being edited: its detail shows open, even while the Work section is hidden. */
	openWorkId?: string | null;
	/** Where this app's uploads are served from: the only pictures the page shows (`./pictures.ts`). */
	origins: readonly string[];
	/** Whether the plan lets the page leave the badge out; the page itself decides from the plan on every view. */
	canHideCredit: boolean;
};

let glyphs: Promise<Readonly<Record<string, string>>> | undefined;

/** The icon set's glyphs, loaded once; a failed load is tried again on the next draw instead of being kept. */
function loadGlyphs(): Promise<Readonly<Record<string, string>>> {
	glyphs ??= import("@rezumi/pdf/icon-glyphs").then(({ loadIconGlyphs }) => loadIconGlyphs("standard"));
	return glyphs.catch(() => {
		glyphs = undefined;
		return {};
	});
}

/** The page a visitor gets, drawn by the server's renderer from the draft, as an inert document. */
export async function renderPortfolioPreview({
	data,
	source,
	owner,
	links,
	openWorkId,
	origins,
	canHideCredit,
}: PreviewInput): Promise<string> {
	const origin = window.location.origin;
	const locale = pageLocaleOf(data, portfolioSourceResume(source));
	const messages = portfolioMessages(locale);
	const view = buildPortfolioView({
		portfolio: { data },
		// A resume photo kept on another site shows no photo, as on the page.
		resume: source ? { ...source, data: withOwnPicture(source.data, origins) } : null,
		owner,
		entitlements: { hidePortfolioCredit: canHideCredit },
		messages: portfolioViewMessages(messages),
		fileUrl: (key) => `${origin}/${key}`,
		links: { resume: links.resume ? "#" : null, resumePdf: links.resumePdf ? "#" : null, vcard: "#contact" },
		openWorkId: openWorkId ?? null,
	});
	// The work being edited shows as its own page (Phase 13 3.1), when the page has one for it.
	const page: PortfolioPageKind =
		openWorkId && view.works.some((work) => work.id === openWorkId)
			? { kind: "work", workId: openWorkId }
			: { kind: "home" };
	const names = portfolioIconNames(view, page);
	let icons: Record<string, string> = {};
	if (names.length) {
		const loaded = await loadGlyphs();
		icons = Object.fromEntries(names.flatMap((name) => (loaded[name] ? [[name, loaded[name]]] : [])));
	}
	const html = renderPortfolioPage({
		page,
		view,
		messages,
		icons,
		// Pictures and the PDF card's file, by the published page's rule (`portfolioFileAddress`).
		imageUrl: (source) => ownFileUrl(source, origins),
		year: new Date().getFullYear(),
		creditUrl: origin,
	});
	// The intro effect holds still while the draft is edited; "Replay" plays it from the editor (`replayIntroEffect`).
	return renderPortfolioDocument({ page: html, inert: true }).replace("</head>", `${PREVIEW_STILL_CSS}</head>`);
}

type PortfolioPreviewProps = {
	/** Phones show the preview full screen, so the width the bar picks doesn't apply there. */
	showDeviceSwitch?: boolean;
};

/**
 * The editor's canvas: the portfolio as visitors see it, at a computer's width or a phone's. It follows the draft, so
 * every change shows here before it's saved, and nothing on it runs or calls out (`02-teknis.md` 5.4).
 */
export default function PortfolioPreview({ showDeviceSwitch = true }: PortfolioPreviewProps) {
	const data = usePortfolioData();
	const owner = usePortfolioOwner();
	const source = usePortfolioSource();
	const device = usePortfolioEditorUi((state) => state.previewDevice);
	const [document, setDocument] = useState<string>();
	// The last draw failed: the preview says so (over the previous one, when there is one) and offers to try again.
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const [debouncedData] = useDebounceValue(data, 250);
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const openWork = debouncedData.works.items.find((work) => work.id === openWorkId && !work.hidden);
	const openWorkKey = openWork?.id ?? null;
	// Which page the preview shows (the home page, or the open work's), so a redraw keeps the reader's place on it.
	const shownPage = openWorkKey ?? "home";
	const origins = useOwnOrigins();
	const canHideCredit = usePlanFeature("hidePortfolioCredit");
	const frame = useRef<HTMLIFrameElement>(null);
	const effectReplay = usePortfolioEditorUi((state) => state.effectReplay);
	const replayEffect = usePortfolioEditorUi((state) => state.replayEffect);
	// Replays asked for before this preview was shown (in another tab, or on the phone's panel) have played already.
	const replayBeforeShown = useRef(effectReplay);
	// A replay asked for before the redrawn preview has loaded plays once it has.
	const pendingReplay = useRef(0);
	// A work's page has no intro, so nothing to replay while one is open.
	const hasEffect = themeEffect(data.theme, data.hero.effect.id) !== "none" && shownPage === "home";
	// Where the reader was, so a redrawn preview opens at the same place instead of the top.
	const scroll = useRef({ top: 0, page: "home" });

	const { resume: showResume, resumePdf: showPdf } = useResumeLinks();

	useEffect(() => {
		if (source.isLoading) return;
		let current = true;
		void renderPortfolioPreview({
			data: debouncedData,
			source: source.data && source.from ? { data: source.data, from: source.from } : null,
			owner: { name: owner.name, username: owner.username },
			links: { resume: showResume, resumePdf: showPdf },
			openWorkId: openWorkKey,
			origins,
			canHideCredit,
		})
			.then((html) => {
				if (!current) return;
				const view = frame.current?.contentWindow;
				// Another page (a work opened or closed) starts at its top.
				scroll.current = {
					top: scroll.current.page === shownPage ? (view?.scrollY ?? scroll.current.top) : 0,
					page: shownPage,
				};
				setDocument(html);
				setFailed(false);
			})
			.catch((error: unknown) => {
				if (!current) return;
				console.error("Portfolio preview failed", error);
				setFailed(true);
			});
		return () => {
			current = false;
		};
	}, [
		debouncedData,
		source.data,
		source.from,
		source.isLoading,
		owner.name,
		owner.username,
		showResume,
		showPdf,
		openWorkKey,
		shownPage,
		origins,
		canHideCredit,
		attempt,
	]);

	// Plays the intro effect in the preview's document from here: the preview itself runs no script (`02-teknis.md` 5.4).
	const playEffect = () => {
		const doc = frame.current?.contentDocument;
		if (!doc?.body) return false;
		frame.current?.contentWindow?.scrollTo(0, 0);
		replayIntroEffect(doc);
		return true;
	};

	useEffect(() => {
		if (effectReplay === replayBeforeShown.current) return;
		pendingReplay.current = effectReplay;
		// A newly chosen effect plays once the redrawn preview loads; "Replay" on the current one plays at once.
		const timer = window.setTimeout(() => {
			if (pendingReplay.current === effectReplay && playEffect()) pendingReplay.current = 0;
		}, 400);
		return () => window.clearTimeout(timer);
	}, [effectReplay]);

	// A section of the home page a work page's link asked for ("All work"), to scroll to once home is drawn.
	const pendingAnchor = useRef<string | null>(null);

	/**
	 * The preview's links between pages, followed here since the preview runs no script of its own: a work card (or a
	 * work page's previous and next) opens that work, as its editor does; on a work page, a link to a part of the home
	 * page goes back home there. Other links behave as on the page (in-page anchors, new tabs).
	 */
	const followPreviewLink = (event: MouseEvent) => {
		const target = event.target as Element | null;
		const link = target?.closest?.("a[href]");
		const href = link?.getAttribute("href") ?? "";
		if (!href.startsWith("#") || event.defaultPrevented) return;
		const anchor = decodeURIComponent(href.slice(1));
		const ui = usePortfolioEditorUi.getState();
		const works = usePortfolioEditorStore.getState().portfolio?.data.works.items ?? [];
		const work = anchor.startsWith("work-") ? works.find((entry) => `work-${entry.slug}` === anchor) : undefined;
		if (work) {
			event.preventDefault();
			ui.openWork(work.id);
			return;
		}
		// On a work page, an anchor that isn't on it belongs to the home page.
		if (shownPage !== "home" && anchor && !link?.ownerDocument.getElementById(anchor)) {
			event.preventDefault();
			pendingAnchor.current = anchor;
			ui.openWork(null);
		}
	};

	const restoreScroll = () => {
		const view = frame.current?.contentWindow;
		if (!view) return;
		view.document.addEventListener("click", followPreviewLink);
		if (pendingReplay.current && playEffect()) {
			pendingReplay.current = 0;
			return;
		}
		const anchor = shownPage === "home" ? pendingAnchor.current : null;
		pendingAnchor.current = null;
		const section = anchor ? view.document.getElementById(anchor) : null;
		// Instant, whatever the page's own smooth scrolling: a redraw right after reads where the reader is.
		const top = section ? section.getBoundingClientRect().top + view.scrollY : scroll.current.top;
		view.scrollTo({ top, behavior: "instant" });
	};

	return (
		<div className="flex h-full min-h-0 flex-col items-center gap-3 p-3 md:p-4">
			{hasEffect && (
				<Button size="sm" variant="tertiary" className="shrink-0" onPress={replayEffect}>
					<Icon name="arrow-counter-clockwise" size={16} />
					<Trans>Replay intro</Trans>
				</Button>
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
				) : failed ? null : (
					<div className="grid size-full place-items-center">
						<Spinner size="md" color="current" />
					</div>
				)}
				{failed && (
					<div
						role="alert"
						className={cn(
							"flex items-center gap-3 p-3 text-sm",
							document
								? "absolute inset-x-3 top-3 rounded-xl border border-separator bg-overlay shadow-overlay"
								: "size-full flex-col justify-center text-center",
						)}
					>
						<Icon name="warning-circle" size={18} className="shrink-0 text-danger" />
						<span className="min-w-0 flex-1">
							{document ? (
								<Trans>The preview couldn't be updated, so it shows an earlier version.</Trans>
							) : (
								<Trans>The preview couldn't be drawn. Your changes are still saved as you edit.</Trans>
							)}
						</span>
						<Button size="sm" variant="secondary" onPress={() => setAttempt((count) => count + 1)}>
							<Trans>Try again</Trans>
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
