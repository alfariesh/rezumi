import type { PortfolioSaveStatus } from "@/features/portfolio/editor/store";
import { Button, buttonVariants, Modal, Spinner, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { ContentPanel } from "@/features/portfolio/editor/content-panel";
import { DesignPanel } from "@/features/portfolio/editor/design-panel";
import { preloadPortfolioRichTextEditor } from "@/features/portfolio/editor/fields";
import { PublishPanel, usePortfolioUrl } from "@/features/portfolio/editor/publish-panel";
import { usePortfolioEditorStore } from "@/features/portfolio/editor/store";
import { isEditableElementFocused } from "@/features/resume/builder/draft";
import { DrawerControls } from "@/features/resume/editor/chrome";
import { ModeSwitch } from "@/features/resume/editor/chrome/mode-switch";
import {
	EditorFrame,
	MobileTabBar,
	useEditorColumnsTransition,
	useEditorLayout,
} from "@/features/resume/editor/chrome/shell";
import { useEditorStore } from "@/features/resume/editor/store";
import { client, orpc } from "@/libs/orpc/client";

const PortfolioPreview = lazy(() => import("@/features/portfolio/editor/preview"));

/** The editor's three tabs. They reuse the resume editor's mode names, which its shell and phone tab bar know. */
export type PortfolioMode = "write" | "design" | "share";

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
	useUnsavedGuard();

	return (
		<>
			<EditorFrame
				editorLayout={editorLayout}
				bar={<PortfolioBar layout={editorLayout.layout} pinnable={editorLayout.pinnable} />}
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
				assistant={null}
				mobile={<MobileBody mode={mode} onModeChange={setMode} />}
			>
				<PortfolioHotkeys />
			</EditorFrame>
			<ConflictDialog />
		</>
	);
}

/**
 * Only the open tab is mounted. The resume editor keeps hidden tabs mounted (`KeptModes`), but HeroUI Pro's rich text
 * editor reads its Tiptap editor after a hidden `<Activity>` has destroyed it, so the portfolio's panels can't be kept.
 * Everything they show lives in the editor's store, so switching back loses nothing but the scroll position.
 */
function ModePanel({ mode }: { mode: PortfolioMode }) {
	if (mode === "design") return <DesignPanel />;
	if (mode === "share") return <PublishPanel />;
	return <ContentPanel />;
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

type MobileBodyProps = { mode: PortfolioMode; onModeChange: (mode: PortfolioMode) => void };

/**
 * Phones (≤768 px): the panel or the preview, switched from the tab bar. One is mounted at a time, for the reason
 * `ModePanel` gives.
 */
function MobileBody({ mode, onModeChange }: MobileBodyProps) {
	const stored = useEditorStore((state) => state.mobileView);
	const view = stored === "page" || stored === "write" || stored === "design" || stored === "share" ? stored : mode;

	return (
		<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
			<div className="relative min-h-0">
				{view === "page" ? (
					<main id="main-content" className="h-full">
						<Preview showDeviceSwitch={false} />
					</main>
				) : (
					<section
						data-editor-panel
						aria-label={modeLabel(mode)}
						className="absolute inset-0 overflow-y-auto bg-background [overflow-anchor:none]"
					>
						<ModePanel mode={mode} />
					</section>
				)}
			</div>
			<MobileTabBar
				tabs={[
					{ view: "write", icon: "pencil-simple", label: modeLabel("write") },
					{ view: "page", icon: "eye", label: t`Preview` },
					{ view: "design", icon: "palette", label: modeLabel("design") },
					{ view: "share", icon: "globe-hemisphere-west", label: modeLabel("share") },
				]}
				view={view}
				onModeChange={onModeChange}
			/>
		</div>
	);
}

type PortfolioBarProps = { layout: "desktop" | "tablet" | "mobile"; pinnable: boolean };

/** Back, the save state, undo and redo, and the published page. */
function PortfolioBar({ layout, pinnable }: PortfolioBarProps) {
	const transition = useEditorColumnsTransition();
	const isPublic = usePortfolioEditorStore((state) => state.portfolio?.isPublic ?? false);
	const canUndo = usePortfolioEditorStore((state) => state.undoStack.length > 0);
	const canRedo = usePortfolioEditorStore((state) => state.redoStack.length > 0);
	const url = usePortfolioUrl();
	const phone = layout === "mobile";

	return (
		<header className={cn("grid h-(--editor-bar) grid-cols-(--editor-columns) items-center", transition)}>
			<div className="flex min-w-0 items-center gap-1 ps-3 pe-2">
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
					<Tooltip.Content placement="bottom">
						<Trans>Back to Portfolio</Trans>
					</Tooltip.Content>
				</Tooltip>
				{layout === "tablet" && <DrawerControls pinnable={pinnable} />}
				{!phone && (
					<span className="flex min-w-0 items-center gap-1.5 ps-1 text-sm font-medium text-muted">
						<Icon name="globe-hemisphere-west" size={16} className="shrink-0" />
						<span className="truncate">
							<Trans>Portfolio</Trans>
						</span>
					</span>
				)}
			</div>
			<div className="flex min-w-0 items-center justify-end gap-1 pe-3">
				<SaveStatus />
				<IconButton
					icon="arrow-counter-clockwise"
					label={t`Undo`}
					shortcut="⌘Z"
					isDisabled={!canUndo}
					onPress={() => usePortfolioEditorStore.getState().undo()}
				/>
				<IconButton
					icon="arrow-clockwise"
					label={t`Redo`}
					shortcut="⌘⇧Z"
					isDisabled={!canRedo}
					onPress={() => usePortfolioEditorStore.getState().redo()}
				/>
				{isPublic &&
					(phone ? (
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
						<a href={url} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
							<Icon name="arrow-square-out" size={18} />
							<Trans>Open page</Trans>
						</a>
					))}
			</div>
		</header>
	);
}

const statusWords = (status: PortfolioSaveStatus) =>
	({
		saved: t`Saved`,
		saving: t`Saving…`,
		error: t`Not saved`,
		invalid: t`Not saved: a field needs fixing`,
		conflict: t`Changed elsewhere`,
	})[status];

/** The save state as an icon, its words for screen readers and on hover; Retry stays visible after a failure. */
function SaveStatus() {
	const status = usePortfolioEditorStore((state) => state.status);
	const problem = usePortfolioEditorStore((state) => state.problem);
	const words = status === "invalid" && problem ? `${statusWords(status)} (${problem})` : statusWords(status);

	return (
		<span
			role="status"
			aria-live="polite"
			title={words}
			className={cn(
				"me-1 flex min-w-0 shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted",
				(status === "error" || status === "invalid") && "text-danger",
			)}
		>
			{status === "saving" && <Spinner size="sm" color="current" aria-hidden />}
			{status === "saved" && <Icon name="cloud-check" size={16} />}
			{(status === "error" || status === "invalid" || status === "conflict") && <Icon name="cloud-warning" size={16} />}
			<span className={status === "saved" || status === "saving" ? "sr-only" : "hidden sm:inline"}>{words}</span>
			{status === "error" && (
				<button
					type="button"
					onClick={() => void usePortfolioEditorStore.getState().flush()}
					aria-label={t`Retry saving`}
					className="cursor-(--cursor-interactive) rounded-sm font-semibold underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-focus"
				>
					<Trans>Retry</Trans>
				</button>
			)}
		</span>
	);
}

/**
 * The portfolio was saved somewhere else (another tab or device) since this editor loaded it. Saving stops, and
 * reloading takes the other copy, so neither silently overwrites the other.
 */
function ConflictDialog() {
	const status = usePortfolioEditorStore((state) => state.status);
	const queryClient = useQueryClient();
	const [loading, setLoading] = useState(false);

	const reload = async () => {
		setLoading(true);
		try {
			const result = await client.portfolio.get();
			queryClient.setQueryData(orpc.portfolio.get.queryKey(), result);
			if (result.portfolio) usePortfolioEditorStore.getState().load(result.portfolio);
		} catch {
			toast.add({ type: "error", description: t`Couldn't reload your portfolio. Try again.` });
		} finally {
			setLoading(false);
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
						<p className="text-sm text-muted">
							<Trans>
								It was saved in another tab or on another device after you opened it here. Reload to continue from that
								version; your last changes here weren't saved.
							</Trans>
						</p>
					</Modal.Body>
					<Modal.Footer>
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
