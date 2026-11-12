import type { PortfolioReveal } from "@/features/portfolio/editor/save-problem";
import type { PortfolioSaveStatus } from "@/features/portfolio/editor/store";
import { Segment } from "@heroui-pro/react";
import { Button, buttonVariants, Modal, Spinner, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { applyPendingDraft } from "@/features/portfolio/ai/apply";
import { ContentPanel } from "@/features/portfolio/editor/content-panel";
import { useSourceResume } from "@/features/portfolio/editor/context";
import { DesignPanel } from "@/features/portfolio/editor/design-panel";
import { preloadPortfolioRichTextEditor } from "@/features/portfolio/editor/fields";
import { PublishPanel, usePortfolioUrl } from "@/features/portfolio/editor/publish-panel";
import { describeRetry, describeSaveProblem } from "@/features/portfolio/editor/save-problem";
import { usePortfolioData, usePortfolioEditorStore } from "@/features/portfolio/editor/store";
import { usePortfolioEditorUi } from "@/features/portfolio/editor/ui";
import { usePageMessages } from "@/features/portfolio/editor/use-view";
import { portfolioRefusalMessage } from "@/features/portfolio/errors";
import { mapPictures } from "@/features/portfolio/location/map-pictures";
import { isPortfolioLive } from "@/features/portfolio/status";
import { isEditableElementFocused } from "@/features/resume/builder/draft";
import { BarDivider, UndoRedo } from "@/features/resume/editor/chrome";
import { EditorBarFrame } from "@/features/resume/editor/chrome/bar";
import { ModeSwitch } from "@/features/resume/editor/chrome/mode-switch";
import {
	EditorFrame,
	MODE_ENTER_CLASS,
	MobileEditor,
	useEditorLayout,
	useMobileSheet,
} from "@/features/resume/editor/chrome/shell";
import { useEditorStore } from "@/features/resume/editor/store";
import { useConfirm } from "@/hooks/use-confirm";
import { client, orpc } from "@/libs/orpc/client";

const PortfolioPreview = lazy(() => import("@/features/portfolio/editor/preview"));

/** The editor's three tabs. They reuse the resume editor's mode names, which its shell and phone tab bar know. */
type PortfolioMode = "write" | "design" | "share";

const routeApi = getRouteApi("/builder/portfolio/");

function usePortfolioMode() {
	const { mode } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();
	const current: PortfolioMode = mode ?? "write";
	const setMode = (next: PortfolioMode) =>
		void navigate({
			to: ".",
			search: (search: ReturnType<typeof routeApi.useSearch>) => ({
				...search,
				mode: next === "write" ? undefined : next,
			}),
			replace: true,
			resetScroll: false,
		});
	return [current, setMode] as const;
}

const modeLabel = (mode: PortfolioMode) => ({ write: t`Content`, design: t`Design`, share: t`Publish` })[mode];

/**
 * The portfolio editor (`01-desain.md` section 7): the resume editor's frame with Content, Design and Publish on the
 * left and the live page on the right. Phones show one view at a time from the tab bar.
 */
export function PortfolioShell() {
	const [mode, setMode] = usePortfolioMode();
	const editorLayout = useEditorLayout();

	// The frame's shared state (drawer, phone view, assistant) starts fresh and is left fresh for the resume editor.
	useEffect(() => {
		useEditorStore.getState().reset();
		return () => useEditorStore.getState().reset();
	}, []);
	useEffect(() => preloadPortfolioRichTextEditor(), []);
	// A saved location that shows a map without its pictures gets them, without Contact having to be opened.
	useEffect(() => mapPictures.watch(), []);
	useEffect(() => applyPendingDraft(), []);
	useUnsavedGuard();

	// Opens the place a save problem is in: its tab (the panel, on phones), the work, or the section in Content's list.
	const reveal = ({ tab, section, workId }: PortfolioReveal) => {
		setMode(tab);
		useEditorStore.setState({ mobileView: tab });
		const ui = usePortfolioEditorUi.getState();
		ui.openWork(workId ?? null);
		if (section && !workId) ui.revealSection(section);
	};

	return (
		<>
			<EditorFrame
				editorLayout={editorLayout}
				bar={
					<EditorBarFrame
						layout={editorLayout.layout}
						pinnable={editorLayout.pinnable}
						back={<PortfolioBackLink />}
						menu={<PortfolioTitle onReveal={reveal} />}
						center={null}
					>
						<OpenPage compact />
					</EditorBarFrame>
				}
				back={<PortfolioBackLink />}
				title={<PortfolioTitle onReveal={reveal} />}
				controls={<PortfolioControls compact={editorLayout.layout === "tablet"} />}
				actions={<OpenPage compact={false} />}
				mode={mode}
				modes={
					<ModeSwitch
						modes={[
							{ id: "write", icon: "pencil-simple", label: modeLabel("write") },
							{ id: "design", icon: "palette", label: modeLabel("design") },
							{ id: "share", icon: "globe-hemisphere-west", label: modeLabel("share") },
						]}
						selected={mode}
						onChange={setMode}
					/>
				}
				panelLabel={modeLabel(mode)}
				panel={<ModePanel mode={mode} />}
				page={<Preview />}
				mobile={<MobileBody onModeChange={setMode} />}
			>
				<PortfolioHotkeys />
			</EditorFrame>
			<ConflictDialog />
			<GoneDialog />
		</>
	);
}

type ModePanelProps = { mode: PortfolioMode };

/**
 * Only the open tab is mounted. The resume editor keeps hidden tabs mounted (`KeptModes`), but HeroUI Pro's rich text
 * editor reads its Tiptap editor after a hidden `<Activity>` has destroyed it, so the portfolio's panels can't be kept.
 * Everything they show lives in the editor's stores, and the panel's scroller puts each tab back where it was left.
 */
function ModePanel({ mode }: ModePanelProps) {
	return (
		<div key={mode} className={MODE_ENTER_CLASS}>
			{mode === "design" ? <DesignPanel /> : mode === "share" ? <PublishPanel /> : <ContentPanel />}
		</div>
	);
}

function Preview({ showDeviceSwitch = true }: { showDeviceSwitch?: boolean }) {
	return (
		<Suspense
			fallback={
				<div className="grid size-full place-items-center">
					<Spinner size="md" color="current" />
				</div>
			}
		>
			<PortfolioPreview showDeviceSwitch={showDeviceSwitch} />
		</Suspense>
	);
}

const PORTFOLIO_MODES = ["write", "design", "share"] as const;

type MobileBodyProps = { onModeChange: (mode: PortfolioMode) => void };

/** Phones (≤768 px): the live page, with Content · Design · Publish floating over it, each opening a sheet. */
function MobileBody({ onModeChange }: MobileBodyProps) {
	const open = useMobileSheet(PORTFOLIO_MODES);

	return (
		<MobileEditor
			items={[
				{ mode: "write", icon: "pencil-simple", label: modeLabel("write") },
				{ mode: "design", icon: "palette", label: modeLabel("design") },
				{ mode: "share", icon: "globe-hemisphere-west", label: modeLabel("share") },
			]}
			open={open}
			onOpenChange={(next) => {
				useEditorStore.setState({ mobileView: next ?? "page" });
				if (next) onModeChange(next);
			}}
			halfModes={["design"]}
			page={<Preview showDeviceSwitch={false} />}
		>
			{open && <ModePanel mode={open} />}
		</MobileEditor>
	);
}

/** Leaving the portfolio editor goes back to the Portfolio page. */
function PortfolioBackLink() {
	return (
		<Tooltip>
			<Tooltip.Trigger>
				<Link
					to="/dashboard/portfolio"
					aria-label={t`Back to Portfolio`}
					className={buttonVariants({ variant: "ghost", size: "md", isIconOnly: true })}
				>
					<Icon name="arrow-left" />
				</Link>
			</Tooltip.Trigger>
			<Tooltip.Content placement="right">
				<Trans>Back to Portfolio</Trans>
			</Tooltip.Content>
		</Tooltip>
	);
}

type PortfolioTitleProps = {
	/** Opens the place a save problem is in. */
	onReveal: (place: PortfolioReveal) => void;
};

/** The panel section's header (and the phone's bar): the title and the save state. */
function PortfolioTitle({ onReveal }: PortfolioTitleProps) {
	return (
		<>
			<span className="truncate px-1.5 text-sm font-semibold">
				<Trans>Portfolio</Trans>
			</span>
			<SaveStatus onReveal={onReveal} />
		</>
	);
}

/** The canvas section's header: undo and redo, and the preview's width (tablets: icons only). */
function PortfolioControls({ compact }: { compact: boolean }) {
	const canUndo = usePortfolioEditorStore((state) => state.undoStack.length > 0);
	const canRedo = usePortfolioEditorStore((state) => state.redoStack.length > 0);

	return (
		<>
			<UndoRedo
				canUndo={canUndo}
				canRedo={canRedo}
				onUndo={() => usePortfolioEditorStore.getState().undo()}
				onRedo={() => usePortfolioEditorStore.getState().redo()}
			/>
			<BarDivider />
			<PreviewWidth compact={compact} />
		</>
	);
}

/** Once published, the page in a new tab: a labelled button over the canvas, an icon in the phone's bar. */
function OpenPage({ compact }: { compact: boolean }) {
	const live = usePortfolioEditorStore((state) => isPortfolioLive(state.portfolio));
	const url = usePortfolioUrl();
	if (!live) return null;

	return compact ? (
		<a
			href={url}
			target="_blank"
			rel="noopener"
			aria-label={t`Open page`}
			className={buttonVariants({ variant: "ghost", size: "md", isIconOnly: true })}
		>
			<Icon name="arrow-square-out" />
		</a>
	) : (
		<a href={url} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary", size: "sm" })}>
			<Icon name="arrow-square-out" size={16} />
			<Trans>Open page</Trans>
		</a>
	);
}

/** The preview at a computer's width or a phone's (tablets: icons only). */
function PreviewWidth({ compact }: { compact: boolean }) {
	const device = usePortfolioEditorUi((state) => state.previewDevice);

	return (
		<Segment
			aria-label={t`Preview size`}
			size="sm"
			selectedKey={device}
			onSelectionChange={(key) =>
				usePortfolioEditorUi.getState().setPreviewDevice(key === "phone" ? "phone" : "desktop")
			}
		>
			<Segment.Item id="desktop" aria-label={t`Computer`} className="w-auto px-2.5">
				<Icon name="desktop" size={16} variant={device === "desktop" ? "duotone" : "stroke"} />
				{!compact && <Trans>Computer</Trans>}
			</Segment.Item>
			<Segment.Item id="phone" aria-label={t`Phone`} className="w-auto px-2.5">
				<Icon name="device-mobile" size={16} variant={device === "phone" ? "duotone" : "stroke"} />
				{!compact && <Trans>Phone</Trans>}
			</Segment.Item>
		</Segment>
	);
}

const statusWords = (status: PortfolioSaveStatus) =>
	({
		saved: t`Saved`,
		saving: t`Saving…`,
		error: t`Not saved`,
		invalid: t`Not saved: something needs fixing`,
		conflict: t`Changed elsewhere`,
		gone: t`Not saved`,
	})[status];

/** Why the latest edits aren't saved, in words, and where, while they aren't. */
function useSaveFailure() {
	const status = usePortfolioEditorStore((state) => state.status);
	const problem = usePortfolioEditorStore((state) => state.problem);
	const retry = usePortfolioEditorStore((state) => state.retry);
	const data = usePortfolioData();
	const source = useSourceResume();
	const messages = usePageMessages();
	if (status === "error" && retry) return { message: describeRetry(retry.reason), place: null };
	if ((status === "invalid" || status === "gone") && problem)
		return describeSaveProblem(problem, { data, resume: source.data, messages });
	return null;
}

type SaveStatusProps = { onReveal: (place: PortfolioReveal) => void };

/**
 * The save state as an icon, its words for screen readers and on hover. After a failure the words show, with Retry
 * or, when the problem has one place, "Show me" to open it. Only failures are read out: "Saved" after every pause
 * would interrupt whoever is typing.
 */
function SaveStatus({ onReveal }: SaveStatusProps) {
	const status = usePortfolioEditorStore((state) => state.status);
	const failure = useSaveFailure();
	const words = statusWords(status);
	const failed = status === "error" || status === "invalid";
	const reason = failure?.message ?? "";
	// One message with both parts, so a language can order and punctuate them its own way.
	const said = failure ? t`${words}. ${reason}` : words;
	const place = status === "invalid" ? (failure?.place ?? null) : null;
	const placeLabel = place?.label ?? "";
	const action =
		"cursor-(--cursor-interactive) rounded-sm font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus";

	return (
		<span
			title={said}
			className={cn(
				"me-1 flex min-w-0 shrink items-center gap-1.5 text-xs whitespace-nowrap text-muted",
				failed && "text-danger",
			)}
		>
			{status === "saving" && <Spinner size="sm" color="current" aria-hidden />}
			{status === "saved" && <Icon name="cloud-check" size={16} />}
			{status !== "saved" && status !== "saving" && <Icon name="cloud-warning" size={16} className="shrink-0" />}
			<span className={status === "saved" || status === "saving" ? "sr-only" : "hidden truncate sm:inline"}>
				{words}
			</span>
			{status === "error" && (
				<button
					type="button"
					onClick={() => void usePortfolioEditorStore.getState().flush()}
					aria-label={t`Retry saving`}
					className={action}
				>
					<Trans>Retry</Trans>
				</button>
			)}
			{place && (
				<button
					type="button"
					onClick={() => onReveal(place.reveal)}
					aria-label={t`Show me: ${placeLabel}`}
					className={action}
				>
					<Trans>Show me</Trans>
				</button>
			)}
			<span role="status" aria-live="polite" className="sr-only">
				{failed && failure ? said : ""}
			</span>
		</span>
	);
}

/** Reads the portfolio again for the editor; deleted or switched off, the editor is left for where it can go. */
function useReloadPortfolio() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [loading, setLoading] = useState(false);

	const reload = async () => {
		setLoading(true);
		try {
			const result = await client.portfolio.get();
			queryClient.setQueryData(orpc.portfolio.get.queryKey(), result);
			if (result.enabled && result.portfolio) {
				usePortfolioEditorStore.getState().load(result.portfolio);
				return;
			}
			// Nothing to edit anymore; what wasn't saved can't be, so leaving doesn't ask.
			usePortfolioEditorStore.getState().reset();
			void navigate({ to: result.enabled ? "/dashboard/portfolio" : "/dashboard" });
		} catch {
			toast.add({ type: "error", description: t`Couldn't reload your portfolio. Try again.` });
		} finally {
			setLoading(false);
		}
	};

	return { reload, loading };
}

/**
 * The portfolio was saved somewhere else (another tab or device) since this editor loaded it, with other data.
 * Saving stops until the person picks a version: Reload takes the other one, "Keep my version" saves this one over
 * it, after asking. Neither copy is overwritten silently.
 */
function ConflictDialog() {
	const status = usePortfolioEditorStore((state) => state.status);
	const canKeep = usePortfolioEditorStore((state) => Boolean(state.conflict?.updatedAt));
	const confirm = useConfirm();
	const { reload, loading } = useReloadPortfolio();
	const [keeping, setKeeping] = useState(false);

	const keepMine = async () => {
		const confirmed = await confirm(t`Save your version over the other one?`, {
			description: t`The changes saved in the other tab or device are replaced by what you see here.`,
			confirmText: t`Keep my version`,
		});
		if (!confirmed) return;
		setKeeping(true);
		try {
			await usePortfolioEditorStore.getState().keepMine();
		} finally {
			setKeeping(false);
		}
	};

	return (
		<Modal.Backdrop isOpen={status === "conflict"} isDismissable={false} isKeyboardDismissDisabled>
			<Modal.Container size="sm">
				<Modal.Dialog role="alertdialog">
					<Modal.Header>
						<Modal.Heading>
							<Trans>Your portfolio changed somewhere else</Trans>
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<p className="text-body-sm text-muted">
							<Trans>
								It was saved in another tab or on another device after you opened it here. Reload to continue from that
								version, or keep your version and save it over that one.
							</Trans>
						</p>
					</Modal.Body>
					<Modal.Footer>
						{canKeep && (
							<Button variant="secondary" isDisabled={loading} isPending={keeping} onPress={() => void keepMine()}>
								<Trans>Keep my version</Trans>
							</Button>
						)}
						<Button isPending={loading} isDisabled={keeping} onPress={() => void reload()}>
							<Trans>Reload</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

/**
 * Nothing can be saved: the portfolio was deleted (in another tab, say) or portfolios were switched off for the
 * account. Reload reads it again (and moves on when it's gone); the other button leaves the editor.
 */
function GoneDialog() {
	const status = usePortfolioEditorStore((state) => state.status);
	const problem = usePortfolioEditorStore((state) => state.problem);
	const navigate = useNavigate();
	const { reload, loading } = useReloadPortfolio();
	const code = problem?.kind === "gone" ? problem.code : "NOT_FOUND";

	const leave = () => {
		usePortfolioEditorStore.getState().reset();
		void navigate({ to: "/dashboard/portfolio" });
	};

	return (
		<Modal.Backdrop isOpen={status === "gone"} isDismissable={false} isKeyboardDismissDisabled>
			<Modal.Container size="sm">
				<Modal.Dialog role="alertdialog">
					<Modal.Header>
						<Modal.Heading>
							<Trans>Your portfolio can't be saved</Trans>
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body className="grid gap-2 text-sm text-muted">
						<p>{portfolioRefusalMessage(code)}</p>
						<p>
							<Trans>Your latest changes here aren't saved.</Trans>
						</p>
					</Modal.Body>
					<Modal.Footer>
						<Button variant="secondary" isDisabled={loading} onPress={leave}>
							<Trans>Back to Portfolio</Trans>
						</Button>
						<Button isPending={loading} onPress={() => void reload()}>
							<Trans>Reload</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

/** Undo and redo outside fields (fields keep their own), and ⌘S says saving is automatic. */
function PortfolioHotkeys() {
	useHotkey("Mod+Z", () => {
		if (!isEditableElementFocused()) usePortfolioEditorStore.getState().undo();
	});
	useHotkey("Mod+Shift+Z", () => {
		if (!isEditableElementFocused()) usePortfolioEditorStore.getState().redo();
	});
	useHotkey("Mod+S", () => {
		void usePortfolioEditorStore.getState().flush();
		toast.add({ type: "info", description: t`Your changes are saved automatically.`, id: "auto-save" });
	});
	return null;
}

/** Closing the tab with changes still on their way asks first. */
function useUnsavedGuard() {
	useEffect(() => {
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			const { status, dirty } = usePortfolioEditorStore.getState();
			if (status === "saved" && !dirty) return;
			void usePortfolioEditorStore.getState().flush();
			event.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, []);
}
