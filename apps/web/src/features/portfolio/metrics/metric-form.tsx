import type { MetricFormatChoice } from "./metrics";
import type { PortfolioMetric } from "@rezumi/schema/portfolio/metric";
import type { Draft } from "immer";
import type { ReactNode } from "react";
import { Segment } from "@heroui-pro/react";
import { Button, Description, FieldError, Input, InputGroup, Label, Skeleton, Switch, TextField } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { lazy, Suspense, useState } from "react";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { METRIC_DIRECTIONS, METRIC_DURATION_UNITS } from "@rezumi/schema/portfolio/metric";
import { Icon } from "@rezumi/ui/components/icon";
import { useRemovalFocus } from "../blocks/list-focus";
import { ChoiceSelect, ItemToolbar, moveItem, TextInput } from "../editor/fields";
import { FindMetricsButton } from "./find-metrics";
import {
	applyMetricFormat,
	METRIC_FORMAT_CHOICES,
	metricFormatChoice,
	metricNumberText,
	metricSeriesText,
	newMetric,
	parseMetricNumber,
	parseMetricSeries,
	toggleMinus,
	usesDecimalComma,
} from "./metrics";
import { useDraftText } from "./use-draft-text";
import { IconPicker } from "@/components/input/icon-picker";

const LazyMetricPreview = lazy(() => import("./metric-preview"));

const { text: max } = PORTFOLIO_LIMITS;

/** A metric's progress bar runs over this range, as the metric schema takes it. */
const PROGRESS = { min: 0, max: 100 } as const;

const formatLabel = (choice: MetricFormatChoice) =>
	({
		plain: t`Number`,
		percent: t`Percent (2.8%)`,
		idr: t`Rupiah (Rp1.2m)`,
		usd: t`Dollar ($1.2M)`,
		compact: t`Short number (1.2k, 1.2m)`,
		multiplier: t`Times (3×)`,
		duration: t`Duration`,
		rating: t`Rating (4.8/5)`,
	})[choice];

const unitLabel = (unit: (typeof METRIC_DURATION_UNITS)[number]) =>
	({ hour: t`Hours`, day: t`Days`, week: t`Weeks`, month: t`Months` })[unit];

const directionLabel = (direction: (typeof METRIC_DIRECTIONS)[number]) =>
	({ up: t`Went up`, down: t`Went down`, neutral: t`Stayed the same` })[direction];

type NumberTextProps = {
	label: string;
	value: number | undefined;
	/** A number, or undefined once the field is cleared. Half-typed text never reaches the data. */
	onChange: (value: number | undefined) => void;
	description?: ReactNode;
	placeholder?: string;
	min?: number;
	max?: number;
	/** The field can't be left empty. */
	isRequired?: boolean;
	/** Shows a ± button: the number keypad on iPhones has no minus key. */
	allowNegative?: boolean;
};

/**
 * A number typed the way the app's language writes it ("2,8" in Indonesian), in any script's digits. It keeps what's
 * typed until it reads.
 */
function NumberText({
	label,
	value,
	onChange,
	description,
	placeholder,
	min,
	max: upper,
	isRequired,
	allowNegative = false,
}: NumberTextProps) {
	const locale = i18n.locale;
	const [text, setText] = useDraftText(metricNumberText(value, locale));
	const [touched, setTouched] = useState(false);
	const parsed = parseMetricNumber(text, locale);
	const inRange = parsed !== null && (min === undefined || parsed >= min) && (upper === undefined || parsed <= upper);
	const valid = text.trim() === "" ? !isRequired : inRange;

	const change = (next: string) => {
		setText(next);
		if (next.trim() === "") {
			if (!isRequired) onChange(undefined);
			return;
		}
		const number = parseMetricNumber(next, locale);
		if (number !== null && (min === undefined || number >= min) && (upper === undefined || number <= upper))
			onChange(number);
	};

	const input = { inputMode: "decimal", dir: "ltr", ...(placeholder ? { placeholder } : {}) } as const;

	return (
		<TextField
			fullWidth
			value={text}
			isInvalid={touched && !valid}
			onChange={change}
			onBlur={() => setTouched(true)}
			className="gap-1.5"
		>
			<Label>{label}</Label>
			{allowNegative ? (
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Input {...input} />
					<InputGroup.Suffix className="pe-1">
						<Button
							size="sm"
							variant="ghost"
							isIconOnly
							aria-label={t`Switch between plus and minus`}
							onPress={() => change(toggleMinus(text))}
						>
							<span aria-hidden="true">±</span>
						</Button>
					</InputGroup.Suffix>
				</InputGroup>
			) : (
				<Input variant="secondary" {...input} />
			)}
			{description && <Description>{description}</Description>}
			<FieldError>
				{min !== undefined && upper !== undefined
					? t`Enter a number from ${min} to ${upper}.`
					: t`Enter a number, such as 2.8 or 1200.`}
			</FieldError>
		</TextField>
	);
}

type SeriesTextProps = { value: number[] | undefined; onChange: (value: number[] | undefined) => void };

/**
 * Sparkline values in a row. They reach the data only once 3 to 12 of them read as numbers. The full keyboard: a number
 * keypad has no separators or minus.
 */
function SeriesText({ value, onChange }: SeriesTextProps) {
	const locale = i18n.locale;
	const [text, setText] = useDraftText(metricSeriesText(value, locale));
	const [touched, setTouched] = useState(false);
	const { min, max: most } = PORTFOLIO_LIMITS.sparklinePoints;
	const parsed = parseMetricSeries(text, locale);
	const valid = parsed !== null && (parsed.length === 0 || parsed.length >= min);
	const separator = usesDecimalComma(locale) ? "; " : ", ";

	return (
		<TextField
			fullWidth
			value={text}
			isInvalid={touched && !valid}
			onChange={(next) => {
				setText(next);
				const series = parseMetricSeries(next, locale);
				if (series === null) return;
				if (series.length === 0) onChange(undefined);
				else if (series.length >= min) onChange(series);
			}}
			onBlur={() => setTouched(true)}
			className="gap-1.5"
		>
			<Label>{t`Small chart (optional)`}</Label>
			<Input variant="secondary" inputMode="text" dir="ltr" placeholder={["12", "15", "21", "28"].join(separator)} />
			<Description>{t`${min} to ${most} values in order, oldest first. The page draws them as a small line.`}</Description>
			<FieldError>{t`Enter ${min} to ${most} numbers separated by “${separator.trim()}”.`}</FieldError>
		</TextField>
	);
}

type MetricFieldsProps = {
	metric: PortfolioMetric;
	/** Changes this metric in the draft; `key` merges typing into one undo step. */
	edit: (recipe: (metric: Draft<PortfolioMetric>) => void, key?: string) => void;
	/** The page's language, for the preview. */
	locale: string;
	/** Just the value, format and label (the intro's achievement numbers); the rest stays behind "More". */
	compact?: boolean;
};

/**
 * One metric (`01-desain.md` section 16): the value and how it's written, its label, and optional extras: a change
 * chip, before → after, a small chart, progress, context and an icon. A small preview shows how it reads.
 */
function MetricFields({ metric, edit, locale, compact = false }: MetricFieldsProps) {
	const [more, setMore] = useState(
		() =>
			!compact &&
			Boolean(metric.change || metric.before !== undefined || metric.series || metric.progress !== undefined),
	);
	const kind = metric.value.kind;
	const choice = metricFormatChoice(metric);

	return (
		<div className="grid gap-3">
			<TextInput
				label={t`Label`}
				value={metric.label}
				maxLength={max.metricLabel}
				placeholder={t`Checkout conversion`}
				onChange={(value) =>
					edit((draft) => {
						draft.label = value;
					}, "label")
				}
			/>
			<Segment
				aria-label={t`Kind of value`}
				size="sm"
				selectedKey={kind}
				onSelectionChange={(key) =>
					edit((draft) => {
						if (key === draft.value.kind) return;
						draft.value = key === "text" ? { kind: "text", text: "" } : { kind: "number", number: 0 };
					})
				}
				className="w-fit"
			>
				<Segment.Item id="number">
					<Trans>Number</Trans>
				</Segment.Item>
				<Segment.Item id="text">
					<Trans>Short text</Trans>
				</Segment.Item>
			</Segment>
			{metric.value.kind === "number" ? (
				<div className="grid gap-3 @sm:grid-cols-2">
					<NumberText
						key={`${metric.id}-value`}
						label={t`Value`}
						isRequired
						allowNegative
						value={metric.value.number}
						placeholder="2,8"
						onChange={(value) =>
							edit((draft) => {
								if (value !== undefined) draft.value = { kind: "number", number: value };
							}, "value")
						}
					/>
					<ChoiceSelect
						label={t`Written as`}
						value={choice}
						options={METRIC_FORMAT_CHOICES.map((id) => ({ id, label: formatLabel(id) }))}
						onChange={(next) => edit((draft) => applyMetricFormat(draft as PortfolioMetric, next))}
					/>
					{metric.format === "duration" && (
						<ChoiceSelect
							label={t`Unit`}
							value={metric.unit ?? "month"}
							options={METRIC_DURATION_UNITS.map((id) => ({ id, label: unitLabel(id) }))}
							onChange={(unit) =>
								edit((draft) => {
									draft.unit = unit;
								})
							}
						/>
					)}
				</div>
			) : (
				<TextInput
					label={t`Value`}
					value={metric.value.text}
					maxLength={max.metricText}
					placeholder={t`Top 3`}
					description={t`For results that aren't a number, such as “Top 3” or “#1”.`}
					onChange={(text) =>
						edit((draft) => {
							draft.value = { kind: "text", text };
						}, "value")
					}
				/>
			)}
			<div className="grid grid-cols-2 gap-3">
				<TextInput
					label={t`Before the value`}
					value={metric.prefix ?? ""}
					maxLength={max.metricPrefix}
					placeholder="+"
					onChange={(value) =>
						edit((draft) => {
							if (value) draft.prefix = value;
							else delete draft.prefix;
						}, "prefix")
					}
				/>
				<TextInput
					label={t`After the value`}
					value={metric.suffix ?? ""}
					maxLength={max.metricSuffix}
					placeholder={t`/month`}
					onChange={(value) =>
						edit((draft) => {
							if (value) draft.suffix = value;
							else delete draft.suffix;
						}, "suffix")
					}
				/>
			</div>
			{more ? (
				<MoreMetricFields metric={metric} edit={edit} />
			) : (
				<Button size="sm" variant="ghost" className="w-fit" onPress={() => setMore(true)}>
					<Icon name="plus" size={16} />
					<Trans>Change, before → after, chart, context</Trans>
				</Button>
			)}
			<Suspense fallback={<Skeleton className="h-20 rounded-2xl" />}>
				<LazyMetricPreview metric={metric} locale={locale} />
			</Suspense>
		</div>
	);
}

function MoreMetricFields({ metric, edit }: Pick<MetricFieldsProps, "metric" | "edit">) {
	const change = metric.change;
	return (
		<div className="grid gap-3 border-s-2 border-border ps-3">
			<Switch
				isSelected={Boolean(change)}
				onChange={(on) =>
					edit((draft) => {
						if (on) draft.change = { direction: "up", text: "", good: true };
						else delete draft.change;
					})
				}
			>
				<Switch.Content className="w-full justify-between">
					<span className="text-sm">
						<Trans>Show a change</Trans>
					</span>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
				</Switch.Content>
			</Switch>
			{change && (
				<div className="grid gap-3 @sm:grid-cols-2">
					<ChoiceSelect
						label={t`Direction`}
						value={change.direction}
						options={METRIC_DIRECTIONS.map((id) => ({ id, label: directionLabel(id) }))}
						onChange={(direction) =>
							edit((draft) => {
								if (draft.change) draft.change.direction = direction;
							})
						}
					/>
					<TextInput
						label={t`Change text`}
						value={change.text}
						maxLength={max.metricChange}
						placeholder="+35%"
						onChange={(text) =>
							edit((draft) => {
								if (draft.change) draft.change.text = text;
							}, "change")
						}
					/>
					<ChoiceSelect
						label={t`This change is`}
						value={change.good ? "good" : "bad"}
						options={[
							{ id: "good", label: t`Good news (green)` },
							{ id: "bad", label: t`Bad news (red)` },
						]}
						description={t`A fall can be good, such as faster load times.`}
						onChange={(value) =>
							edit((draft) => {
								if (draft.change) draft.change.good = value === "good";
							})
						}
					/>
				</div>
			)}
			{metric.value.kind === "number" && (
				<NumberText
					key={`${metric.id}-before`}
					label={t`Value before (optional)`}
					allowNegative
					value={metric.before}
					description={t`Shown as before → after bars, in the same format.`}
					onChange={(value) =>
						edit((draft) => {
							if (value === undefined) delete draft.before;
							else draft.before = value;
						}, "before")
					}
				/>
			)}
			<SeriesText
				value={metric.series}
				onChange={(series) =>
					edit((draft) => {
						if (series) draft.series = series;
						else delete draft.series;
					}, "series")
				}
			/>
			<NumberText
				key={`${metric.id}-progress`}
				label={t`Progress (optional)`}
				value={metric.progress}
				min={PROGRESS.min}
				max={PROGRESS.max}
				description={t`From ${PROGRESS.min} to ${PROGRESS.max}, drawn as a bar.`}
				onChange={(value) =>
					edit((draft) => {
						if (value === undefined) delete draft.progress;
						else draft.progress = value;
					}, "progress")
				}
			/>
			<TextInput
				label={t`Context or source (optional)`}
				value={metric.context ?? ""}
				maxLength={max.metricContext}
				placeholder={t`3 months after launch`}
				onChange={(value) =>
					edit((draft) => {
						if (value) draft.context = value;
						else delete draft.context;
					}, "context")
				}
			/>
			<div className="flex items-center gap-3">
				<span className="text-sm font-medium">
					<Trans>Icon (optional)</Trans>
				</span>
				<IconPicker
					aria-label={t`Icon for this metric`}
					value={metric.icon ?? ""}
					onChange={(icon) =>
						edit((draft) => {
							if (icon) draft.icon = icon;
							else delete draft.icon;
						})
					}
				/>
			</div>
		</div>
	);
}

type MetricsEditorProps = {
	metrics: readonly PortfolioMetric[];
	/** Changes the list in the draft. Removing should also drop anything that pointed at the metric. */
	edit: (recipe: (list: Draft<PortfolioMetric>[]) => void, options?: { key?: string; structural?: boolean }) => void;
	/** Where the list's typing merges into undo steps: one key per list. */
	keyPrefix: string;
	locale: string;
	maxItems: number;
	/** The list keeps at least this many (a Metrics block keeps one). */
	minItems?: number;
	compact?: boolean;
	addLabel: ReactNode;
	/** Removing the last of `minItems` metrics does this instead (a Metrics block removes itself). */
	onRemoveLast?: () => void;
};

/** A list of metrics, each with its fields and move/remove buttons, plus "Add". */
export function MetricsEditor({
	metrics,
	edit,
	keyPrefix,
	locale,
	maxItems,
	minItems = 0,
	compact = false,
	addLabel,
	onRemoveLast,
}: MetricsEditorProps) {
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	return (
		<div className="grid gap-3">
			<p className="text-xs text-muted">
				<Trans>Use numbers you can explain in an interview, and say where they come from.</Trans>
			</p>
			{metrics.map((metric, index) => {
				const name = metric.label.trim() || t`Metric ${index + 1}`;
				return (
					<div key={metric.id} {...itemProps} className="grid gap-3 rounded-2xl bg-surface-secondary p-3">
						<MetricFields
							metric={metric}
							compact={compact}
							locale={locale}
							edit={(recipe, key) =>
								edit(
									(list) => {
										const target = list.find((entry) => entry.id === metric.id);
										if (target) recipe(target);
									},
									key ? { key: `${keyPrefix}.${metric.id}.${key}` } : undefined,
								)
							}
						/>
						<ItemToolbar
							name={name}
							index={index}
							count={metrics.length}
							onMove={(to) => edit((list) => moveItem(list, index, to), { structural: true })}
							onRemove={() => {
								if (metrics.length <= minItems) {
									onRemoveLast?.();
									return;
								}
								removed(index);
								edit(
									(list) => {
										list.splice(index, 1);
									},
									{ structural: true },
								);
							}}
						/>
					</div>
				);
			})}
			<div ref={fallbackRef} className="contents">
				{metrics.length < maxItems && (
					<div className="flex flex-wrap gap-2">
						<Button
							variant="secondary"
							className="w-fit"
							onPress={() =>
								edit((list) => {
									list.push(newMetric());
								})
							}
						>
							<Icon name="plus" size={18} />
							{addLabel}
						</Button>
						<FindMetricsButton
							room={maxItems - metrics.length}
							locale={locale}
							onAdd={(found) => edit((list) => void list.push(...found), { structural: true })}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
