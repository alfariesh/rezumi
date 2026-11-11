import type { EditorMode } from "@/features/resume/editor/store";
import { Button, Toolbar } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { getRouteApi, Outlet } from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { DownloadSheet } from "./download-sheet";
import { EditorBar, ModeTabs, ResumeDownload } from "./editor-bar";
import { DesignPanel, DesignSheet, ModePanel } from "./mode-panels";
import { useEditorHotkeys } from "./use-editor-hotkeys";
import { ResumeAssistant } from "@/features/assistant/dock";
import { openAssistantFrom } from "@/features/assistant/open";
import { usePreviewPausedStore } from "@/features/resume/builder/draft";
import { IssueStepper } from "@/features/resume/editor/check/page-layer";
import { useOpenIssueCount } from "@/features/resume/editor/check/use-check";
import { EditorFrame, MobileEditor, useEditorLayout, useMobileSheet } from "@/features/resume/editor/chrome/shell";
import { EDITOR_MODES, selectPanelView, useEditorStore } from "@/features/resume/editor/store";
import { useEditorMode } from "@/features/resume/editor/use-editor-mode";
import { useResumeWebMcpTools } from "@/features/resume/editor/webmcp";
import { revealSelectionInPanel } from "@/features/resume/editor/write/reveal";
import { preloadRichTextEditor } from "@/features/resume/editor/write/rich-text-editor";
import { whenIdle } from "@/features/resume/preview/resume-thumbnail.shared";
import { HistoryTab } from "@/features/resume/share/history-tab";

/**
 * The editor: a 56px bar (undo and zoom in its middle) over the panel card (the modes, AI and History down its left)
 * and the page canvas with Download floating over it (desktop). On tablets the panel is a 380px drawer over the page, pinnable beside it in
 * landscape; on phones the page shows with Write · Design · Check · Share floating over it, each opening a sheet.
 */
export function EditorShell() {
	const [mode, setMode] = useEditorMode();
	const editorLayout = useEditorLayout();
	const resetEditor = useEditorStore((state) => state.reset);

	// Selection, zoom and open sheets belong to one document.
	useEffect(() => resetEditor, [resetEditor]);
	// Design and the rich text editor load once the page is idle, so opening them is instant.
	useEffect(() => {
		void whenIdle().then(() => {
			void DesignPanel.preload?.();
			preloadRichTextEditor();
		});
	}, []);
	useOpenVersionFromUrl();
	useOpenAssistantFromUrl();
	useResumeWebMcpTools(routeApi.useParams().resumeId);

	return (
		<>
			<EditorFrame
				editorLayout={editorLayout}
				bar={<EditorBar layout={editorLayout.layout} pinnable={editorLayout.pinnable} />}
				mode={mode}
				modes={<ModeTabs />}
				panelLabel={panelLabel(mode)}
				panel={<ModePanel mode={mode} />}
				page={<Outlet />}
				assistant={<ResumeAssistant />}
				history={<HistoryTab />}
				floating={<ResumeDownload />}
				mobile={<MobileBody mode={mode} onModeChange={setMode} />}
			>
				<EditorHotkeys onModeChange={setMode} />
			</EditorFrame>
			<DownloadSheet />
		</>
	);
}

const routeApi = getRouteApi("/builder/$resumeId");

/** `?version=` opens History on that version (the page shows it read-only), then leaves the URL. */
function useOpenVersionFromUrl() {
	const { version } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();

	useEffect(() => {
		if (!version) return;
		useEditorStore.getState().setSheetTab("history");
		useEditorStore.setState({ historyVersionId: version });
		void navigate({
			to: ".",
			resetScroll: false,
			search: (current: ReturnType<typeof routeApi.useSearch>) => ({ ...current, version: undefined }),
			replace: true,
		});
	}, [version, navigate]);
}

/** `?assistant=` opens the assistant on that conversation; `?ask=` only fills its composer. Both then leave the URL. */
function useOpenAssistantFromUrl() {
	const { assistant, ask } = routeApi.useSearch();
	const navigate = routeApi.useNavigate();

	useEffect(() => {
		if (!openAssistantFrom({ assistant, draft: ask })) return;
		void navigate({
			to: ".",
			resetScroll: false,
			search: (current: ReturnType<typeof routeApi.useSearch>) => ({
				...current,
				assistant: undefined,
				ask: undefined,
			}),
			replace: true,
		});
	}, [assistant, ask, navigate]);
}

function EditorHotkeys({ onModeChange }: { onModeChange: (mode: EditorMode) => void }) {
	useEditorHotkeys(onModeChange);
	return null;
}

const panelLabel = (mode: EditorMode) =>
	({ write: t`Content`, design: t`Design`, check: t`Check`, share: t`Share` })[mode];

type MobileBodyProps = {
	mode: EditorMode;
	onModeChange: (mode: EditorMode) => void;
};

/**
 * Phones: the page, with the modes floating over it. Each opens its panel in a sheet; Design's rests at half height so
 * the page stays in view above it. Tapping a line on the page offers to edit its entry, and Check steps through the
 * issues on the page while no sheet is open.
 */
function MobileBody({ mode, onModeChange }: MobileBodyProps) {
	const open = useMobileSheet(EDITOR_MODES);
	const view = useEditorStore(selectPanelView);
	const issueCount = useOpenIssueCount();
	const setPreviewPaused = usePreviewPausedStore((state) => state.setPaused);

	// A full-height sheet hides the page, so it stops re-rendering until the sheet goes; Design's and History's half
	// sheets leave it in view.
	const covered = view === "assistant" || (view === null && open !== null && open !== "design");
	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect -- a shared store the preview renderer reads, reset on unmount
		setPreviewPaused(covered);
		return () => setPreviewPaused(false);
	}, [covered, setPreviewPaused]);

	const openSheet = (next: EditorMode | null) => {
		useEditorStore.setState({ mobileView: next ?? "page" });
		if (next) onModeChange(next);
	};

	return (
		<MobileEditor
			items={[
				{ mode: "write", icon: "pencil-simple", label: t`Write` },
				{ mode: "design", icon: "palette", label: t`Design` },
				{
					mode: "check",
					icon: "list-checks",
					label: t`Check`,
					extra: issueCount > 0 && <span className="size-2 rounded-full bg-warning" aria-hidden="true" />,
				},
				{ mode: "share", icon: "globe-hemisphere-west", label: t`Share` },
			]}
			views={["assistant", "history"]}
			assistant={<ResumeAssistant />}
			history={<HistoryTab />}
			open={open}
			onOpenChange={openSheet}
			halfModes={["design"]}
			page={<Outlet />}
			overlay={mode === "check" ? <IssueStepper /> : <SelectionBar onEdit={() => openSheet("write")} />}
		>
			{open === "design" ? (
				<Suspense>
					<DesignSheet />
				</Suspense>
			) : open ? (
				<ModePanel mode={open} />
			) : null}
		</MobileEditor>
	);
}

/** Phones: tapping a line on the page selects it and offers to edit that entry. Improve joins it in M10. */
function SelectionBar({ onEdit }: { onEdit: () => void }) {
	const selection = useEditorStore((state) => state.selection);
	if (!selection) return null;

	return (
		<Toolbar
			isAttached
			aria-label={t`Selection`}
			className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-1/2 z-10 -translate-x-1/2 transition-[opacity,translate] duration-standard ease-enter starting:translate-y-2 starting:opacity-0"
		>
			<Button
				variant="primary"
				className="rounded-full"
				onPress={() => {
					onEdit();
					revealSelectionInPanel(selection);
				}}
			>
				<Icon name="pencil-simple" />
				<Trans>Edit entry</Trans>
			</Button>
		</Toolbar>
	);
}
