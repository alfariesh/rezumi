import type { TemplatePageProps } from "../../document";
import type { Style } from "../../forme/style-types";
import type { LineupTemplate } from "../shared/lineup-page";
import { useMemo } from "react";
import { StyleSheet, View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { OneColumnLayout, useLineupBase } from "../shared/lineup-page";
import { hasTemplatePicture } from "../shared/picture";
import { Heading, SemanticHeaderPicture, SemanticHeaderView, Text } from "../shared/primitives";
import { HeaderContactList } from "../shared/template-base";

type AnggrekStyles = LineupTemplate["styles"] & { ornament: Style };

/**
 * Anggrek ("orchid"): a centred page with the poise of a hotel letterhead. A display serif name over a small tracked
 * headline, a short accent ornament under the contact line, and section titles set between two hairlines.
 */
export const AnggrekPage = (props: TemplatePageProps) => {
	const template = useAnggrek();
	return <OneColumnLayout {...props} template={template} header={<AnggrekHeader styles={template.styles} />} />;
};

const AnggrekHeader = ({ styles }: { styles: AnggrekStyles }) => {
	const { basics, picture } = useRender();
	return (
		<SemanticHeaderView style={styles.header}>
			{hasTemplatePicture(picture) && <SemanticHeaderPicture src={picture.url} style={styles.picture} />}
			<View style={styles.headerTitle}>
				<View style={styles.headerIdentity}>
					<Heading style={styles.headerName}>{basics.name}</Heading>
					<Text style={styles.headerHeadline}>{basics.headline}</Text>
				</View>
				<HeaderContactList styles={styles} />
			</View>
			<View style={styles.ornament} />
		</SemanticHeaderView>
	);
};

const useAnggrek = (): LineupTemplate & { styles: AnggrekStyles } => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.5);
		const hairline: Style = { flexGrow: 1, flexShrink: 1, borderTopWidth: 0.6, borderTopColor: tokens.hairline };
		const titleSize = size.label * 1.12;

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
			// The title sits centred between two hairlines that run to the margins.
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accentText,
				...tracking(0.06, titleSize),
			},
			sectionHeadingContainer: { alignItems: "center", columnGap: size.body * 0.9 },
			sectionHeadingMarker: hairline,
			sectionHeadingRule: hairline,
			sectionItems: { rowGap: metrics.gapY(1.4) },
			item: { rowGap: metrics.gapY(0.3) },
			header: { flexDirection: "column", alignItems: "center", rowGap: metrics.gapY(1.4) },
			headerTitle: { alignItems: "center", rowGap: metrics.gapY(1.1) },
			headerIdentity: { alignItems: "center", textAlign: "center", rowGap: metrics.gapY(0.7) },
			headerName: {
				fontSize: size.heading * 2.4,
				lineHeight: 1.05,
				fontWeight: tokens.headingWeight,
				textAlign: "center",
				...tracking(-0.005, size.heading * 2.4),
			},
			headerHeadline: {
				fontSize: size.label,
				fontWeight: "600",
				textTransform: "uppercase",
				textAlign: "center",
				color: tokens.accentText,
				...tracking(0.06, size.label),
			},
			contactList: {
				flexDirection: r.row,
				flexWrap: "wrap",
				justifyContent: "center",
				columnGap: size.meta * 1.6,
				rowGap: size.meta * 0.35,
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { color: tokens.muted, fontSize: size.meta },
			ornament: { width: size.body * 3, height: 1.2, backgroundColor: tokens.accent },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
