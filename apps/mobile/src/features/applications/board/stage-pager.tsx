// Phones show one stage at a time: this bar names it (dot, name, count) between Previous and Next, with a dot per
// stage underneath so the person knows where they are; any dot jumps to its stage.
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Pressable, View } from "react-native";
import { getStageLabel } from "@/features/applications/stages";
import { IconButton, StageDot, StageLabel, Text, cx } from "@/ui";

/** The dots are 32 pt tall; the slop brings each to 44 pt. */
const DOT_SLOP = { top: 6, bottom: 6 };

type StagePagerProps = {
	columns: readonly { status: ApplicationStatus; data: readonly unknown[] }[];
	page: number;
	onPage: (page: number) => void;
};

export function StagePager({ columns, page, onPage }: StagePagerProps) {
	const { t } = useLingui();
	const current = columns[page];
	const previous = columns[page - 1];
	const next = columns[page + 1];
	if (!current) return null;
	const label = getStageLabel(current.status);
	const count = current.data.length;
	return (
		<View className="gap-1 px-2" testID="board-pager">
			<View className="flex-row items-center gap-1">
				<IconButton
					icon="caret-left"
					variant="ghost"
					label={previous ? t`Previous stage: ${getStageLabel(previous.status)}` : t`Previous stage`}
					isDisabled={!previous}
					onPress={() => onPage(page - 1)}
					testID="board-previous"
				/>
				<View
					accessible
					accessibilityRole="header"
					accessibilityLabel={plural(count, {
						one: `${label}, # application. Stage ${page + 1} of ${columns.length}`,
						other: `${label}, # applications. Stage ${page + 1} of ${columns.length}`,
					})}
					className="flex-1 flex-row items-center justify-center gap-2"
				>
					<StageLabel stage={current.status} label={label} />
					<Text size="xs" tone="muted" tabular>
						{count}
					</Text>
				</View>
				<IconButton
					icon="caret-right"
					variant="ghost"
					label={next ? t`Next stage: ${getStageLabel(next.status)}` : t`Next stage`}
					isDisabled={!next}
					onPress={() => onPage(page + 1)}
					testID="board-next"
				/>
			</View>
			<View className="flex-row justify-center">
				{columns.map((column, index) => (
					<Pressable
						key={column.status}
						onPress={() => onPage(index)}
						accessibilityRole="button"
						accessibilityState={{ selected: index === page }}
						accessibilityLabel={getStageLabel(column.status)}
						hitSlop={DOT_SLOP}
						className="h-8 w-11 items-center justify-center"
					>
						<View className={cx("rounded-full", index === page ? "opacity-100" : "opacity-40")}>
							<StageDot stage={column.status} size={index === page ? "md" : "sm"} />
						</View>
					</Pressable>
				))}
			</View>
		</View>
	);
}
