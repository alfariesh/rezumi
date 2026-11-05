import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { TwoColumnLayout, useLineupBase } from "../shared/lineup-page";
import { hasTemplatePicture } from "../shared/picture";
import { Heading, SemanticHeaderPicture, SemanticHeaderView, Text } from "../shared/primitives";
import { HeaderContactList } from "../shared/template-base";

/**
 * Senja ("dusk"): the creative page. A block of the accent anchors the top corner (framing the portrait, if any) beside
 * an oversized name; two columns follow with the sidebar on the right.
 */
export const SenjaPage = (props: TemplatePageProps) => {
	const template = useSenja();
	return (
		<TwoColumnLayout
			{...props}
			template={template}
			sidebarEnd
			headerPlacement="full-width"
			header={<SenjaHeader styles={template.styles} />}
		/>
	);
};

const SenjaHeader = ({ styles }: { styles: LineupTemplate["styles"] & { block?: Style } }) => {
	const { basics, picture } = useRender();
	return (
		<SemanticHeaderView style={styles.header}>
			<View style={styles.block}>
				{hasTemplatePicture(picture) && <SemanticHeaderPicture src={picture.url} style={styles.picture} />}
			</View>
			<View style={styles.headerTitle}>
				<View style={styles.headerIdentity}>
					<Heading style={styles.headerName}>{basics.name}</Heading>
					<Text style={styles.headerHeadline}>{basics.headline}</Text>
				</View>
				<HeaderContactList styles={styles} />
			</View>
		</SemanticHeaderView>
	);
};

const useSenja = (): LineupTemplate & { styles: { block: Style } } => {
	const { r, metrics, base, tokens, colors, tracking, lineup, metadata, picture } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.4);
		const { marginX, marginY } = metadata.page;
		const blockWidth = Math.max(picture.size + size.body * 2.4, size.body * 9);

		const styles = StyleSheet.create({
			...base,
			...lineup,
			page: { ...base.page, paddingVertical: metrics.page.paddingVertical },
			sectionGroup: { flexDirection: "column", rowGap: sectionGap },
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				fontSize: size.heading * 1.05,
				fontWeight: tokens.headingWeight,
				lineHeight: 1.15,
				color: tokens.ink,
				...tracking(-0.01, size.heading * 1.05),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.55 },
			sectionHeadingMarker: { width: size.body * 0.55, height: size.body * 0.55, backgroundColor: tokens.accent },
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: {
				flexDirection: r.row,
				alignItems: "stretch",
				columnGap: size.body * 2.2,
				marginTop: -marginY,
				marginBottom: metrics.gapY(2.6),
				paddingRight: r.rtl ? 0 : marginX,
				paddingLeft: r.rtl ? marginX : 0,
			},
			block: {
				width: blockWidth,
				minHeight: size.heading * 8,
				backgroundColor: tokens.accent,
				alignItems: "center",
				justifyContent: "flex-end",
				paddingBottom: size.body * 1.2,
				...(r.rtl ? { borderBottomLeftRadius: size.body * 2 } : { borderBottomRightRadius: size.body * 2 }),
			},
			headerTitle: { flex: 1, justifyContent: "flex-end", rowGap: metrics.gapY(1.2), paddingTop: marginY },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.6) },
			headerName: {
				fontSize: size.heading * 2.6,
				lineHeight: 0.98,
				fontWeight: tokens.headingWeight,
				...tracking(-0.03, size.heading * 2.6),
			},
			headerHeadline: {
				fontSize: size.label * 1.05,
				fontWeight: "600",
				textTransform: "uppercase",
				color: tokens.accentText,
				...tracking(0.06, size.label),
			},
			contactList: { flexDirection: r.row, flexWrap: "wrap", columnGap: size.meta * 1.7, rowGap: size.meta * 0.35 },
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
		});

		return {
			colors,
			features: { stackSidebarItemHeader: true },
			styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } },
		};
	}, [r, metrics, base, tokens, colors, tracking, lineup, metadata, picture]);
};
