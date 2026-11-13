import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { RichTextEditor } from "./rich-text-editor";
import { useWriteSelector, useWriteUpdate } from "./source";

type SummaryEditorProps = { locked: boolean };

/** The summary: one rich text, with the guidance the spec gives. Improve joins it in M10. */
export function SummaryEditor({ locked }: SummaryEditorProps) {
	const content = useWriteSelector((data) => data.summary.content);
	const update = useWriteUpdate();

	return (
		<RichTextEditor
			label={t`Summary`}
			value={content}
			disabled={locked}
			hint={<Trans>2–3 sentences reads best</Trans>}
			onChange={(html) =>
				update(
					(draft) => {
						draft.summary.content = html;
					},
					{ coalesceKey: "summary.content" },
				)
			}
		/>
	);
}
