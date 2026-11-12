import { DownloadSheetFrame } from "@/features/resume/editor/chrome/download-sheet";
import { useEditorStore } from "@/features/resume/editor/store";
import { useEditorMode } from "@/features/resume/editor/use-editor-mode";
import { DownloadTab } from "@/features/resume/share/download-tab";

/** Download: every format, from the ▾ beside Download PDF. History is in the panel; sharing is a mode. */
export function DownloadSheet() {
	const setTab = useEditorStore((state) => state.setSheetTab);
	const [, setMode] = useEditorMode();

	return (
		<DownloadSheetFrame>
			<DownloadTab
				onReview={() => {
					setTab(null);
					setMode("check");
				}}
			/>
		</DownloadSheetFrame>
	);
}
