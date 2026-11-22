import type { BuilderPane } from "@/routes";
import type { PaneTab } from "@/shell/builder-chrome";
import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import PageScreen from "./page";
import { ResumeConflictSheet, useResumeDraftOwner, useResumeStore } from "@/draft";
import { DocumentMenu } from "@/features/documents/document-menu";
import { routes } from "@/routes";
import { BuilderChrome, DraftChrome } from "@/shell/builder-chrome";
import { IconButton } from "@/ui";

/**
 * Resume builder. Phone: Write, Page, Design, Check and Share in the mode bar. Tablet: the Write / Design / Check /
 * Share panel with the page beside it. Entries and History push inside the editor; Download & history and the
 * assistant open as modals.
 */
export default function BuilderLayout() {
	const router = useRouter();
	const { t } = useLingui();
	const { id } = useLocalSearchParams<{ id: string }>();
	// The one owner of the draft for the whole builder: panes, the tablet page and pushed screens only subscribe, so
	// switching panes or rotating never reopens the draft or resets undo.
	useResumeDraftOwner(id);

	const panes: PaneTab<BuilderPane>[] = [
		{ pane: "write", label: t`Write`, icon: "pencil-simple", href: routes.builder(id, "write") },
		{ pane: "page", label: t`Page`, icon: "file-text", href: routes.builder(id, "page") },
		{ pane: "design", label: t`Design`, icon: "palette", href: routes.builder(id, "design") },
		{
			pane: "check",
			label: t({ message: "Check", context: "Editor mode" }),
			icon: "list-checks",
			href: routes.builder(id, "check"),
		},
		{
			pane: "share",
			label: t({ message: "Share", context: "Editor mode" }),
			icon: "globe",
			href: routes.builder(id, "share"),
		},
	];

	return (
		<BuilderChrome
			panes={panes}
			tabletPanes={["write", "design", "check", "share"]}
			page={<PageScreen />}
			title={t`Resume`}
			onExport={() => router.push(routes.export(id))}
			modals={["export", "assistant"]}
			fullScreenModals={["preview"]}
		>
			<DraftChrome
				useStore={useResumeStore}
				actions={
					<IconButton icon="sparkle" label={t`Assistant`} size="sm" onPress={() => router.push(routes.assistant(id))} />
				}
			/>
			<DocumentMenu id={id} inChrome />
			<ResumeConflictSheet />
		</BuilderChrome>
	);
}
