import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { DocumentMenu } from "./document-menu";
import { useCurrentBuilderResumeSelector, useCurrentResume, useResumeStore } from "@/features/resume/builder/draft";
import { useOpenIssueCount } from "@/features/resume/editor/check/use-check";
import { BarDivider, UndoRedo, ZoomControls } from "@/features/resume/editor/chrome";
import { DownloadButtons, EditorBarFrame } from "@/features/resume/editor/chrome/bar";
import { ModeSwitch } from "@/features/resume/editor/chrome/mode-switch";
import { useEditorMode } from "@/features/resume/editor/use-editor-mode";
import { preloadDocumentExport, useResumeExport } from "@/features/resume/export/use-resume-export";

type EditorBarProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
};

/**
 * The 56px editor bar: back, the name, its menu and save state · undo, redo and zoom. Phones keep Download PDF at its
 * end; elsewhere it floats over the page (`ResumeDownload`).
 */
export function EditorBar({ layout, pinnable }: EditorBarProps) {
	const canUndo = useResumeStore((state) => state.undoStack.length > 0);
	const canRedo = useResumeStore((state) => state.redoStack.length > 0);

	return (
		<EditorBarFrame
			layout={layout}
			pinnable={pinnable}
			menu={<DocumentMenu />}
			center={
				<>
					<UndoRedo
						canUndo={canUndo}
						canRedo={canRedo}
						onUndo={() => useResumeStore.getState().undo()}
						onRedo={() => useResumeStore.getState().redo()}
					/>
					<BarDivider />
					<ZoomControls compact={layout === "tablet"} />
				</>
			}
		>
			{layout === "mobile" && <ResumeDownload compact />}
		</EditorBarFrame>
	);
}

/** Download PDF and the ▾ for every format: floating over the page, or (`compact`) one icon in the phone's bar. */
export function ResumeDownload({ compact = false }: { compact?: boolean }) {
	// Download needs a connection.
	const offline = useResumeStore((state) => state.saveStatus === "offline");
	const resume = useCurrentResume();
	const { onDownloadPDF, isExporting } = useResumeExport(resume);

	return (
		<DownloadButtons
			busy={isExporting}
			onDownload={() => void onDownloadPDF()}
			onPreload={preloadDocumentExport}
			compact={compact}
			iconOnly={false}
			disabled={offline}
		/>
	);
}

/** Write · Design · Check · Share, then AI and History, down the left of the panel card. */
export function ModeTabs() {
	const [current, setMode] = useEditorMode();
	const issueCount = useOpenIssueCount();
	const isPublic = useCurrentBuilderResumeSelector((resume) => resume.isPublic ?? false);

	return (
		<ModeSwitch
			selected={current}
			onChange={setMode}
			views={["assistant", "history"]}
			modes={[
				{ id: "write", icon: "pencil-simple", label: t`Write` },
				{ id: "design", icon: "palette", label: t`Design` },
				{ id: "check", icon: "list-checks", label: t`Check`, extra: <CheckBadge count={issueCount} /> },
				{
					id: "share",
					icon: "globe-hemisphere-west",
					label: t`Share`,
					extra: isPublic && (
						<span className="size-2 rounded-full bg-accent ring-2 ring-surface" title={t`Public`}>
							<span className="sr-only">
								<Trans>Public</Trans>
							</span>
						</span>
					),
				},
			]}
		/>
	);
}

/** Check's open issues as a small count at the icon's corner, or a check mark once there are none. */
function CheckBadge({ count }: { count: number }) {
	if (count === 0) {
		return (
			<span className="grid size-4 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-surface">
				<Icon name="check" size={10} />
				<span className="sr-only">
					<Trans>No open issues</Trans>
				</span>
			</span>
		);
	}

	return (
		<span className="grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] leading-none font-semibold text-warning-foreground tabular-nums ring-2 ring-surface">
			<span aria-hidden="true">{count}</span>
			<span className="sr-only">
				<Plural value={count} one="# open issue" other="# open issues" />
			</span>
		</span>
	);
}
