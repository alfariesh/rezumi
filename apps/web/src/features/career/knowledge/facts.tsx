import type { Fact } from "../hooks";
import type { FactCategory } from "@rezumi/schema/career";
import type { IconName } from "@rezumi/ui/components/icon";
import type { KeyboardEvent } from "react";
import { EmptyState } from "@heroui-pro/react";
import {
	Button,
	Chip,
	InputGroup,
	Label,
	Modal,
	Separator,
	Skeleton,
	Spinner,
	Switch,
	TextArea,
	TextField,
} from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { memo, useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { factCategorySchema } from "@rezumi/schema/career";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { CareerLoadError } from "../load-state";
import { CareerWidget, CollapseRow, FilterChip, flash, useCareerTime, withUndo } from "../shared";
import { SelectField } from "@/components/input/select-field";
import { WidgetAction } from "@/components/layout/widget-heading";
import { toastError } from "@/libs/error-message";
import { D2, EASE, EXIT } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

const CATEGORIES = factCategorySchema.options;
/** Older rows may carry a retired category; they read as experience. */
const categoryOf = (fact: Fact): FactCategory => factCategorySchema.catch("experience").parse(fact.category);

const categoryLabel = (category: FactCategory) =>
	({
		accomplishment: t`Accomplishment`,
		experience: t`Experience`,
		skill: t`Skill`,
		preference: t`Preference`,
	})[category];

const FACTS_INPUT = { applicationId: null, all: true };

type FactsPageProps = { highlight: string | undefined };

export function FactsPage({ highlight }: FactsPageProps) {
	const queryClient = useQueryClient();
	const queryKey = orpc.career.facts.queryKey({ input: FACTS_INPUT });
	const factQuery = useQuery(orpc.career.facts.queryOptions({ input: FACTS_INPUT }));
	const facts = factQuery.data;
	const [search, setSearch] = useState("");
	const [type, setType] = useState<FactCategory | null>(null);
	const [hidden, setHidden] = useState<string[]>([]);
	const [adding, setAdding] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
		void queryClient.invalidateQueries({ queryKey: orpc.career.stories.key() });
	};
	const patch = (id: string, values: Partial<Fact>) =>
		queryClient.setQueryData<Fact[]>(queryKey, (list) =>
			list?.map((fact) => (fact.id === id ? { ...fact, ...values } : fact)),
		);
	// Only the stable `mutate`: the result object is new each render and would re-render every row.
	const { mutate: updateFact } = useMutation({
		...orpc.career.updateFact.mutationOptions(),
		onError: (error) => toastError(error, t`Couldn't save that change. Try again.`),
		onSettled: refresh,
	});

	// Scroll to and tint the fact a link pointed at, once its row exists.
	const flashed = useRef<string | null>(null);
	useEffect(() => {
		if (!highlight || !facts || flashed.current === highlight) return;
		flashed.current = highlight;
		flash(listRef.current?.querySelector(`[data-fact="${CSS.escape(highlight)}"]`) ?? null);
	}, [highlight, facts]);

	// The input updates at once; the list filters in a deferred render that typing can interrupt.
	const query = useDeferredValue(search).trim().toLocaleLowerCase();
	const visible = (facts ?? []).filter(
		(fact) =>
			!hidden.includes(fact.id) &&
			(type === null || categoryOf(fact) === type) &&
			(!query || `${fact.text} ${sourceLabel(fact)}`.toLocaleLowerCase().includes(query)),
	);

	const setStatus = (fact: Fact, status: "active" | "excluded") => {
		patch(fact.id, { status });
		updateFact({ id: fact.id, status });
	};
	const correct = (fact: Fact, text: string) => {
		patch(fact.id, { text, revisions: [...fact.revisions, { text: fact.text, at: new Date().toISOString() }] });
		updateFact({ id: fact.id, text });
	};
	const share = (fact: Fact) => {
		patch(fact.id, { applicationId: null, company: null });
		updateFact({ id: fact.id, share: true });
	};

	const forget = (fact: Fact) => {
		setHidden((current) => [...current, fact.id]);
		withUndo({
			description: t`Fact forgotten`,
			onUndo: () => setHidden((current) => current.filter((id) => id !== fact.id)),
			commit: () =>
				client.career
					.forgetFact({ id: fact.id })
					.catch((error: unknown) => {
						setHidden((current) => current.filter((id) => id !== fact.id));
						toastError(error, t`Couldn't forget that fact. Try again.`);
					})
					.finally(refresh),
		});
	};

	const added = (fact: Fact) => {
		queryClient.setQueryData<Fact[]>(queryKey, (list) => [fact, ...(list ?? [])]);
		// The new fact shows even when the current search or filter wouldn't match it.
		setSearch("");
		setType(null);
		refresh();
	};

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
					<FilterChip pressed={type === null} onClick={() => setType(null)}>
						<Trans>All</Trans>
					</FilterChip>
					{CATEGORIES.map((category) => (
						<FilterChip key={category} pressed={type === category} onClick={() => setType(category)}>
							{categoryLabel(category)}
						</FilterChip>
					))}
				</div>
				<InputGroup variant="secondary" className="w-full sm:ms-auto sm:w-72">
					<InputGroup.Prefix>
						<Icon name="magnifying-glass" size={18} />
					</InputGroup.Prefix>
					<InputGroup.Input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder={t`Search facts`}
						aria-label={t`Search facts`}
					/>
				</InputGroup>
			</div>

			{!facts && factQuery.isError && <CareerLoadError onRetry={() => void factQuery.refetch()} />}

			{/* The widget shows while facts load, with placeholder rows, so the list lands where its frame already is. */}
			{!(factQuery.isError && !facts) && (
				<CareerWidget
					icon="check-circle"
					title={<Trans>Your facts</Trans>}
					count={facts ? visible.length : undefined}
					trailing={
						<WidgetAction onPress={() => setAdding(true)}>
							<Icon name="plus" size={16} />
							<Trans>Add fact</Trans>
						</WidgetAction>
					}
					contentClassName="gap-0 p-0"
				>
					{!facts ? (
						<FactRowsSkeleton />
					) : (
						<div ref={listRef}>
							<AnimatePresence initial={false}>
								{visible.map((fact) => (
									<FactRow
										key={fact.id}
										fact={fact}
										onStatus={setStatus}
										onCorrect={correct}
										onShare={share}
										onForget={forget}
									/>
								))}
							</AnimatePresence>
							{visible.length === 0 && (
								<EmptyState size="sm">
									<EmptyState.Header>
										<EmptyState.Media variant="icon">
											<Icon name="list-checks" size={20} />
										</EmptyState.Media>
										<EmptyState.Title>{facts.length === 0 ? t`No facts yet` : t`No facts match`}</EmptyState.Title>
										<EmptyState.Description>
											{facts.length === 0 ? t`Use Add fact to start.` : t`Try another word or type.`}
										</EmptyState.Description>
									</EmptyState.Header>
									{type !== null && (
										<EmptyState.Content>
											<Button variant="secondary" size="sm" onPress={() => setType(null)}>
												<Trans>Show all types</Trans>
											</Button>
										</EmptyState.Content>
									)}
								</EmptyState>
							)}
						</div>
					)}
				</CareerWidget>
			)}
			<AddFactDialog open={adding} onOpenChange={setAdding} onAdded={added} />
		</div>
	);
}

/** Fact rows while the list loads: the chips, two lines of text, and the switch at the end, as `FactRow` lays them out. */
function FactRowsSkeleton() {
	return (
		<div role="status">
			<span className="sr-only">{t`Loading`}</span>
			{Array.from({ length: 4 }, (_, index) => (
				<div key={index} className="flex items-start gap-4 border-t border-separator px-4 py-4 first:border-t-0">
					<div className="grid min-w-0 flex-1 gap-2.5">
						<Skeleton className="h-5 w-24 rounded-full" />
						<Skeleton className="h-4 w-4/5 rounded-md" />
						<Skeleton className="h-4 w-1/2 rounded-md" />
					</div>
					<Skeleton className="h-6 w-10 shrink-0 rounded-full" />
				</div>
			))}
		</div>
	);
}

// ---- Add ----

type AddFactDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (fact: Fact) => void };

function AddFactDialog({ open, onOpenChange, onAdded }: AddFactDialogProps) {
	const id = useId();
	const [text, setText] = useState("");
	const [category, setCategory] = useState<FactCategory>("accomplishment");
	const ready = text.trim().length >= 4;
	const save = useMutation({
		...orpc.career.saveFact.mutationOptions(),
		onSuccess: (fact) => {
			setText("");
			onOpenChange(false);
			if (fact) onAdded({ ...fact, company: null, usedBy: { stories: 0, savedItems: 0 } });
		},
		onError: (error) => toastError(error, t`Couldn't add that fact. Try again.`),
	});

	const add = () => {
		const value = text.trim();
		if (value.length < 4 || save.isPending) return;
		save.mutate({
			applicationId: null,
			text: value,
			category,
			source: { kind: "manual", id: crypto.randomUUID(), quote: value },
		});
	};

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size="md">
				<Modal.Dialog aria-describedby={`${id}-description`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							<Trans>Add a fact</Trans>
						</Modal.Heading>
						<p id={`${id}-description`} className="text-sm text-muted">
							<Trans>Something true you can support, such as “I mentored two associate PMs in 2025”.</Trans>
						</p>
					</Modal.Header>
					<Modal.Body>
						<form
							className="grid gap-4"
							onSubmit={(event) => {
								event.preventDefault();
								add();
							}}
						>
							<TextField fullWidth value={text} onChange={setText} autoFocus className="gap-1.5">
								<Label>
									<Trans>Fact</Trans>
								</Label>
								<TextArea
									variant="secondary"
									rows={3}
									maxLength={2000}
									onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
										if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing)
											add();
									}}
								/>
							</TextField>
							<SelectField
								label={<Trans>Type</Trans>}
								value={category}
								onChange={(next) => setCategory(CATEGORIES.find((option) => option === next) ?? category)}
								options={CATEGORIES.map((option) => ({ value: option, label: categoryLabel(option) }))}
							/>
							<Modal.Footer className="p-0">
								<Button variant="secondary" onPress={() => onOpenChange(false)}>
									<Trans>Cancel</Trans>
								</Button>
								<Button type="submit" isDisabled={!ready || save.isPending} isPending={save.isPending}>
									{save.isPending && <Spinner size="sm" color="current" aria-hidden />}
									<Trans>Add fact</Trans>
								</Button>
							</Modal.Footer>
						</form>
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

// ---- Row ----

/** Where a fact came from, in words: "Added by you", "From your resume". */
function sourceLabel(fact: Fact) {
	switch (fact.source.kind) {
		case "manual":
			return t`Added by you`;
		case "user-message":
			return t`From your message`;
		case "resume":
		case "resume-version":
			return t`From your resume`;
		case "letter":
		case "letter-version":
			return t`From your cover letter`;
		case "attachment":
			return t`From a document you attached`;
		case "debrief":
			return t`From a debrief`;
	}
}

type FactRowProps = {
	fact: Fact;
	onStatus: (fact: Fact, status: "active" | "excluded") => void;
	onCorrect: (fact: Fact, text: string) => void;
	onShare: (fact: Fact) => void;
	onForget: (fact: Fact) => void;
};

// Memoized with its motion wrapper: one fact's change re-renders (and re-measures) only its own row.
const FactRow = memo(function FactRow({ fact, onStatus, onCorrect, onShare, onForget }: FactRowProps) {
	const { format } = useCareerTime();
	const [sourceOpen, setSourceOpen] = useState(false);
	const [correcting, setCorrecting] = useState(false);
	const on = fact.status === "active";
	// Names the switch apart from every other row's.
	const excerpt = fact.text.length > 60 ? `${fact.text.slice(0, 60)}…` : fact.text;
	const date = (value: Date | string) => format(value, { day: "numeric", month: "short" });
	const company = fact.company;
	const lastRevision = fact.revisions.at(-1);
	const correctedOn = lastRevision ? date(lastRevision.at) : null;
	const usage =
		fact.usedBy.stories + fact.usedBy.savedItems === 0
			? t`Not used in a story or saved item yet`
			: `${plural(fact.usedBy.stories, { one: "Backs # story", other: "Backs # stories" })} · ${plural(fact.usedBy.savedItems, { one: "used in # saved item", other: "used in # saved items" })}`;

	type Action = { label: string; icon: IconName; onClick: () => void; expanded?: boolean };
	const share: Action[] =
		company === null
			? []
			: [{ label: t`Use for all applications`, icon: "globe-simple", onClick: () => onShare(fact) }];
	const actions: Action[] = [
		{
			label: t`Source`,
			icon: "clock-counter-clockwise",
			onClick: () => setSourceOpen((open) => !open),
			expanded: sourceOpen,
		},
		{ label: t`Correct`, icon: "pencil-simple", onClick: () => setCorrecting(true) },
		...share,
		{ label: t`Forget`, icon: "trash", onClick: () => onForget(fact) },
	];

	return (
		<CollapseRow className="border-t border-separator first:border-t-0">
			<div
				data-fact={fact.id}
				// Off-screen rows skip layout and paint; they stay findable and in the accessibility tree.
				className="flex items-start gap-4 px-4 py-4 [contain-intrinsic-size:auto_112px] [content-visibility:auto]"
			>
				<div className="grid min-w-0 flex-1 gap-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<Chip size="sm" variant="soft">
							{categoryLabel(categoryOf(fact))}
						</Chip>
						{company === null ? (
							<span className="text-xs text-muted">{t`All applications`}</span>
						) : (
							<Chip size="sm" variant="soft" color="accent">
								{t`${company} only`}
							</Chip>
						)}
					</div>

					{correcting ? (
						<Correction
							text={fact.text}
							onCancel={() => setCorrecting(false)}
							onSave={(text) => {
								setCorrecting(false);
								if (text !== fact.text) onCorrect(fact, text);
							}}
						/>
					) : (
						<p
							className={cn(
								"text-sm text-pretty transition-colors duration-quick",
								on ? "text-foreground" : "text-muted",
							)}
						>
							{fact.text}
						</p>
					)}

					<div className="-ms-2 flex flex-wrap gap-0.5">
						{actions.map((action) => (
							<Button
								key={action.label}
								size="sm"
								variant="ghost"
								onPress={action.onClick}
								{...(action.expanded !== undefined && { "aria-expanded": action.expanded })}
								className="touch-target h-7 min-h-0 gap-1 px-2 text-xs text-muted"
							>
								<Icon name={action.icon} size={14} />
								{action.label}
							</Button>
						))}
					</div>

					<AnimatePresence initial={false}>
						{sourceOpen && (
							<m.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1, transition: { duration: D2, ease: EASE } }}
								exit={{ height: 0, opacity: 0, transition: { duration: D2 * EXIT, ease: EASE } }}
								className="overflow-hidden"
							>
								<div className="grid gap-1 rounded-xl bg-background px-3.5 py-3 text-xs text-muted">
									<p className="font-semibold text-foreground">
										{sourceLabel(fact)} · {date(fact.createdAt)}
									</p>
									<p>{usage}</p>
									<p>{correctedOn ? t`Corrected ${correctedOn} · original kept` : t`No corrections`}</p>
									{fact.source.quote && (
										<blockquote className="mt-1 border-s-2 border-separator ps-2 text-foreground">
											{fact.source.quote}
										</blockquote>
									)}
									{fact.revisions.length > 0 && (
										<>
											<Separator className="my-1.5" />
											<ol className="grid gap-1">
												{fact.revisions.toReversed().map((revision) => (
													<li key={revision.at}>
														<span className="tabular-nums">{date(revision.at)}</span> · {revision.text}
													</li>
												))}
											</ol>
										</>
									)}
								</div>
							</m.div>
						)}
					</AnimatePresence>
				</div>

				<div className="flex flex-none items-center gap-2.5 max-sm:flex-col-reverse max-sm:items-end max-sm:gap-1">
					<span className="text-end text-xs whitespace-nowrap text-muted">
						{on ? t`Used in coaching` : t`Not used`}
					</span>
					<Switch
						isSelected={on}
						aria-label={t`Use in coaching: ${excerpt}`}
						onChange={(selected) => onStatus(fact, selected ? "active" : "excluded")}
					>
						<Switch.Content>
							<Switch.Control>
								<Switch.Thumb />
							</Switch.Control>
						</Switch.Content>
					</Switch>
				</div>
			</div>
		</CollapseRow>
	);
});

type CorrectionProps = { text: string; onSave: (text: string) => void; onCancel: () => void };

function Correction({ text, onSave, onCancel }: CorrectionProps) {
	const [draft, setDraft] = useState(text);
	const save = () => draft.trim() && onSave(draft.trim());

	return (
		<div className="grid gap-2">
			<TextArea
				fullWidth
				ref={(element) => {
					// Focused with the cursor at the end, ready to fix the last few words.
					if (!element || element === document.activeElement) return;
					element.focus();
					element.setSelectionRange(element.value.length, element.value.length);
				}}
				aria-label={t`Correct this fact`}
				rows={3}
				maxLength={2000}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") onCancel();
				}}
			/>
			<div className="flex flex-wrap items-center gap-1.5">
				<Button variant="secondary" size="sm" isDisabled={!draft.trim()} onPress={save}>
					<Trans>Save correction</Trans>
				</Button>
				<Button variant="ghost" size="sm" onPress={onCancel}>
					<Trans>Cancel</Trans>
				</Button>
				<span className="text-xs text-muted">
					<Trans>The original stays in the history.</Trans>
				</span>
			</div>
		</div>
	);
}
