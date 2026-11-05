import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Jejak ("trail"): the career as a path. Experience and education hang from a fine vertical line with a small accent
 * dot at each step; the left sidebar keeps the supporting sections.
 */
export const JejakPage = (props: TemplatePageProps) => (
	<TwoColumnLayout {...props} template={useJejak()} sidebarEnd={false} headerPlacement="full-width" />
);

const useJejak = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const margin = metadata.page.marginX;
		const dot = size.body * 0.62;
		const marker = size.body * 1.3;
		const lineInset = (marker - 0.8) / 2;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				fontSize: size.label,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accentText,
				...tracking(0.06, size.label),
			},
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				marginHorizontal: margin,
				paddingBottom: metrics.gapY(2),
				marginBottom: metrics.gapY(2.4),
				borderBottomWidth: 0.6,
				borderBottomColor: tokens.hairline,
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.1) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.35) },
			headerName: {
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2.1),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		// The line runs from the first dot to the end of the list, beneath the dots (each dot hides it where it sits). The
		// PDF draws it as the border of a box around the entries, on every page they reach (`barAsBorder` in `to-forme`);
		// in a browser the list's own z-index keeps it above the page, which stacks a negative one at the root.
		const timeline = StyleSheet.create({
			items: { position: "relative", zIndex: 0 },
			line: {
				position: "absolute",
				top: dot,
				bottom: 0,
				...(r.rtl ? { right: lineInset } : { left: lineInset }),
				width: 0.8,
				backgroundColor: tokens.hairline,
				zIndex: -1,
			},
			item: { flexDirection: r.row, columnGap: size.body * 0.6, position: "relative" },
			marker: { width: marker, alignItems: "center" },
			dot: {
				width: dot,
				height: dot,
				marginTop: size.body * 0.42,
				borderRadius: 999,
				borderWidth: 1.2,
				borderColor: tokens.accent,
				backgroundColor: tokens.background,
			},
			content: { flex: 1, rowGap: metrics.gapY(0.3) },
		});

		return {
			colors,
			features: { sectionTimeline: true, stackSidebarItemHeader: true },
			featureStyles: { sectionTimeline: timeline },
			styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } },
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata]);
};
