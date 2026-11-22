import type { CheckIssue } from "./messages";
import type { PageMapNode } from "@rezumi/pdf/page-map";
import type { CheckTarget } from "@rezumi/resume/check";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { isSameTarget, placeIssuePins, toTarget } from "@rezumi/resume/check";
import { PageImage } from "@/preview/page-image";
import { Text, cx, size } from "@/ui";

type PagePinsProps = {
	page: { index: number; uri: string; width: number; height: number };
	/** Layout points per PDF point. */
	scale: number;
	blocks: readonly PageMapNode[];
	issues: readonly CheckIssue[];
	selected: string | null;
	/** Blocks that mention the picked job-match term, tinted. */
	highlighted: readonly CheckTarget[];
	onSelect: (key: string) => void;
};

const PIN = { warning: "bg-warning", danger: "bg-danger" } as const;
const PIN_TEXT = { warning: "text-warning-foreground", danger: "text-danger-foreground" } as const;
const OUTLINE = { warning: "border-warning", danger: "border-danger" } as const;

/** The top of a pin's 44 pt target: level with its block, the nth further pin on that block a whole target lower. */
export const pinTop = (blockTop: number, stack: number) => Math.max(0, blockTop - size.hit / 4) + stack * size.hit;

/**
 * One page with Check's marks: a numbered pin in the margin for each open issue (warning, or danger for errors),
 * the picked issue's block outlined, and the blocks mentioning a job-match term tinted.
 */
export function PagePins({ page, scale, blocks, issues, selected, highlighted, onSelect }: PagePinsProps) {
	const { t } = useLingui();
	const width = page.width * scale;
	const height = page.height * scale;
	const frame = { width, height };
	const pins = placeIssuePins(issues, blocks, page.index);
	const tinted = blocks.filter(
		(block) => block.page === page.index && highlighted.some((target) => isSameTarget(toTarget(block), target)),
	);
	const box = (block: PageMapNode) => ({
		left: block.x * scale,
		top: block.y * scale,
		width: block.width * scale,
		height: block.height * scale,
	});

	return (
		<View className="overflow-hidden rounded-lg bg-paper shadow-surface" style={frame}>
			<PageImage uri={page.uri} style={frame} accessibilityLabel={t`Resume page ${page.index + 1}`} />
			{tinted.map((block) => (
				<View
					key={`tint:${block.key}`}
					pointerEvents="none"
					className="absolute rounded-md bg-accent/20"
					style={box(block)}
				/>
			))}
			{pins.map(({ issue, block, stack }) => {
				const picked = issue.key === selected;
				return (
					<View key={issue.key} pointerEvents="box-none" className="absolute inset-0">
						{picked ? (
							<View
								pointerEvents="none"
								className={cx("absolute rounded-md border-2", OUTLINE[issue.tone])}
								style={box(block)}
							/>
						) : null}
						{/* A 44 pt target in the left margin, level with the block; more issues on it stack below, one full
						    target apart so no two hit areas overlap. */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t`Issue ${issue.number}: ${issue.title}`}
							accessibilityState={{ selected: picked }}
							onPress={() => onSelect(issue.key)}
							testID={`pin-${issue.key}`}
							className="absolute items-center justify-center"
							style={[
								{
									left: Math.max(0, block.x * scale - size.hit),
									top: pinTop(block.y * scale, stack),
									width: size.hit,
									height: size.hit,
								},
							]}
						>
							<View
								className={cx(
									"size-6 items-center justify-center rounded-full border-2 border-paper",
									PIN[issue.tone],
									picked && "scale-110",
								)}
							>
								<Text size="xs" weight="bold" tabular className={PIN_TEXT[issue.tone]}>
									{String(issue.number)}
								</Text>
							</View>
						</Pressable>
					</View>
				);
			})}
		</View>
	);
}
