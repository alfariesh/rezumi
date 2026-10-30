import type { GenerateTask, WorkspaceTab } from "@rezumi/schema/career";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ComponentProps, ReactNode } from "react";
import { Widget } from "@heroui-pro/react";
import { Alert, Button, Checkbox, Chip, Spinner, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useRouteContext } from "@tanstack/react-router";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { D2, EASE, EXIT } from "@/libs/motion";

// ---- Time: always in the user's timezone, "Thu 8 Oct, 17:58". Relative time is secondary text. ----

/** The current time, ticking once a minute (countdowns, the Prepare switch to "10 minutes before"). */
export function useNow(intervalMs = 60_000) {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs]);
	return now;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** Formatters in the user's timezone (Settings → General) and interface locale. */
export function useCareerTime() {
	const { i18n } = useLingui();
	const { session } = useRouteContext({ strict: false });
	const timeZone = session?.user.timezone ?? "UTC";
	const locale = i18n.locale;
	const format = (value: Date | string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(new Date(value));

	return {
		timeZone,
		locale,
		/** "Thu 8 Oct, 17:58" */
		when: (value: Date | string) =>
			`${format(value, { weekday: "short", day: "numeric", month: "short" })}, ${format(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`,
		/** "Thu 8 Oct" */
		day: (value: Date | string) => format(value, { weekday: "short", day: "numeric", month: "short" }),
		/** "25 Sep" */
		date: (value: Date | string) => format(value, { day: "numeric", month: "short" }),
		/** "17:58" */
		time: (value: Date | string) => format(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
		format,
		/** "In 23 hours", "Yesterday": the largest whole unit. */
		relative: (value: Date | string, now = new Date()) => {
			const seconds = (new Date(value).getTime() - now.getTime()) / 1000;
			const units: [Intl.RelativeTimeFormatUnit, number][] = [
				["day", 86_400],
				["hour", 3600],
				["minute", 60],
			];
			const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) ?? ["minute", 60];
			return capitalize(
				new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(Math.round(seconds / size), unit),
			);
		},
	};
}

// ---- Undo over confirm: hide now, commit when the toast closes unless Undo was pressed. ----

type UndoInput = {
	description: string;
	/** Runs when the toast closes (after 6 seconds, or when another toast replaces it). */
	commit: () => unknown;
	/** Restores what was hidden. */
	onUndo: () => void;
};

/** Commits waiting on an open undo toast; leaving the page runs them rather than dropping them. */
const pendingCommits = new Set<() => void>();
if (typeof document !== "undefined")
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") for (const flush of pendingCommits) flush();
	});

/**
 * Forget, delete, dismiss, apply: the caller hides or shows the change at once and this commits it when the toast
 * closes (after 6 seconds, when another toast replaces it, or when the page is hidden). Undo restores it instead.
 * ponytail: closing the tab outright can still beat the commit; the change then simply didn't happen.
 */
export function withUndo({ description, commit, onUndo }: UndoInput) {
	let settled = false;
	const settle = (run: boolean) => {
		if (settled) return false;
		settled = true;
		pendingCommits.delete(flush);
		if (run) void commit();
		return true;
	};
	const flush = () => {
		if (settle(true)) toast.close(id);
	};
	const id = toast.add({
		description,
		actionProps: {
			children: t`Undo`,
			onClick: () => {
				if (!settle(false)) return;
				onUndo();
				toast.close(id);
			},
		},
		onClose: () => settle(true),
	});
	pendingCommits.add(flush);
}

/** Tints a row accent-soft and fades it over 1.2s after navigating to it ("View", "Review"). */
export function flash(element: Element | null) {
	if (!element) return;
	element.scrollIntoView({ block: "nearest", behavior: "smooth" });
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		element.animate([{ outline: "2px solid var(--accent)" }, { outline: "2px solid var(--accent)" }], 1200);
		return;
	}
	element.animate([{ backgroundColor: "var(--accent-soft)" }, { backgroundColor: "transparent" }], {
		duration: 1200,
		easing: "ease-out",
	});
}

// ---- Motion: rows that leave collapse; panels that swap crossfade. ----

/** A list row that collapses (height and opacity) when it leaves. Wrap the list in `<AnimatePresence initial={false}>`. */
export function CollapseRow({ children, className, ...props }: ComponentProps<typeof m.div>) {
	return (
		<m.div
			layout="position"
			initial={{ height: 0, opacity: 0 }}
			animate={{ height: "auto", opacity: 1, transition: { duration: D2, ease: EASE } }}
			exit={{ height: 0, opacity: 0, transition: { duration: D2 * EXIT, ease: EASE } }}
			className={cn("overflow-hidden", className)}
			{...props}
		>
			{children}
		</m.div>
	);
}

/** Content that appears in place of other content (actions → success line, text → editor): a 200ms crossfade. */
export function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
	return (
		<AnimatePresence mode="popLayout" initial={false}>
			<m.div
				key={id}
				initial={{ opacity: 0, filter: "blur(2px)" }}
				animate={{ opacity: 1, filter: "blur(0px)", transition: { duration: D2, ease: EASE } }}
				exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: D2 * EXIT, ease: EASE } }}
				className={className}
			>
				{children}
			</m.div>
		</AnimatePresence>
	);
}

// ---- Workspace tabs ----

export const tabLabel = (tab: WorkspaceTab) =>
	({
		fit: t({ message: "Fit", context: "Application workspace tab: how well a job fits your experience" }),
		apply: t`Apply`,
		prepare: t`Prepare`,
		practise: t({ message: "Practice", context: "Application workspace tab: rehearse interview answers" }),
		debrief: t`Debrief`,
		messages: t`Messages`,
		saved: t({ message: "Saved", context: "Application workspace tab: earlier results kept for this job" }),
	})[tab];

// ---- Long AI work: what the coach is doing, one phrase at a time ----

/** What each piece of tab work goes through, in order, before the general phrases take over. */
export const workingSteps = (task: GenerateTask["task"] | "tighten" | "chat") =>
	({
		fit: [t`Reading the posting`, t`Matching your facts`, t`Weighing each requirement`, t`Checking your preferences`],
		briefing: [t`Reading the posting`, t`Picking your stories`, t`Timing the plan`, t`Drafting questions`],
		practice: [t`Reading your answer`, t`Finding what works`, t`Sharpening the opening`],
		debrief: [t`Reading your notes`, t`Checking against Knowledge`, t`Planning your week`],
		reply: [t`Reading the message`, t`Spotting what changed`, t`Drafting a reply`],
		answer: [t`Reading the question`, t`Drafting`],
		tighten: [t`Tightening`, t`Trimming words`],
		chat: [t`Thinking`, t`Reading what you shared`],
	})[task];

type WorkingProps = { steps: string[] };

/**
 * A 10–30 second wait reads as progress: the label moves through the work's steps every 2.2 seconds, then loops
 * through general phrases. Each phrase rises in from below out of a 2px blur as the last one leaves upward; all of
 * them share one grid cell, so a button keeps the width of the longest.
 */
export function Working({ steps }: WorkingProps) {
	const general = [t`Thinking`, t`Double-checking`, t`Polishing`];
	const phrases = [...steps, ...general];
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const id = window.setInterval(() => setTick((current) => current + 1), 2200);
		return () => window.clearInterval(id);
	}, []);
	const at = (n: number) => (n < phrases.length ? n : steps.length + ((n - steps.length) % general.length));
	const shown = at(tick);
	const left = tick > 0 ? at(tick - 1) : -1;

	return (
		<span className="inline-grid">
			<span className="sr-only">{phrases[0]}…</span>
			{phrases.map((phrase, index) => (
				<span
					key={index}
					aria-hidden="true"
					className={cn(
						"col-start-1 row-start-1 transition-[opacity,translate,filter] duration-standard ease-enter motion-reduce:translate-y-0 motion-reduce:blur-none",
						index === shown
							? ""
							: index === left
								? "-translate-y-1 opacity-0 blur-[2px]"
								: "translate-y-1 opacity-0 blur-[2px]",
					)}
				>
					{phrase}…
				</span>
			))}
		</span>
	);
}

// ---- Small parts ----

/** A section title inside a card or panel: 12px semibold muted, Title Case. */
type EyebrowProps = { children: ReactNode; className?: string };
export function Eyebrow({ children, className }: EyebrowProps) {
	return <h2 className={cn("text-xs font-semibold text-muted", className)}>{children}</h2>;
}

type CareerWidgetProps = {
	title: ReactNode;
	/** A leading icon for the title; keep it muted, the title carries the meaning. */
	icon?: IconName | undefined;
	/** A count shown as a quiet chip after the title. */
	count?: number | undefined;
	/** The header's trailing slot: one short note or one small action. */
	trailing?: ReactNode;
	className?: string | undefined;
	contentClassName?: string | undefined;
	children: ReactNode;
	id?: string | undefined;
};

/**
 * One titled group on a Career page: the Pro `Widget` shell (a quiet outer frame around a white content area), the
 * same one the builder panels use. The title labels the region. Nested blocks inside the content use
 * `rounded-xl bg-surface-secondary`; never another bordered card.
 */
export function CareerWidget({
	title,
	icon,
	count,
	trailing,
	className,
	contentClassName,
	children,
	id,
}: CareerWidgetProps) {
	const titleId = useId();
	return (
		<Widget id={id} role="region" aria-labelledby={titleId} className={cn(className)}>
			<Widget.Header>
				<span className="flex min-w-0 items-center gap-2">
					{icon && <Icon name={icon} size={16} className="shrink-0 text-muted" />}
					<Widget.Title id={titleId} role="heading" aria-level={2} className="truncate">
						{title}
					</Widget.Title>
					{count !== undefined && (
						<Chip size="sm" variant="soft" className="tabular-nums">
							{count}
						</Chip>
					)}
				</span>
				{trailing}
			</Widget.Header>
			<Widget.Content className={cn("grid gap-3", contentClassName)}>{children}</Widget.Content>
		</Widget>
	);
}

const statusPill = {
	supported: { icon: "check-circle", color: "success" },
	added: { icon: "check-circle", color: "success" },
	partial: { icon: "circle-half", color: "warning" },
	missing: { icon: "question", color: "default" },
} satisfies Record<string, { icon: IconName; color: "success" | "warning" | "default" }>;

/** Evidence status: colour, icon and words together. */
export function StatusPill({ status }: { status: keyof typeof statusPill }) {
	const labels = {
		supported: t`Supported`,
		added: t`Added by you`,
		partial: t`Partly supported`,
		missing: t`No evidence yet`,
	};
	const { icon, color } = statusPill[status];
	return (
		<Chip size="sm" variant="soft" color={color} className="w-fit gap-1">
			<Icon name={icon} size={14} />
			<Chip.Label>{labels[status]}</Chip.Label>
		</Chip>
	);
}

/** A match in the user's own words, or a fact that's unknown. */
export function InfoChip({ tone, children }: { tone: "match" | "unknown"; children: ReactNode }) {
	return (
		<Chip size="sm" variant="soft" color={tone === "match" ? "success" : "warning"} className="gap-1">
			<Icon name={tone === "match" ? "check" : "question"} size={14} />
			<Chip.Label>{children}</Chip.Label>
		</Chip>
	);
}

type FilterChipProps = { pressed: boolean; onClick: () => void; children: ReactNode; className?: string };

/** A pill toggle for filters and single choices; selected sits on the surface tone, the rest stay quiet. */
export function FilterChip({ pressed, onClick, children, className }: FilterChipProps) {
	return (
		<Button
			size="sm"
			variant={pressed ? "secondary" : "ghost"}
			aria-pressed={pressed}
			onPress={onClick}
			className={cn("touch-target rounded-full", pressed ? "font-semibold" : "text-muted", className)}
		>
			{children}
		</Button>
	);
}

type ContextChipProps = {
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
	label: string;
	tooltip: string;
	/** Shown when off instead of `add`; Web research uses `public`. */
	offIcon?: IconName;
};

/** Composer context switches: on is sunken with a check, off is quiet with add. */
export function ContextChip({ pressed, onPressedChange, label, tooltip, offIcon = "plus" }: ContextChipProps) {
	return (
		<Tooltip>
			<Button
				size="sm"
				variant={pressed ? "secondary" : "outline"}
				aria-pressed={pressed}
				onPress={() => onPressedChange(!pressed)}
				className="touch-target h-7 min-h-0 gap-1 px-2 text-xs"
			>
				<Icon name={pressed ? "check" : offIcon} size={14} />
				{label}
			</Button>
			<Tooltip.Content>{tooltip}</Tooltip.Content>
		</Tooltip>
	);
}

/** Names exactly what an AI action sends, and where. `cost` adds the provider-may-charge callout. */
export function PrivacyLine({
	children,
	cost,
	className,
}: {
	children: ReactNode;
	cost?: boolean;
	className?: string;
}) {
	if (cost)
		return (
			<Alert status="warning" className={cn(className)}>
				<Alert.Indicator>
					<Icon name="key" size={16} />
				</Alert.Indicator>
				<Alert.Content>
					<Alert.Description>{children}</Alert.Description>
				</Alert.Content>
			</Alert>
		);
	return (
		<p className={cn("flex gap-1.5 text-xs leading-[17px] text-muted", className)}>
			<Icon name="lock" size={15} className="shrink-0" />
			<span>{children}</span>
		</p>
	);
}

/** Whole minutes until `at`; negative once it has started. */
export const minutesUntil = (at: Date, now: Date) => Math.round((at.getTime() - now.getTime()) / 60_000);

type CountdownChipProps = { at: Date; now: Date; className?: string };

/** "In 23 hours" on the neutral tone; within the hour it turns warning and reads "Starts in 10 minutes". */
export function CountdownChip({ at, now, className }: CountdownChipProps) {
	const { relative } = useCareerTime();
	const minutes = minutesUntil(at, now);
	const soon = minutes <= 60;
	const label = minutes <= 0 ? t`Started` : soon ? t`Starts in ${minutes} minutes` : relative(at, now);
	return (
		<Chip size="sm" variant="soft" color={soon ? "warning" : "default"} className={cn("w-fit gap-1", className)}>
			<Icon name="clock" size={14} />
			<Chip.Label>{label}</Chip.Label>
			{/* Announced only when it crosses the hour and ten minutes, not every minute. */}
			<span className="sr-only" aria-live="polite">
				{minutes === 60 || minutes === 10 ? label : ""}
			</span>
		</Chip>
	);
}

type MemoryProposalProps = {
	/** "Remember this for future coaching?" or "Remember for Northstar only?" */
	question: string;
	facts: string[];
	state: "pending" | "remembered" | "dismissed";
	/** Shown after Remember: "Added to Knowledge as a preference." */
	remembered: ReactNode;
	onRemember: (selected: number[]) => void;
	onDismiss: () => void;
	busy?: boolean;
};

/** Offers to remember durable facts from an answer. Several facts become a checklist inside one proposal. */
export function MemoryProposal(props: MemoryProposalProps) {
	const [selected, setSelected] = useState(() => props.facts.map((_, index) => index));
	if (props.state === "dismissed") return null;
	return (
		<Swap id={props.state}>
			{props.state === "remembered" ? (
				<p className="flex items-center gap-1.5 text-sm text-success">
					<Icon name="check-circle" size={18} />
					{props.remembered}
				</p>
			) : (
				<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-secondary px-3.5 py-3">
					<Icon name="bookmark-simple" className="shrink-0 text-accent" />
					<div className="grid min-w-0 flex-1 basis-60 gap-1 text-[13px] leading-[19px]">
						<p className="font-semibold">{props.question}</p>
						{props.facts.length === 1 ? (
							<q className="text-muted">{props.facts[0]}</q>
						) : (
							props.facts.map((fact, index) => (
								<Checkbox
									key={fact}
									isSelected={selected.includes(index)}
									onChange={(checked) =>
										setSelected((current) => (checked ? [...current, index] : current.filter((item) => item !== index)))
									}
									className="text-muted"
								>
									<Checkbox.Content className="items-start">
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<q>{fact}</q>
									</Checkbox.Content>
								</Checkbox>
							))
						)}
					</div>
					<div className="flex shrink-0 gap-1">
						<Button
							size="sm"
							variant="secondary"
							isPending={props.busy ?? false}
							isDisabled={selected.length === 0}
							onPress={() => props.onRemember(selected)}
						>
							{props.busy && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Remember</Trans>
						</Button>
						<Button size="sm" variant="ghost" onPress={props.onDismiss}>
							<Trans>Not now</Trans>
						</Button>
					</div>
				</div>
			)}
		</Swap>
	);
}
