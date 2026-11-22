import type { LetterPane } from "@/routes";
import type { PaneTab } from "@/shell/builder-chrome";
import { useLingui } from "@lingui/react/macro";
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import PageScreen from "./page";
import { LetterConflictSheet, useLetterDraftOwner, useLetterStore } from "@/draft";
import { discardLetterDraft } from "@/features/letters/drafting";
import { nextLetterVisit } from "@/features/letters/save";
import { LetterShareSheet } from "@/features/letters/share";
import { routes } from "@/routes";
import { BuilderChrome, DraftChrome } from "@/shell/builder-chrome";
import { IconButton } from "@/ui";

/**
 * Cover letter editor. Phone: Write, Page and Design in the mode bar (no Check). Tablet: the
 * Write / Design panel with the Page beside it. Share opens Share & export (Download, History) as a sheet.
 */
export default function LetterLayout() {
	const router = useRouter();
	const { t } = useLingui();
	const { id } = useLocalSearchParams<{ id: string }>();
	// `?version=` (Applications' "What you sent") opens History on that version; it's the child route's param.
	const { version } = useGlobalSearchParams<{ version?: string }>();
	const [sharing, setSharing] = useState(!!version);
	// The one owner of the letter draft; panes and the tablet page subscribe with `useLetterStore()`.
	useLetterDraftOwner(id);
	// One editor visit: late server work from another visit never touches this draft, and leaving or switching letters
	// stops an AI draft.
	useEffect(() => {
		nextLetterVisit();
		return () => {
			nextLetterVisit();
			discardLetterDraft();
		};
	}, [id]);

	const panes: PaneTab<LetterPane>[] = [
		{ pane: "write", label: t`Write`, icon: "pencil-simple", href: routes.letter(id, "write") },
		{ pane: "page", label: t`Page`, icon: "file-text", href: routes.letter(id, "page") },
		{ pane: "design", label: t`Design`, icon: "palette", href: routes.letter(id, "design") },
	];

	return (
		<BuilderChrome
			panes={panes}
			tabletPanes={["write", "design"]}
			page={<PageScreen />}
			title={t`Cover letter`}
			onExport={() => setSharing(true)}
			modals={["assistant"]}
			fullScreenModals={["preview"]}
		>
			<DraftChrome
				useStore={useLetterStore}
				actions={
					<IconButton
						icon="sparkle"
						label={t`Assistant`}
						size="sm"
						onPress={() => router.push(routes.letterAssistant(id))}
					/>
				}
			/>
			<LetterConflictSheet />
			<LetterShareSheet id={id} open={sharing} onClose={() => setSharing(false)} version={version} />
		</BuilderChrome>
	);
}
