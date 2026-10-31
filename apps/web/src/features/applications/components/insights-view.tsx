import type { ApplicationSummary } from "../types";
import { ChartTooltip, KPIGroup, Widget } from "@heroui-pro/react";
import { BarChart } from "@heroui-pro/react/bar-chart";
import { KPI } from "@heroui-pro/react/kpi";
import { Button, Skeleton } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "motion/react";
import { useId, useRef } from "react";
import { Cell, LabelList } from "recharts";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { computeInsights, computeOutcomes, computeTimeline } from "../insights";
import { getStageColor, getStageLabel } from "../stages";
import { orpc } from "@/libs/orpc/client";

/** The page's shape while stats load: the funnel, the two figures, then the charts. */
export function InsightsSkeleton() {
	return (
		<div className="flex max-w-4xl flex-col gap-4">
			<Skeleton className="h-64 rounded-3xl" />
			<Skeleton className="h-28 rounded-2xl" />
			<Skeleton className="h-80 rounded-3xl" />
		</div>
	);
}

type ChartWidgetProps = {
	title: string;
	description?: string;
	children: React.ReactNode;
};

function ChartWidget({ title, description, children }: ChartWidgetProps) {
	const titleId = useId();
	return (
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header>
				<div className="flex flex-col gap-0.5">
					<Widget.Title id={titleId} role="heading" aria-level={2}>
						{title}
					</Widget.Title>
					{description ? <Widget.Description>{description}</Widget.Description> : null}
				</div>
			</Widget.Header>
			<Widget.Content>{children}</Widget.Content>
		</Widget>
	);
}

const LABEL_PROPS = { fill: "var(--muted)", fontSize: 12 } as const;

export function ApplicationInsights({ applications }: { applications: ApplicationSummary[] }) {
	const { i18n } = useLingui();
	const reduceMotion = useReducedMotion();
	const { data } = useQuery(orpc.applications.stats.queryOptions({}));
	const { data: documents } = useQuery(orpc.documents.list.queryOptions({ input: { trashed: false } }));

	// A resume is tailored for an application when it was made for it (Copy for a job).
	const madeFor = new Map(
		(documents ?? []).flatMap((document) => (document.application ? [[document.id, document.application.id]] : [])),
	);
	const outcomes = computeOutcomes(applications, (application) =>
		Boolean(application.resumeId && madeFor.get(application.resumeId) === (application as ApplicationSummary).id),
	);

	// Sending history includes applications that later closed, and excludes jobs never sent.
	const timeline = computeTimeline(applications);

	if (!data) return <InsightsSkeleton />;

	const insights = computeInsights(data.byStage);

	if (outcomes.sent === 0) {
		return (
			<p className="py-16 text-center text-sm text-muted">
				<Trans>Once you've sent a few applications, this shows how far they get and how quickly people reply.</Trans>
			</p>
		);
	}

	const numberFormat = new Intl.NumberFormat(i18n.locale);
	const formatCount = (value: unknown) => numberFormat.format(Number(value));
	const animate = !reduceMotion;

	const funnelData = outcomes.funnel.map((row) => ({
		status: row.status,
		label: getStageLabel(row.status),
		reached: row.reached,
	}));
	const timelineData = timeline.map((bucket) => ({ label: bucket.label, count: bucket.count }));
	const sourceData = data.bySource.map((row) => ({ source: row.source, count: row.count }));

	return (
		<div className="flex max-w-4xl flex-col gap-4 overflow-y-auto pb-6">
			<ChartWidget
				title={t`How far applications get`}
				description={t`Counts every application that reached each stage, including ones now closed.`}
			>
				{/* The chart is a picture; the list below carries the same numbers for assistive tech. */}
				<BarChart
					aria-hidden="true"
					data={funnelData}
					height={outcomes.funnel.length * 40 + 16}
					layout="vertical"
					margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
				>
					<BarChart.XAxis hide type="number" />
					<BarChart.YAxis axisLine={false} dataKey="label" tickLine={false} type="category" width={80} />
					<BarChart.Bar
						barSize={16}
						dataKey="reached"
						isAnimationActive={animate}
						name={t`Reached`}
						radius={[0, 8, 8, 0]}
					>
						{funnelData.map((row) => (
							<Cell key={row.status} fill={getStageColor(row.status)} />
						))}
						<LabelList dataKey="reached" formatter={formatCount} position="right" {...LABEL_PROPS} />
					</BarChart.Bar>
					<BarChart.Tooltip
						content={({ active, label, payload }) => {
							if (!active || !payload?.length) return null;
							return (
								<ChartTooltip>
									<ChartTooltip.Header>{label}</ChartTooltip.Header>
									{payload.map((entry) => (
										<ChartTooltip.Item key={String(entry.dataKey)}>
											<ChartTooltip.Indicator
												color={
													entry.payload?.status ? getStageColor(entry.payload.status) : (entry.fill ?? "var(--chart-3)")
												}
											/>
											<ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
											<ChartTooltip.Value>{formatCount(entry.value)}</ChartTooltip.Value>
										</ChartTooltip.Item>
									))}
								</ChartTooltip>
							);
						}}
					/>
				</BarChart>
				<ol className="sr-only">
					{outcomes.funnel.map((row) => (
						<li key={row.status}>
							{getStageLabel(row.status)}: {formatCount(row.reached)}
						</li>
					))}
				</ol>
			</ChartWidget>

			<KPIGroup>
				<KPI>
					<KPI.Header>
						<KPI.Title>
							<Trans>Heard back</Trans>
						</KPI.Title>
					</KPI.Header>
					<KPI.Content>
						<KPI.Value
							className="text-3xl"
							locale={i18n.locale}
							maximumFractionDigits={0}
							style="percent"
							value={outcomes.heardBack / outcomes.sent}
						/>
					</KPI.Content>
				</KPI>
				<KPIGroup.Separator />
				<KPI>
					<KPI.Header>
						<KPI.Title>
							<Trans>Median to first reply</Trans>
						</KPI.Title>
					</KPI.Header>
					<KPI.Content>
						{outcomes.medianDaysToReply === null ? (
							<dd className="text-3xl font-semibold text-muted">—</dd>
						) : (
							<KPI.Value
								className="text-3xl"
								locale={i18n.locale}
								maximumFractionDigits={0}
								style="unit"
								unit="day"
								value={outcomes.medianDaysToReply}
							/>
						)}
					</KPI.Content>
				</KPI>
			</KPIGroup>

			{outcomes.tailored.sent + outcomes.base.sent > 0 && (
				<Widget role="region" aria-labelledby="insights-tailored">
					<Widget.Header>
						<Widget.Title id="insights-tailored" role="heading" aria-level={2}>
							<Trans>Tailored vs. base resume</Trans>
						</Widget.Title>
					</Widget.Header>
					<Widget.Content>
						<p className="text-sm leading-6 text-muted">
							<Trans>
								{outcomes.tailored.replied} of {outcomes.tailored.sent} tailored applications got a reply;{" "}
								{outcomes.base.replied} of {outcomes.base.sent} sent with another resume.
							</Trans>{" "}
							{outcomes.tailored.sent + outcomes.base.sent < 10 && <Trans>Small numbers, but worth noticing.</Trans>}
						</p>
					</Widget.Content>
				</Widget>
			)}

			<PipelineFlow insights={insights} />

			<div className="grid gap-4 lg:grid-cols-2">
				{/* application velocity over time */}
				<ChartWidget title={t`Applications over time`} description={t`Applications sent per week (last 8 weeks)`}>
					<BarChart aria-hidden="true" data={timelineData} height={180}>
						<BarChart.Grid vertical={false} />
						<BarChart.XAxis dataKey="label" tickMargin={8} />
						<BarChart.YAxis allowDecimals={false} tickFormatter={formatCount} width={28} />
						<BarChart.Bar
							dataKey="count"
							fill="var(--chart-3)"
							isAnimationActive={animate}
							name={t`Applications`}
							radius={[4, 4, 0, 0]}
						/>
						<BarChart.Tooltip content={<BarChart.TooltipContent valueFormatter={formatCount} />} />
					</BarChart>
					<ol className="sr-only">
						{timeline.map((bucket) => (
							<li key={bucket.label}>
								{bucket.label}: {formatCount(bucket.count)}
							</li>
						))}
					</ol>
				</ChartWidget>

				{/* sources */}
				<ChartWidget title={t`Where applications come from`} description={t`Count by source`}>
					{sourceData.length === 0 ? (
						<p className="text-sm text-muted">
							<Trans>No source data yet.</Trans>
						</p>
					) : (
						<>
							<BarChart
								aria-hidden="true"
								data={sourceData}
								height={sourceData.length * 36 + 16}
								layout="vertical"
								margin={{ top: 4, right: 32, bottom: 4, left: 0 }}
							>
								<BarChart.XAxis hide type="number" />
								<BarChart.YAxis axisLine={false} dataKey="source" tickLine={false} type="category" width={96} />
								<BarChart.Bar
									barSize={12}
									dataKey="count"
									fill="var(--muted)"
									isAnimationActive={animate}
									name={t`Applications`}
									radius={[0, 8, 8, 0]}
								>
									<LabelList dataKey="count" formatter={formatCount} position="right" {...LABEL_PROPS} />
								</BarChart.Bar>
								<BarChart.Tooltip content={<BarChart.TooltipContent valueFormatter={formatCount} />} />
							</BarChart>
							<ol className="sr-only">
								{sourceData.map((row) => (
									<li key={row.source}>
										{row.source}: {formatCount(row.count)}
									</li>
								))}
							</ol>
						</>
					)}
				</ChartWidget>
			</div>
		</div>
	);
}

// Vibrant, dark-mode palette for the pipeline snapshot — brighter than the muted board stage
// colors so the chart pops both on screen (preview) and in the exported PNG.
const FLOW_COLORS = ["#a5b4fc", "#818cf8", "#22d3ee", "#fbbf24", "#34d399"];
const FLOW_BG = "#0a0a0f";
const FLOW_REJECTED = "#fb7185";
const FLOW_FONT = "var(--font-sans)";
// RxR mark ~18px wide in the 256-unit icon viewBox (the mark's glyphs span y ≈ 36–220).
const ICON_SIZE = 20;

function toBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
}

// A rasterized SVG (loaded as an <img>) can't reach the page's webfonts, so the exported PNG falls
// back to a system font unless the font is inlined. Find the UI woff2 the app already
// loaded (basic-latin subset covers the chart's English labels), base64 it, and return an
// @font-face the export SVG can embed. Returns null on any failure so export still proceeds.
async function uiFontFace(): Promise<string | null> {
	const uiFamily = getComputedStyle(document.documentElement)
		.getPropertyValue("--font-sans")
		.split(",")[0]
		?.trim()
		.replace(/["']/g, "");
	if (!uiFamily) return null;
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList | undefined;
		try {
			rules = sheet.cssRules;
		} catch {
			continue; // cross-origin stylesheet — not readable
		}
		for (const rule of Array.from(rules ?? [])) {
			if (!(rule instanceof CSSFontFaceRule)) continue;
			const family = rule.style.getPropertyValue("font-family").replace(/["']/g, "");
			if (family !== uiFamily) continue;
			if ((rule.style.getPropertyValue("font-style") || "normal") !== "normal") continue;
			// Keep only the basic-latin subset (covers the chart's English labels). CSSOM normalizes
			// its range to "U+0-FF" — i.e. "U+" then all-zero start — so match that, not "U+0000".
			const range = rule.style.getPropertyValue("unicode-range");
			if (range && !/U\+0{1,4}-/i.test(range)) continue;
			const url = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+\.woff2)["']?\)/)?.[1];
			if (!url) continue;
			try {
				const res = await fetch(url);
				if (!res.ok) return null;
				const buffer = await res.arrayBuffer();
				return `@font-face{font-family:"${family}";font-style:normal;font-weight:${rule.style.getPropertyValue("font-weight")};src:url(data:font/woff2;base64,${toBase64(buffer)}) format("woff2");}`;
			} catch {
				return null;
			}
		}
	}
	return null;
}

// A funnel-flow snapshot (the shareable picture). Hand-drawn SVG with inline fills so it exports to
// PNG without any library. Rendered dark + vibrant so the on-screen preview matches the export;
// the "Tracked using Rezumi" mark is injected only when exporting.
function PipelineFlow({ insights }: { insights: ReturnType<typeof computeInsights> }) {
	const svgRef = useRef<SVGSVGElement>(null);
	const titleId = useId();
	const W = 800;
	const H = 340;
	const padX = 40;
	const midY = 190;
	const maxBarH = 150;
	const barW = 34;
	const n = insights.funnel.length;
	const slotW = (W - padX * 2) / n;
	const maxReached = Math.max(1, ...insights.funnel.map((f) => f.reached));

	const bars = insights.funnel.map((f, i) => {
		const h = Math.max((f.reached / maxReached) * maxBarH, 4);
		const x = padX + slotW * i + slotW / 2 - barW / 2;
		const yTop = midY - h / 2;
		return { ...f, color: FLOW_COLORS[i] ?? f.color, x, yTop, h, cx: x + barW / 2 };
	});

	const exportPng = async () => {
		const svg = svgRef.current;
		if (!svg) return;
		// Reveal the export-only watermark on a clone so the on-screen chart stays clean.
		const clone = svg.cloneNode(true) as SVGSVGElement;
		clone.style.fontFamily = getComputedStyle(svg).fontFamily;
		for (const el of clone.querySelectorAll<SVGElement>("[data-export-only]")) el.style.display = "";
		// Inline the UI font so the rasterized PNG uses the same type as the app.
		const fontFace = await uiFontFace();
		if (fontFace) {
			const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
			styleEl.textContent = fontFace;
			clone.querySelector("defs")?.prepend(styleEl);
		}
		const xml = new XMLSerializer().serializeToString(clone);
		const svg64 = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(xml)))}`;
		const image = new Image();
		image.onload = () => {
			const scale = 3; // high-resolution output
			const canvas = document.createElement("canvas");
			canvas.width = W * scale;
			canvas.height = H * scale;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.fillStyle = FLOW_BG;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			const link = document.createElement("a");
			link.download = "pipeline-flow.png";
			link.href = canvas.toDataURL("image/png");
			link.click();
			toast.add({ type: "success", description: t`Exported pipeline-flow.png` });
		};
		image.src = svg64;
	};

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<Widget.Header className="items-start gap-4">
				<Widget.Title id={titleId} role="heading" aria-level={2}>
					<Trans>Where your applications went</Trans>
				</Widget.Title>
				<Button size="sm" variant="secondary" onPress={() => void exportPng()}>
					<Icon name="download-simple" size={16} />
					<Trans>Export PNG</Trans>
				</Button>
			</Widget.Header>
			<Widget.Content>
				<svg
					ref={svgRef}
					viewBox={`0 0 ${W} ${H}`}
					className="w-full rounded-xl"
					style={{ fontFamily: FLOW_FONT }}
					role="img"
					aria-label={t`Pipeline flow`}
				>
					<defs>
						{bars.slice(0, -1).map((bar, i) => {
							const next = bars[i + 1];
							if (!next) return null;
							return (
								<linearGradient key={`grad-${bar.label}`} id={`flow-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
									<stop offset="0%" stopColor={bar.color} />
									<stop offset="100%" stopColor={next.color} />
								</linearGradient>
							);
						})}
					</defs>

					<rect x={0} y={0} width={W} height={H} rx={16} fill={FLOW_BG} />

					<text x={padX} y={40} fontSize={17} fontWeight={700} fill="#fafafa">
						{t`Job search pipeline`}
					</text>
					<text x={padX} y={60} fontSize={12} fill="#71717a">
						{plural(insights.total, { one: "# active application", other: "# active applications" })}
					</text>
					{insights.closed > 0 && (
						<g>
							<circle cx={W - padX - 96} cy={54} r={4} fill={FLOW_REJECTED} />
							<text x={W - padX - 86} y={58} fontSize={12} fill="#a1a1aa">
								{t`${insights.closed} closed`}
							</text>
						</g>
					)}

					{/* connecting bands — drawn center-to-center so they pass *behind* the bars (rendered
				    next, on top), leaving a single continuous flow with no seam at each stage. */}
					{bars.slice(0, -1).map((bar, i) => {
						const next = bars[i + 1];
						if (!next) return null;
						const x1 = bar.cx;
						const x2 = next.cx;
						const cxa = (x1 + x2) / 2;
						return (
							<path
								key={`band-${bar.label}`}
								d={`M${x1},${bar.yTop} C${cxa},${bar.yTop} ${cxa},${next.yTop} ${x2},${next.yTop} L${x2},${next.yTop + next.h} C${cxa},${next.yTop + next.h} ${cxa},${bar.yTop + bar.h} ${x1},${bar.yTop + bar.h} Z`}
								fill={`url(#flow-grad-${i})`}
								opacity={0.32}
							/>
						);
					})}

					{/* bars + labels */}
					{bars.map((bar, i) => (
						<g key={`bar-${bar.label}`}>
							<rect x={bar.x} y={bar.yTop} width={barW} height={bar.h} rx={6} fill={bar.color} />
							<text x={bar.cx} y={bar.yTop - 10} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fafafa">
								{bar.reached}
							</text>
							<text x={bar.cx} y={H - 42} textAnchor="middle" fontSize={12} fontWeight={500} fill="#e4e4e7">
								{bar.label}
							</text>
							{i > 0 && (
								<text x={bar.cx} y={H - 26} textAnchor="middle" fontSize={11} fill={bar.color}>
									{bar.conv}
								</text>
							)}
						</g>
					))}

					{/* export-only watermark: the Rezumi mark, bottom-right, 8px from each edge.
				    Paths are apps/web/public/icon/dark.svg verbatim. */}
					<svg
						data-export-only
						style={{ display: "none" }}
						x={W - 8 - ICON_SIZE}
						y={H - 8 - ICON_SIZE}
						width={ICON_SIZE}
						height={ICON_SIZE}
						viewBox="17.25 -12.7 36 36"
						fill="#0485F7"
					>
						<path
							opacity="0.4"
							transform="translate(48 0) scale(-1 1)"
							d="M20.434 3.63c.415.415.772.773 1.027 1.096.271.345.489.728.531 1.202a1.74 1.74 0 0 1 0 .403c-.042.473-.26.856-.531 1.201-.255.324-.612.682-1.027 1.097l-1.122 1.122-5.061-5.061 1.122-1.122c.415-.415.773-.773 1.097-1.027.345-.272.727-.489 1.201-.531a1.74 1.74 0 0 1 .403 0c.474.042.856.259 1.202.531.323.254.743.674 1.158 1.089ZM18.251 10.811l-7.813 7.814c-.769.769-1.303 1.303-1.994 1.59-.692.286-1.448.286-2.536.286H4.251a.75.75 0 0 1-.75-.75v-1.658c0-1.087-.001-1.843.285-2.535.287-.691.822-1.226 1.591-1.995l7.814-7.812 5.06 5.06Z"
						/>
						<path
							transform="translate(48 0) scale(-1 1)"
							d="M18.074 2.009c.474.043.856.259 1.202.53.323.255.743.674 1.158 1.089s.772.773 1.027 1.097c.271.345.489.727.531 1.201.012.134.012.27 0 .404-.042.474-.26.856-.531 1.202-.255.323-.612.681-1.027 1.096l-1.122 1.121-5.061-5.06 1.122-1.121c.415-.415.773-.774 1.097-1.029.345-.271.727-.487 1.201-.53.134-.012.269-.012.403 0Z"
						/>
						<path d="M38.712-9.872c11.815 1.207 15.452 14.746 5.807 20.069-.759.365-1.213.531-2.016.804-1.865-1.7-3.756-3.524-5.587-5.267 2.788-.019 5.934-1.596 5.817-4.581-.27-6.946-11.958-2.771-16.048-4.479-2.069-.862-6.033-5.023-7.686-6.585z" />
					</svg>
				</svg>
			</Widget.Content>
		</Widget>
	);
}
