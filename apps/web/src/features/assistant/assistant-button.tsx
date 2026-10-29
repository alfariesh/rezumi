import { t } from "@lingui/core/macro";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { loadAssistantPanel } from "./dock";
import { useEditorStore } from "@/features/resume/editor/store";

/** The ✦ in the editor bar: opens and closes the assistant (⌘J), accent-soft while it's open. */
export function AssistantButton() {
	const open = useEditorStore((state) => state.assistantOpen);
	const setOpen = useEditorStore((state) => state.setAssistantOpen);

	return (
		<IconButton
			icon="sparkle"
			label={t`Assistant`}
			shortcut="⌘J"
			aria-pressed={open}
			data-assistant-toggle=""
			className={cn("text-ink-2", open && "bg-accent-soft text-accent-text hover:bg-accent-soft")}
			onPointerEnter={() => void loadAssistantPanel()}
			onFocus={() => void loadAssistantPanel()}
			onClick={() => setOpen(!open)}
		/>
	);
}
