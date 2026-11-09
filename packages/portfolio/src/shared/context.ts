import type { PortfolioPageMessages } from "../messages";
import type { PortfolioPageLive } from "../page";
import type { PortfolioView } from "../view";
import { createContext, useContext } from "react";

/** What every part of a page needs besides the view: its text, language, icons and pictures' addresses. */
export type RenderContext = {
	view: PortfolioView;
	messages: PortfolioPageMessages;
	locale: string;
	/** A resume icon's SVG shapes (24 × 24, `currentColor`), when the caller loaded it. */
	icon: (name: string | null | undefined) => string | null;
	/** An image address as the page loads it: uploads from the app's origin, others as given. */
	imageUrl: (src: string) => string | undefined;
	/** Ids unique within one page (sparkline gradients, headings). */
	nextId: (prefix: string) => string;
	/** How a published page talks to the server; the editor's preview has none. */
	live?: PortfolioPageLive;
};

export const RenderContextValue = createContext<RenderContext | null>(null);

export function useRender(): RenderContext {
	const context = useContext(RenderContextValue);
	if (!context) throw new Error("Portfolio components render inside renderPortfolioPage.");
	return context;
}
