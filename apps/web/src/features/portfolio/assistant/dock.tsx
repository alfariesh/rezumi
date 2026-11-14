import type { PortfolioReveal } from "../editor/save-problem";
import { useEffect } from "react";
import { usePortfolioAssistantDocument } from "./document";
import { AssistantDock } from "@/features/assistant/dock";

type PortfolioAssistantProps = {
	/** Opens a change's place in the editor (its tab, the work, the section), from a line on a changes card. */
	onReveal: (place: PortfolioReveal) => void;
};

/** The assistant in the portfolio editor: its column, drawer or phone sheet, like the resume editor's. */
export function PortfolioAssistant({ onReveal }: PortfolioAssistantProps) {
	const document = usePortfolioAssistantDocument(onReveal);
	// The changes cards load with the panel rather than after the conversation shows: a card arriving a moment later
	// would move the transcript under the reader's pointer.
	useEffect(() => {
		void import("./changes");
	}, []);
	return <AssistantDock document={document} />;
}
