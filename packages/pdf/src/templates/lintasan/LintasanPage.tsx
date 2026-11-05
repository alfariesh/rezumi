import type { TemplatePageProps } from "../../document";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet } from "#react-pdf-renderer";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";

/**
 * Lintasan ("track"): one column with the career as a track. Dated entries hang from a fine vertical line, a ringed
 * dot at each step, and each section title is led by a solid dot on the same axis, so the page reads as one route.
 */
export const LintasanPage = (props: TemplatePageProps) => <OneColumnLayout {...props} template={useLintasan()} />;

const useLintasan = (): LineupTemplate => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const dot = size.body * 0.62;
		const marker = size.body * 1.3;
		const lineInset = (marker - 0.8) / 2;
		const gap = size.body * 0.7;
		const titleSize = size.heading * 0.98;
		const headDot = size.body * 0.72;

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: {
				...base.page,
				paddingHorizontal: metrics.page.paddingHorizontal,
				paddingVertical: metrics.page.paddingVertical,
				rowGap: sectionGap,
			},
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(1) },
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.2,
				color: tokens.ink,
				...tracking(-0.005, titleSize),
			},
			// The title's dot sits on the track's axis, centred in the same width as the entries' markers.
			sectionHeadingContainer: { alignItems: "center", columnGap: gap },
			sectionHeadingMarker: {
				width: headDot,
				height: headDot,
				borderRadius: headDot,
				backgroundColor: tokens.accent,
				marginHorizontal: (marker - headDot) / 2,
			},
			sectionHeadingRule: { borderTopWidth: 0.6, borderTopColor: tokens.hairline },
			sectionItems: { rowGap: metrics.gapY(1.35) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.rtl ? "row" : "row-reverse",
				alignItems: "center",
				columnGap: size.body * 2.4,
				paddingBottom: metrics.gapY(0.8),
			},
			headerTitle: { flex: 1, rowGap: metrics.gapY(1.2) },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.4) },
			headerName: {
				fontSize: size.heading * 2.1,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.02, size.heading * 2.1),
			},
			headerHeadline: { fontSize: size.body * 1.12, color: tokens.accentText, fontWeight: "500" },
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		// As in Jejak: the line runs from the first dot to the end of the list, beneath the dots, drawn by the PDF as the
		// border of a box around the entries on every page they reach.
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
			item: { flexDirection: r.row, columnGap: gap, position: "relative" },
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
			features: { sectionTimeline: true },
			featureStyles: { sectionTimeline: timeline },
			styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } },
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
