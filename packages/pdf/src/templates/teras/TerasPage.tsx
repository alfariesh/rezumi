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
import { mixColors } from "../shared/tokens";

type TerasStyles = LineupTemplate["styles"] & { headerTop: Style };

/**
 * Teras ("veranda"): friendly but formal. The portrait and name open the page, the contact details follow in a softly
 * tinted bar across it, and each section title is a small accent label over a soft thick rule.
 */
export const TerasPage = (props: TemplatePageProps) => {
	const template = useTeras();
	return <OneColumnLayout {...props} template={template} header={<TerasHeader styles={template.styles} />} />;
};

const TerasHeader = ({ styles }: { styles: TerasStyles }) => {
	const { basics, picture } = useRender();
	return (
		<SemanticHeaderView style={styles.header}>
			<View style={styles.headerTop}>
				{hasTemplatePicture(picture) && <SemanticHeaderPicture src={picture.url} style={styles.picture} />}
				<View style={styles.headerTitle}>
					<View style={styles.headerIdentity}>
						<Heading style={styles.headerName}>{basics.name}</Heading>
						<Text style={styles.headerHeadline}>{basics.headline}</Text>
					</View>
				</View>
			</View>
			<HeaderContactList styles={styles} />
		</SemanticHeaderView>
	);
};

const useTeras = (): LineupTemplate & { styles: TerasStyles } => {
	const { r, metrics, base, tokens, colors, tracking, lineup } = useLineupBase();

	return useMemo(() => {
		const { size } = tokens;
		const sectionGap = metrics.gapY(2.3);
		const titleSize = size.label * 1.08;

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
			section: { flexDirection: "column", rowGap: metrics.gapY(0.9) },
			sectionHeading: {
				fontSize: titleSize,
				fontWeight: tokens.headingWeight,
				textTransform: "uppercase",
				lineHeight: 1.2,
				color: tokens.accentText,
				paddingBottom: size.body * 0.3,
				borderBottomWidth: 2,
				borderBottomColor: mixColors(tokens.accent, tokens.background, 0.18),
				...tracking(0.05, titleSize),
			},
			sectionItems: { rowGap: metrics.gapY(1.3) },
			item: { rowGap: metrics.gapY(0.3) },
			header: { flexDirection: "column", rowGap: metrics.gapY(1.6) },
			headerTop: { flexDirection: r.row, alignItems: "center", columnGap: size.body * 1.6 },
			headerTitle: { flex: 1 },
			headerIdentity: { ...r.headerIdentity, rowGap: metrics.gapY(0.45) },
			headerName: {
				fontSize: size.heading * 2.05,
				lineHeight: 1.1,
				fontWeight: tokens.headingWeight,
				...tracking(-0.015, size.heading * 2.05),
			},
			headerHeadline: { fontSize: size.body * 1.1, color: tokens.accentText, fontWeight: "500" },
			// The contact details run in a tinted bar across the page.
			contactList: {
				flexDirection: r.row,
				flexWrap: "wrap",
				columnGap: size.meta * 1.8,
				rowGap: size.meta * 0.45,
				backgroundColor: tokens.accentSoft,
				borderRadius: size.body * 0.45,
				paddingVertical: size.body * 0.6,
				paddingHorizontal: size.body * 0.9,
			},
			contactItem: { flexDirection: r.row, alignItems: "center", columnGap: size.meta * 0.45 },
			contactText: { fontSize: size.meta },
		});

		return { colors, styles: { ...styles, icon: { size: size.meta, color: tokens.accentText } } };
	}, [r, metrics, base, tokens, colors, tracking, lineup]);
};
