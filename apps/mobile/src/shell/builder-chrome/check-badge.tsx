// Check's open issues on its mode (phone mode bar, tablet switch) from every pane. Panes replace each other, so the
// Check pane alone can't keep the count while another pane is open; the resume layout renders this once.
import { useMemo } from "react";
import { useBuilderChrome } from "./slots";
import { useCheck, useCheckDraft } from "@/features/check/use-check";

type CheckBadgeProps = { id: string };

export function CheckBadge({ id }: CheckBadgeProps) {
	const draft = useCheckDraft(id);
	const open = useCheck(draft.data)?.issues.length ?? 0;
	useBuilderChrome(useMemo(() => ({ badges: { check: open } }), [open]));
	return null;
}
