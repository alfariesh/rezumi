import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import type { Draft } from "immer";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { applyMetricFormat, metricFormatChoice, metricNumberText, parseMetricNumber } from "@rezumi/portfolio/editing";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Field, Order } from "./fields";
import { useEditor } from "./store";
import { Button, ListGroup, ListRow, Sheet } from "@/ui";

type MetricProps = {
	metric: PortfolioMetric;
	change: (recipe: (metric: Draft<PortfolioMetric>) => void, key: string) => void;
	remove?: (() => void) | undefined;
};

export function Metric(props: MetricProps) {
	const { store } = useEditor();
	const revision = store((state) => state.revision);
	return <MetricFields key={revision} {...props} />;
}

function MetricFields({ metric, change, remove }: MetricProps) {
	const { t, i18n } = useLingui();
	const [formats, setFormats] = useState(false);
	const [value, setValue] = useState(() =>
		metric.value.kind === "text" ? metric.value.text : metricNumberText(metric.value.number, i18n.locale),
	);
	const choices = {
		plain: t`Number`,
		percent: t`Percent`,
		idr: t`Rupiah`,
		usd: t`US dollar`,
		compact: t`Compact number`,
		multiplier: t`Multiplier`,
		duration: t`Duration`,
		rating: t`Rating`,
	} as const;
	return (
		<View className="gap-2 rounded-lg border border-border p-3">
			<Field
				label={t`Metric label`}
				value={metric.label}
				max={PORTFOLIO_LIMITS.text.metricLabel}
				onChange={(text) =>
					change((draft) => {
						draft.label = text;
					}, `${metric.id}:label`)
				}
			/>
			<Field
				label={t`Value`}
				value={value}
				max={PORTFOLIO_LIMITS.text.metricText}
				onChange={(text) => {
					setValue(text);
					const number = parseMetricNumber(text, i18n.locale);
					change((draft) => {
						draft.value = number === null ? { kind: "text", text } : { kind: "number", number };
					}, `${metric.id}:value`);
				}}
			/>
			<View className="flex-row flex-wrap items-center gap-2">
				<Button size="sm" variant="secondary" onPress={() => setFormats(true)}>
					{choices[metricFormatChoice(metric)]}
				</Button>
				<Order remove={remove} />
			</View>
			<Sheet isOpen={formats} onOpenChange={setFormats} title={t`Number format`} closeLabel={t`Close`}>
				<ListGroup>
					{(Object.keys(choices) as (keyof typeof choices)[]).map((format) => (
						<ListRow
							key={format}
							title={choices[format]}
							onPress={() => {
								change((draft) => applyMetricFormat(draft, format), `${metric.id}:format`);
								setFormats(false);
							}}
						/>
					))}
				</ListGroup>
			</Sheet>
		</View>
	);
}
