// Where active applications went (the web's "Pipeline flow"): one bar per stage on a middle line, bands joining them,
// drawn as a picture people can share (Share picture renders it to a PNG and opens the share sheet). The stage totals
// and each step's conversion are also written out below, so screen readers get them as text.
import type { PipelineStep } from "@rezumi/career/insights";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { InsightCard } from "./insights-cards";
import { sharePng, useStageColors } from "./pipeline-picture";
import { getStageLabel } from "@/features/applications/stages";
import { Button, Text, showToast, useResolveClassNames, useThemeColor } from "@/ui";

// Drawing units (the web's PipelineFlow): bars on a middle line, bands joining them.
const FLOW = { width: 800, height: 340, padX: 40, midY: 190, maxBar: 150, bar: 34 } as const;

type PipelineFlowProps = { active: number; closed: number; steps: PipelineStep[] };

export function PipelineFlow({ active, closed, steps }: PipelineFlowProps) {
	const { t } = useLingui();
	const [surface, foreground, muted] = useThemeColor(["surface", "foreground", "muted"]);
	const stage = useStageColors();
	const bold = useResolveClassNames("font-bold").fontFamily ?? "";
	const regular = useResolveClassNames("font-normal").fontFamily ?? "";
	const svg = useRef<Svg>(null);
	const [sharing, setSharing] = useState(false);
	const slot = (FLOW.width - FLOW.padX * 2) / Math.max(1, steps.length);
	const tallest = Math.max(1, ...steps.map((step) => step.reached));
	const bars = steps.map((step, i) => {
		const height = Math.max((step.reached / tallest) * FLOW.maxBar, 4);
		const x = FLOW.padX + slot * i + slot / 2 - FLOW.bar / 2;
		return {
			...step,
			x,
			top: FLOW.midY - height / 2,
			height,
			cx: x + FLOW.bar / 2,
			color: stage[step.status] || muted,
		};
	});
	const lines = steps.slice(1).flatMap((step, i) => {
		const from = steps[i];
		if (!from) return [];
		const share = step.conversion === null ? "" : ` (${step.conversion}%)`;
		return [t`${getStageLabel(from.status)} → ${getStageLabel(step.status)}: ${step.reached}${share}`];
	});
	const count = plural(active, { one: "# active application", other: "# active applications" });

	const share = () => {
		if (sharing || !svg.current) return;
		setSharing(true);
		svg.current.toDataURL(
			(base64) => {
				void sharePng(base64)
					.catch(() => showToast({ title: t`Couldn't share the picture. Try again.`, variant: "danger" }))
					.finally(() => setSharing(false));
			},
			{ width: FLOW.width * 2, height: FLOW.height * 2 },
		);
	};

	return (
		<InsightCard title={t`Where your applications went`} note={count}>
			<View
				accessible
				accessibilityRole="image"
				accessibilityLabel={t`Pipeline flow`}
				className="aspect-[40/17] w-full"
			>
				<Svg ref={svg} width="100%" height="100%" viewBox={`0 0 ${FLOW.width} ${FLOW.height}`}>
					<Defs>
						{bars.slice(0, -1).map((bar, i) => (
							<LinearGradient key={bar.status} id={`flow-${i}`} x1="0" y1="0" x2="1" y2="0">
								<Stop offset="0" stopColor={bar.color} />
								<Stop offset="1" stopColor={bars[i + 1]?.color ?? bar.color} />
							</LinearGradient>
						))}
					</Defs>
					<Rect width={FLOW.width} height={FLOW.height} rx={16} fill={surface} />
					<SvgText x={FLOW.padX} y={40} fontSize={17} fontFamily={bold} fill={foreground}>
						{t`Job search pipeline`}
					</SvgText>
					<SvgText x={FLOW.padX} y={60} fontSize={12} fontFamily={regular} fill={muted}>
						{count}
					</SvgText>
					{closed > 0 ? (
						<G>
							<Circle cx={FLOW.width - FLOW.padX - 96} cy={54} r={4} fill={stage.closed || muted} />
							<SvgText x={FLOW.width - FLOW.padX - 86} y={58} fontSize={12} fontFamily={regular} fill={muted}>
								{t`${closed} closed`}
							</SvgText>
						</G>
					) : null}
					{/* Bands run centre to centre behind the bars, so the flow has no seam at each stage. */}
					{bars.slice(0, -1).map((bar, i) => {
						const next = bars[i + 1];
						if (!next) return null;
						const mid = (bar.cx + next.cx) / 2;
						const bottom = bar.top + bar.height;
						const nextBottom = next.top + next.height;
						return (
							<Path
								key={bar.status}
								d={`M${bar.cx},${bar.top} C${mid},${bar.top} ${mid},${next.top} ${next.cx},${next.top} L${next.cx},${nextBottom} C${mid},${nextBottom} ${mid},${bottom} ${bar.cx},${bottom} Z`}
								fill={`url(#flow-${i})`}
								opacity={0.32}
							/>
						);
					})}
					{bars.map((bar, i) => (
						<G key={bar.status}>
							<Rect x={bar.x} y={bar.top} width={FLOW.bar} height={bar.height} rx={6} fill={bar.color} />
							<SvgText
								x={bar.cx}
								y={bar.top - 10}
								textAnchor="middle"
								fontSize={15}
								fontFamily={bold}
								fill={foreground}
							>
								{bar.reached}
							</SvgText>
							<SvgText
								x={bar.cx}
								y={FLOW.height - 42}
								textAnchor="middle"
								fontSize={12}
								fontFamily={regular}
								fill={muted}
							>
								{getStageLabel(bar.status)}
							</SvgText>
							{i > 0 && bar.conversion !== null ? (
								<SvgText
									x={bar.cx}
									y={FLOW.height - 26}
									textAnchor="middle"
									fontSize={11}
									fontFamily={regular}
									fill={muted}
								>
									{`${bar.conversion}%`}
								</SvgText>
							) : null}
						</G>
					))}
				</Svg>
			</View>
			<View className="gap-1">
				{lines.map((line) => (
					<Text key={line} size="sm" tone="muted">
						{line}
					</Text>
				))}
				{closed > 0 ? <Text size="sm" tone="muted">{t`Closed: ${closed}`}</Text> : null}
			</View>
			<Button variant="secondary" size="sm" className="self-start" isDisabled={sharing} onPress={share}>
				<Button.Label>{t`Share picture`}</Button.Label>
			</Button>
		</InsightCard>
	);
}
