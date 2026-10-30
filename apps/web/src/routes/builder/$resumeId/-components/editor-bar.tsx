import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { DocumentMenu } from "./document-menu";
import { useCurrentBuilderResumeSelector, useCurrentResume, useResumeStore } from "@/features/resume/builder/draft";
import { useOpenIssueCount } from "@/features/resume/editor/check/use-check";
import { DownloadButtons, EditorBarFrame } from "@/features/resume/editor/chrome/bar";
import { ModeSwitch } from "@/features/resume/editor/chrome/mode-switch";
import { useEditorMode } from "@/features/resume/editor/use-editor-mode";
import { preloadDocumentExport, useResumeExport } from "@/features/resume/export/use-resume-export";

type EditorBarProps = {
	layout: "desktop" | "tablet" | "mobile";
	/** Tablet in landscape: the panel can be pinned beside the page. */
	pinnable: boolean;
};

/** The 56px editor bar: back and "Resume" · the name and save state · History, the assistant and Download PDF. */
export function EditorBar({ layout, pinnable }: EditorBarProps) {
	// Download needs a connection.
	const offline = useResumeStore((state) => state.saveStatus === "offline");
	const resume = useCurrentResume();
	const { onDownloadPDF, isExporting } = useResumeExport(resume);

	return (
		<EditorBarFrame
			layout={layout}
			pinnable={pinnable}
			kind={{ icon: "file-text", label: t`Resume` }}
			menu={<DocumentMenu />}
		>
			<DownloadButtons
				busy={isExporting}
				onDownload={() => void onDownloadPDF()}
				onPreload={preloadDocumentExport}
				compact={layout === "mobile"}
				iconOnly={layout === "tablet"}
				disabled={offline}
			/>
		</EditorBarFrame>
	);
}

const MODE_ICONS = {
	write: "pencil-simple",
	design: "palette",
	check: "list-checks",
	share: "globe-hemisphere-west",
} as const;

/** Write · Design · Check · Share, above the panel. */
export function ModeTabs() {
	const [current, setMode] = useEditorMode();
	const issueCount = useOpenIssueCount();
	const isPublic = useCurrentBuilderResumeSelector((resume) => resume.isPublic ?? false);

	return (
		<ModeSwitch
			selected={current}
			onChange={setMode}
			modes={[
				{ id: "write", icon: MODE_ICONS.write, label: t`Write` },
				{ id: "design", icon: MODE_ICONS.design, label: t`Design` },
				{ id: "check", icon: MODE_ICONS.check, label: t`Check`, extra: <CheckBadge count={issueCount} /> },
				{
					id: "share",
					icon: MODE_ICONS.share,
					label: t`Share`,
					extra: isPublic && (
						<span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" title={t`Public`} />
					),
				},
			]}
		/>
	);
}

function CheckBadge({ count }: { count: number }) {
	if (count === 0) {
		return (
			<span className="inline-flex text-success">
				<Icon name="check" size={16} />
				<span className="sr-only">
					<Trans>No open issues</Trans>
				</span>
			</span>
		);
	}

	return (
		<Chip size="sm" color="warning" variant="soft" className="min-w-[18px] justify-center px-1.5 tabular-nums">
			<span aria-hidden="true">{count}</span>
			<span className="sr-only">
				<Plural value={count} one="# open issue" other="# open issues" />
			</span>
		</Chip>
	);
}
