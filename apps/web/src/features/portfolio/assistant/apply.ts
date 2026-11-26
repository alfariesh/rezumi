import { createPortfolioAssistant } from "@rezumi/portfolio/assistant";
import { usePortfolioEditorStore } from "../editor/store";
import { fillInMedia } from "./media";
import { client } from "@/libs/orpc/client";

export { callStatus } from "@rezumi/portfolio/assistant";
export const {
	applyCall,
	autoApplyMessages,
	autoApplyPart,
	editCallOf,
	undoCall,
	usePortfolioChanges,
	forgetPortfolioChanges,
} = createPortfolioAssistant({
	getState: usePortfolioEditorStore.getState,
	record: (call, edits) => client.agent.messages.setEditStatus({ ...call, edits }),
	fillInMedia,
});
