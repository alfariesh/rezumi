import type { ReactNode } from "react";
import { Segment } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { usePortfolioData } from "../editor/store";
import { usePortfolioEditorUi } from "../editor/ui";
import { WorkDocument } from "./work-document";

type WorkCanvasProps = {
	/** The portfolio's live preview, shown for Preview (on the open work's page). */
	preview: ReactNode;
};

/**
 * Work's canvas: the open work as a document to write in (Edit), or its page as visitors see it (Preview). Edit is
 * the plain surface, no sheet on the gray canvas, so it reads apart from Preview's page at a glance; the text keeps a
 * readable column in the middle, with room at its sides for each block's handle and AI.
 */
export function WorkCanvas({ preview }: WorkCanvasProps) {
	const view = usePortfolioEditorUi((state) => state.workView);
	const openWorkId = usePortfolioEditorUi((state) => state.openWorkId);
	const works = usePortfolioData().works.items;
	const open = works.find((work) => work.id === openWorkId);

	if (view === "preview") return preview;
	if (!open)
		return (
			<div className="grid size-full place-items-center p-6">
				<div className="grid max-w-xs justify-items-center gap-2 text-center">
					<Icon name="squares-four" size={28} className="text-muted" />
					<p className="text-sm font-medium">
						{works.length ? <Trans>Choose a work to write about</Trans> : <Trans>No works yet</Trans>}
					</p>
					<p className="text-body-xs text-muted">
						{works.length ? (
							<Trans>Pick one from the list, and its story opens here.</Trans>
						) : (
							<Trans>Add one from the list: start empty, or from resume projects, pictures or a link.</Trans>
						)}
					</p>
				</div>
			</div>
		);

	return (
		// Keyed by work: another work starts at its top.
		<div key={open.id} className="size-full scrollbar-thin overflow-y-auto bg-surface">
			<article
				aria-label={t`Writing ${open.title.trim() || t`Untitled work`}`}
				className="work-doc @container mx-auto w-full max-w-[52rem] px-6 pt-10 pb-24 sm:px-20"
			>
				<WorkDocument workId={open.id} />
			</article>
		</div>
	);
}

type WorkViewSwitchProps = {
	/** Tablets: icons only. */
	compact: boolean;
	/** The preview's width, shown beside the switch while the page shows. */
	previewWidth: ReactNode;
};

/** The canvas header's switch in Work: write the work, or see its page. */
export function WorkViewSwitch({ compact, previewWidth }: WorkViewSwitchProps) {
	const view = usePortfolioEditorUi((state) => state.workView);

	return (
		<div className="flex items-center gap-2">
			<Segment
				aria-label={t`Work view`}
				size="sm"
				selectedKey={view}
				onSelectionChange={(key) => usePortfolioEditorUi.getState().setWorkView(key === "preview" ? "preview" : "edit")}
			>
				<Segment.Item id="edit" aria-label={t`Edit`} className="w-auto px-2.5">
					<Icon name="pencil-simple" size={16} variant={view === "edit" ? "duotone" : "stroke"} />
					{!compact && <Trans>Edit</Trans>}
				</Segment.Item>
				<Segment.Item id="preview" aria-label={t`Preview`} className="w-auto px-2.5">
					<Icon name="eye" size={16} variant={view === "preview" ? "duotone" : "stroke"} />
					{!compact && <Trans>Preview</Trans>}
				</Segment.Item>
			</Segment>
			{view === "preview" && previewWidth}
		</div>
	);
}
