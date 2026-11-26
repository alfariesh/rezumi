import { createContext, use } from "react";
import { useWindowDimensions } from "react-native";

export const SectionWidth = createContext<number | null>(null);

export function sidebarLayout(windowWidth: number) {
	const compact = windowWidth < 1000;
	return { compact, width: compact ? 96 : 256 };
}

export function useSectionWidth(scope: "section" | "window" = "section") {
	const { width } = useWindowDimensions();
	const section = use(SectionWidth);
	return scope === "section" ? (section ?? width) : width;
}
