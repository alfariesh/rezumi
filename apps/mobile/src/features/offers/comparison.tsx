// Two saved offers side by side: the offers are the columns and each term a row, with the user's requirements last.
// On a phone the two columns share the width; each cell reads as the term, the company and the value with its notes.
import type { Cell, CellNote } from "./cells";
import type { OfferClock } from "./clock";
import type { Offer } from "./queries";
import type { Requirement } from "./requirements";
import type { CareerProfileData } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { companyOf, offerCells, rows } from "./cells";
import { OfferHeader } from "./offer-header";
import { requirementsFor } from "./requirements";
import { Card, Icon, Text, cx } from "@/ui";

export type Side = "a" | "b";

type ComparisonProps = {
	offers: readonly Offer[];
	left: Offer | undefined;
	right: Offer | undefined;
	profile: CareerProfileData | undefined;
	clock: OfferClock;
	onChoose: (side: Side, id: string) => void;
};

export function Comparison({ offers, left, right, profile, clock, onChoose }: ComparisonProps) {
	const { t } = useLingui();
	const pair = [left, right] as const;
	const columns = pair.map((offer, i) => (offer ? offerCells(offer, i === 0 ? right : left, clock) : undefined));
	const requirements = pair.map((offer) => (offer && profile ? requirementsFor(offer, profile, clock) : []));
	return (
		<Card className="p-0">
			<View className="flex-row gap-3 p-4">
				<OfferHeader
					offer={left}
					offers={offers}
					otherId={right?.id}
					clock={clock}
					onChoose={(id) => onChoose("a", id)}
				/>
				<OfferHeader
					offer={right}
					offers={offers}
					otherId={left?.id}
					clock={clock}
					onChoose={(id) => onChoose("b", id)}
				/>
			</View>
			{rows().map((row) => (
				<View key={row.key} className="gap-1.5 border-t border-separator px-4 py-3" testID={`offer-row-${row.key}`}>
					<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
						{row.label}
					</Text>
					<View className="flex-row gap-3">
						{pair.map((offer, i) => (
							<CellView
								key={offer?.id ?? i}
								term={row.label}
								company={offer ? companyOf(offer) : undefined}
								cell={columns[i]?.[row.key]}
							/>
						))}
					</View>
				</View>
			))}
			{requirements.some((list) => list.length > 0) ? (
				<View className="gap-1.5 rounded-b-3xl border-t border-separator bg-surface-secondary px-4 py-3">
					<Text size="xs" weight="semibold" accessibilityRole="header">
						{t`Your requirements`}
					</Text>
					<View className="flex-row gap-3">
						{requirements.map((list, i) => (
							<View key={pair[i]?.id ?? i} className="flex-1 gap-1.5">
								{list.map((item) => (
									<RequirementLine key={item.text} item={item} />
								))}
							</View>
						))}
					</View>
				</View>
			) : null}
		</Card>
	);
}

type CellViewProps = { term: string; company: string | undefined; cell: Cell | undefined };

function CellView({ term, company, cell }: CellViewProps) {
	if (!cell || !company) return <View className="flex-1" />;
	const spoken = [`${term}, ${company}: ${cell.value}`, ...cell.notes.map((note) => note.text)].join(". ");
	return (
		<View accessible accessibilityLabel={spoken} className="flex-1 gap-1">
			<Text tabular weight={cell.strong ? "semibold" : "normal"} tone={cell.known ? "default" : "muted"}>
				{cell.value}
			</Text>
			{cell.notes.map((note) => (
				<NoteLine key={note.text} note={note} />
			))}
		</View>
	);
}

const noteTone = { better: "success", warn: "warning", muted: "muted" } as const;

type NoteLineProps = { note: CellNote };

function NoteLine({ note }: NoteLineProps) {
	const tone = noteTone[note.tone];
	return (
		<View
			className={cx(
				"flex-row items-start gap-1",
				note.tone === "better" && "self-start rounded-full bg-success-soft px-2 py-0.5",
			)}
		>
			<Icon name={note.icon} size={14} tone={tone} />
			<Text size="xs" tone={tone} className="shrink">
				{note.text}
			</Text>
		</View>
	);
}

type RequirementLineProps = { item: Requirement };

/** The color and icon say met, missed or unknown; screen readers hear it in words. */
function RequirementLine({ item }: RequirementLineProps) {
	const { t } = useLingui();
	const tone = item.met === true ? "success" : item.met === false ? "danger" : "warning";
	const spoken =
		item.met === true
			? t`Meets: ${item.text}`
			: item.met === false
				? t`Misses: ${item.text}`
				: t`Can't tell: ${item.text}`;
	return (
		<View accessible accessibilityLabel={spoken} className="flex-row items-start gap-1.5">
			<Icon
				name={item.met === true ? "check-circle" : item.met === false ? "x-circle" : "question"}
				size={16}
				tone={tone}
			/>
			<Text size="sm" tone={tone} className="shrink">
				{item.text}
			</Text>
		</View>
	);
}
