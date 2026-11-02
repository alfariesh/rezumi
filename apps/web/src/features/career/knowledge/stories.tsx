import type { Fact, Story } from "../hooks";
import { EmptyState } from "@heroui-pro/react";
import {
	Button,
	buttonVariants,
	Checkbox,
	Chip,
	Input,
	Separator,
	Spinner,
	TextArea,
	Tooltip,
	Typography,
} from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { Fragment, memo, useState } from "react";
import * as z from "zod";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { useSessionDraft } from "../hooks";
import { CareerLoadError, CareerLoading } from "../load-state";
import { CareerWidget, CollapseRow, Eyebrow, Swap, useNow, withUndo } from "../shared";
import { collectInterviews, upcomingInterviews } from "@/features/applications/interviews";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH2 } from "@/libs/typography";

type PartKey = "situation" | "task" | "action" | "result" | "reflection";

/** STARR, in order. Situation, Task and Action are required; Result and Reflection stay blank until supported. */
const parts = () =>
	[
		{ key: "situation", letter: "S", label: t`Situation`, placeholder: t`What was happening before you started?` },
		{ key: "task", letter: "T", label: t`Task`, placeholder: t`What were you responsible for?` },
		{ key: "action", letter: "A", label: t`Action`, placeholder: t`What did you do, specifically?` },
		{
			key: "result",
			letter: "R",
			label: t`Result`,
			placeholder: t`What changed? Leave blank if you can’t support it.`,
		},
		{ key: "reflection", letter: "R", label: t`Reflection`, placeholder: t`What would you do differently?` },
	] satisfies { key: PartKey; letter: string; label: string; placeholder: string }[];

const REQUIRED: PartKey[] = ["situation", "task", "action"];

/** A backing fact was corrected after the story was last saved. */
const factChanged = (story: Story, facts: Map<string, Fact>) =>
	story.data.factIds.some((id) => {
		const at = facts.get(id)?.revisions.at(-1)?.at;
		return at !== undefined && new Date(at) > new Date(story.updatedAt);
	});

type StoriesPageProps = { storyId: string | undefined; edit: boolean };

export function StoriesPage({ storyId, edit }: StoriesPageProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const storyQuery = useQuery(orpc.career.stories.queryOptions({ input: { applicationId: null } }));
	const factQuery = useQuery(orpc.career.facts.queryOptions({ input: { applicationId: null, all: true } }));
	const stories = storyQuery.data;
	const facts = factQuery.data;
	const [hidden, setHidden] = useState<string[]>([]);

	if ((!stories && storyQuery.isError) || (!facts && factQuery.isError))
		return (
			<CareerLoadError
				onRetry={() => {
					void storyQuery.refetch();
					void factQuery.refetch();
				}}
			/>
		);
	if (!stories || !facts) return <CareerLoading />;

	const factsById = new Map((facts ?? []).map((fact) => [fact.id, fact]));
	const list = stories.filter((story) => !hidden.includes(story.id));
	const selected = storyId ? list.find((story) => story.id === storyId) : edit ? undefined : list[0];
	const editing = edit && (selected !== undefined || !storyId);

	const open = (id: string | undefined, editMode = false) =>
		void navigate({
			to: "/dashboard/career/knowledge/stories/{-$storyId}",
			params: { storyId: id ?? undefined },
			search: editMode ? { edit: true } : {},
		});

	const remove = (story: Story) => {
		setHidden((current) => [...current, story.id]);
		open(undefined);
		withUndo({
			description: t`Story deleted`,
			onUndo: () => setHidden((current) => current.filter((id) => id !== story.id)),
			commit: () =>
				client.career
					.deleteStory({ id: story.id })
					.catch((error: unknown) => {
						setHidden((current) => current.filter((id) => id !== story.id));
						toastError(error, t`Couldn't delete that story. Try again.`);
					})
					.finally(() => {
						void queryClient.invalidateQueries({ queryKey: orpc.career.stories.key() });
						void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
					}),
		});
	};

	return (
		<div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
			<CareerWidget
				title={<Trans>Your stories</Trans>}
				count={list.length}
				trailing={
					<Link
						to="/dashboard/career/knowledge/stories/{-$storyId}"
						params={{ storyId: undefined }}
						search={{ edit: true }}
						aria-current={editing && !selected ? "page" : undefined}
						className={buttonVariants({ variant: editing && !selected ? "primary" : "outline", size: "sm" })}
					>
						<Trans>Add a story</Trans>
					</Link>
				}
				contentClassName="gap-1 p-2"
			>
				<AnimatePresence initial={false}>
					{list.map((story, index) => (
						<StoryCard
							key={story.id}
							first={index === 0}
							story={story}
							selected={story.id === selected?.id}
							changed={factChanged(story, factsById)}
						/>
					))}
				</AnimatePresence>
				<p className="px-2 pt-2 pb-1 text-xs text-muted">
					<Trans>
						Situation, Task, Action, Result, Reflection. Link each story to facts you can support; leave unknown
						outcomes blank.
					</Trans>
				</p>
			</CareerWidget>

			{storyId && !selected ? (
				<EmptyState role="status" className="rounded-2xl bg-surface-secondary">
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="book-open" size={20} />
						</EmptyState.Media>
						<EmptyState.Title>
							<Trans>Story not found</Trans>
						</EmptyState.Title>
						<EmptyState.Description>
							<Trans>It may have been deleted. Choose another story or add a new one.</Trans>
						</EmptyState.Description>
					</EmptyState.Header>
					<EmptyState.Content>
						<Button variant="secondary" onPress={() => open(undefined)}>
							<Trans>Back to stories</Trans>
						</Button>
					</EmptyState.Content>
				</EmptyState>
			) : selected || editing ? (
				<CareerWidget
					title={editing ? selected ? <Trans>Edit story</Trans> : <Trans>New story</Trans> : <Trans>Story</Trans>}
					trailing={
						!editing && selected ? (
							<div className="flex items-center gap-1">
								<PractiseButton storyId={selected.id} />
								<Button variant="outline" size="sm" onPress={() => open(selected.id, true)}>
									<Trans>Edit</Trans>
								</Button>
							</div>
						) : undefined
					}
					contentClassName="p-5 sm:p-6"
				>
					<Swap id={editing ? "edit" : "read"}>
						{editing ? (
							<StoryEditor
								key={selected?.id ?? "new"}
								story={selected}
								facts={facts ?? []}
								onSaved={(id) => open(id)}
								onCancel={() => open(selected?.id)}
								onDelete={selected ? () => remove(selected) : undefined}
							/>
						) : (
							selected && <StoryReader story={selected} facts={factsById} />
						)}
					</Swap>
				</CareerWidget>
			) : (
				<EmptyState className="rounded-2xl bg-surface-secondary">
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="book-open" size={20} />
						</EmptyState.Media>
						<EmptyState.Title>
							<Trans>No stories yet</Trans>
						</EmptyState.Title>
						<EmptyState.Description>
							<Trans>
								Write one about something you did, in five parts. Leave a part blank until you can support it.
							</Trans>
						</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			)}
		</div>
	);
}

// ---- List ----

type StoryCardProps = { story: Story; selected: boolean; changed: boolean; first: boolean };

// Memoized with its motion wrapper: picking a story re-renders only the two cards whose selection changed.
const StoryCard = memo(function StoryCard({ story, selected, changed, first }: StoryCardProps) {
	const filled = parts().filter((part) => story.data[part.key].trim()).length;
	const factCount = story.data.factIds.length;

	return (
		<CollapseRow>
			{!first && <Separator className="mx-3 my-1 w-auto" />}
			<Link
				to="/dashboard/career/knowledge/stories/{-$storyId}"
				params={{ storyId: story.id }}
				aria-current={selected ? "page" : undefined}
				className={cn("grid gap-2 rounded-xl p-3 text-start", selected ? "bg-default" : "hover:bg-default/60")}
			>
				<span className="text-sm leading-5 font-semibold">{story.data.title}</span>
				<span className="text-xs text-muted tabular-nums">
					<Trans>{filled} of 5 parts</Trans> · {plural(factCount, { one: "# fact", other: "# facts" })}
				</span>
				<PartTiles story={story} />
				{changed && (
					<Chip size="sm" variant="soft" color="warning" className="w-fit gap-1">
						<Icon name="warning" size={14} />
						<Chip.Label>
							<Trans>A fact changed. Review this story.</Trans>
						</Chip.Label>
					</Chip>
				)}
			</Link>
		</CollapseRow>
	);
});

function PartTiles({ story }: { story: Story }) {
	return (
		<span aria-hidden="true" className="flex gap-[3px]">
			{parts().map((part) => (
				<span
					key={part.key}
					title={part.label}
					className={cn(
						"grid h-5 w-[22px] place-items-center rounded-md text-xs font-semibold",
						story.data[part.key].trim() ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-muted",
					)}
				>
					{part.letter}
				</span>
			))}
		</span>
	);
}

// ---- Reader ----

const partTile = (filled: boolean) =>
	cn(
		"grid size-7 place-items-center rounded-lg text-sm font-semibold",
		filled ? "bg-accent-soft text-accent-soft-foreground" : "bg-default text-muted",
	);

type StoryReaderProps = { story: Story; facts: Map<string, Fact> };

function StoryReader({ story, facts }: StoryReaderProps) {
	const backing = story.data.factIds.flatMap((id) => facts.get(id) ?? []);

	return (
		<div className="grid gap-5">
			<header className="grid gap-2">
				<Typography type="h4" render={renderAsH2} className="text-pretty">
					{story.data.title}
				</Typography>
				{story.data.tags.length > 0 ? (
					<div className="flex flex-wrap gap-1">
						{story.data.tags.map((tag) => (
							<Chip key={tag} size="sm" variant="soft">
								{tag}
							</Chip>
						))}
					</div>
				) : (
					<p className="text-sm text-muted">
						<Trans>No tags yet</Trans>
					</p>
				)}
			</header>

			<div className="grid">
				{parts().map((part, index) => {
					const text = story.data[part.key].trim();
					return (
						<Fragment key={part.key}>
							{index > 0 && <Separator />}
							<div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3.5 py-3.5">
								<span aria-hidden="true" className={partTile(Boolean(text))}>
									{part.letter}
								</span>
								<div className="grid min-w-0 gap-1">
									<h3 className="text-sm font-semibold text-muted">{part.label}</h3>
									{text ? (
										<p className="text-base text-pretty whitespace-pre-line">{text}</p>
									) : (
										<p className="text-sm text-muted italic">
											<Trans>Not recorded yet. Leave it blank until you can support it.</Trans>
										</p>
									)}
								</div>
							</div>
						</Fragment>
					);
				})}
			</div>

			<div className="grid gap-2">
				<Eyebrow>
					<Trans>Backed by</Trans>
				</Eyebrow>
				{backing.map((fact) => (
					<Link
						key={fact.id}
						to="/dashboard/career/knowledge/facts"
						search={{ highlight: fact.id }}
						className="flex items-start gap-2.5 rounded-xl bg-default px-3 py-2.5 text-sm leading-5 hover:bg-default-hover"
					>
						<Icon name="link-simple-horizontal" size={16} className="mt-0.5 shrink-0 text-accent" />
						<span className={cn(fact.status !== "active" && "text-muted")}>{fact.text}</span>
					</Link>
				))}
				{backing.length === 0 && (
					<p className="flex items-center gap-1.5 text-sm text-warning-soft-foreground">
						<Icon name="warning" size={16} />
						<Trans>No supporting facts. Link one before using this story.</Trans>
					</p>
				)}
			</div>
		</div>
	);
}

/** Practise this story aloud in the workspace of the next upcoming interview. */
type PractiseButtonProps = { storyId: string };

function PractiseButton({ storyId }: PractiseButtonProps) {
	const navigate = useNavigate();
	const now = useNow();
	const { data: applications, isPending, isError, refetch } = useQuery(applicationsListQueryOptions());
	const next = upcomingInterviews(collectInterviews(applications ?? []), now)[0];
	const label = <Trans context="Button: rehearse interview answers">Practice</Trans>;
	if (isError)
		return (
			<div role="alert">
				<Button variant="secondary" size="sm" onPress={() => void refetch()}>
					<Trans>Couldn't load interviews. Retry</Trans>
				</Button>
			</div>
		);
	if (isPending)
		return (
			<Button variant="ghost" size="sm" isDisabled>
				<Trans>Loading interviews…</Trans>
			</Button>
		);

	if (!next)
		return (
			<Tooltip>
				{/* Focusable while disabled (aria-disabled), so hover and keyboard still reach the tooltip. */}
				<Button variant="ghost" size="sm" aria-disabled className="cursor-not-allowed text-muted hover:bg-transparent">
					{label}
				</Button>
				<Tooltip.Content>
					<Trans>Add an interview first</Trans>
				</Tooltip.Content>
			</Tooltip>
		);

	return (
		<Button
			variant="ghost"
			size="sm"
			onPress={() =>
				void navigate({
					to: "/dashboard/applications/$applicationId/{-$tab}",
					params: { applicationId: next.application.id, tab: "practise" },
					search: { speak: true, story: storyId },
				})
			}
		>
			{label}
		</Button>
	);
}

// ---- Editor ----

const storyDraftSchema = z.object({
	title: z.string(),
	situation: z.string(),
	task: z.string(),
	action: z.string(),
	result: z.string(),
	reflection: z.string(),
	tags: z.string(),
	factIds: z.array(z.string()),
});

type StoryEditorProps = {
	story: Story | undefined;
	facts: Fact[];
	onSaved: (id: string) => void;
	onCancel: () => void;
	onDelete: (() => void) | undefined;
};

function StoryEditor({ story, facts, onSaved, onCancel, onDelete }: StoryEditorProps) {
	const queryClient = useQueryClient();
	const {
		value: draft,
		setValue: setDraft,
		clear,
	} = useSessionDraft(
		`story:${story?.id ?? "new"}`,
		{
			title: story?.data.title ?? "",
			situation: story?.data.situation ?? "",
			task: story?.data.task ?? "",
			action: story?.data.action ?? "",
			result: story?.data.result ?? "",
			reflection: story?.data.reflection ?? "",
			tags: story?.data.tags.join(", ") ?? "",
			factIds: story?.data.factIds ?? [],
		},
		(value) => {
			const result = storyDraftSchema.safeParse(value);
			return result.success ? result.data : undefined;
		},
	);
	const [tried, setTried] = useState(false);
	// A shared story can only rest on shared facts; switched-off ones are listed but can't be ticked.
	const shared = facts.filter((fact) => fact.applicationId === null);
	const usable = new Set(shared.filter((fact) => fact.status === "active").map((fact) => fact.id));

	const save = useMutation({
		...orpc.career.saveStory.mutationOptions(),
		onSuccess: (row) => {
			clear();
			// Newest first, as the server orders them, so the reader opens on it before the refetch lands.
			queryClient.setQueryData<Story[]>(orpc.career.stories.queryKey({ input: { applicationId: null } }), (list) => [
				row,
				...(list ?? []).filter((item) => item.id !== row.id),
			]);
			void queryClient.invalidateQueries({ queryKey: orpc.career.stories.key() });
			void queryClient.invalidateQueries({ queryKey: orpc.career.facts.key() });
			onSaved(row.id);
		},
		onError: (error) => toastError(error, t`Couldn't save the story. Try again.`),
	});

	const missingPart = REQUIRED.some((key) => !draft[key].trim());
	const missingTitle = !draft.title.trim();
	const problem = missingPart
		? t`Add what happened before you can save.`
		: missingTitle
			? t`Give the story a title before you can save.`
			: null;

	const submit = () => {
		setTried(true);
		if (problem) return;
		save.mutate({
			...(story ? { id: story.id } : {}),
			applicationId: null,
			title: draft.title.trim(),
			situation: draft.situation.trim(),
			task: draft.task.trim(),
			action: draft.action.trim(),
			result: draft.result.trim(),
			reflection: draft.reflection.trim(),
			factIds: draft.factIds.filter((id) => usable.has(id)),
			tags: [...new Set(draft.tags.split(",").map((tag) => tag.trim()))].filter(Boolean).slice(0, 20),
		});
	};

	const toggleFact = (id: string, checked: boolean) =>
		setDraft((current) => ({
			...current,
			factIds: checked ? [...current.factIds, id] : current.factIds.filter((item) => item !== id),
		}));

	return (
		<form
			className="grid gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<div className="grid gap-2">
				{/* A textarea so a long title wraps as it does in the reader; Enter doesn't add a line. */}
				<TextArea
					fullWidth
					variant="secondary"
					rows={1}
					value={draft.title}
					maxLength={200}
					placeholder={t`Name the story`}
					aria-label={t`Title`}
					aria-invalid={tried && missingTitle ? true : undefined}
					onChange={(event) => setDraft({ ...draft, title: event.target.value.replace(/\n/g, " ") })}
					onKeyDown={(event) => {
						if (event.key === "Enter") event.preventDefault();
					}}
					className="min-h-0 resize-none text-xl leading-7 font-semibold"
				/>
				<Input
					fullWidth
					variant="secondary"
					value={draft.tags}
					placeholder={t`Tags, separated by commas`}
					aria-label={t`Tags`}
					onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
				/>
			</div>

			<div className="grid">
				{parts().map((part, index) => {
					const text = draft[part.key];
					return (
						<Fragment key={part.key}>
							{index > 0 && <Separator />}
							<label className="grid grid-cols-[32px_minmax(0,1fr)] gap-3.5 py-3.5">
								<span aria-hidden="true" className={partTile(Boolean(text.trim()))}>
									{part.letter}
								</span>
								<span className="grid min-w-0 gap-1.5">
									<span className="text-sm font-semibold text-muted">{part.label}</span>
									<TextArea
										fullWidth
										variant="secondary"
										rows={2}
										value={text}
										maxLength={part.key === "action" ? 6000 : 4000}
										placeholder={part.placeholder}
										aria-invalid={tried && REQUIRED.includes(part.key) && !text.trim() ? true : undefined}
										onChange={(event) => setDraft({ ...draft, [part.key]: event.target.value })}
										className="min-h-[60px]"
									/>
								</span>
							</label>
						</Fragment>
					);
				})}
			</div>

			<fieldset className="grid gap-2">
				<legend className="mb-2 text-xs font-semibold text-muted">
					<Trans>Backed by</Trans>
				</legend>
				{shared.map((fact) => {
					const disabled = fact.status !== "active";
					const checked = draft.factIds.includes(fact.id) && !disabled;
					return (
						<Checkbox
							key={fact.id}
							isSelected={checked}
							isDisabled={disabled}
							onChange={(value) => toggleFact(fact.id, value)}
							className={cn(
								"flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm leading-5 transition-colors duration-quick",
								checked ? "bg-accent-soft" : "bg-default",
								disabled ? "cursor-not-allowed text-muted" : "cursor-pointer",
							)}
						>
							<Checkbox.Content className="items-start">
								<Checkbox.Control className="mt-px">
									<Checkbox.Indicator />
								</Checkbox.Control>
								<span className="min-w-0 flex-1">
									{fact.text}
									{disabled && (
										<span className="block text-xs text-muted">
											<Trans>Not used in coaching, so it can't back a story.</Trans>
										</span>
									)}
								</span>
							</Checkbox.Content>
						</Checkbox>
					);
				})}
				{shared.length === 0 && (
					<p className="text-sm text-muted">
						<Trans>No facts to link yet. Add them in Facts.</Trans>
					</p>
				)}
			</fieldset>

			<Separator />
			<div className="grid gap-3">
				{tried && problem && (
					<p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
						<Icon name="warning-circle" size={16} />
						{problem}
					</p>
				)}
				<div className="flex flex-wrap items-center gap-2">
					{onDelete && (
						<Button
							variant="danger-soft"
							className="me-auto"
							onPress={() => {
								clear();
								onDelete();
							}}
						>
							<Trans>Delete story</Trans>
						</Button>
					)}
					<div className="ms-auto flex gap-2">
						<Button
							variant="ghost"
							onPress={() => {
								clear();
								onCancel();
							}}
						>
							<Trans>Cancel</Trans>
						</Button>
						<Button type="submit" isPending={save.isPending}>
							{save.isPending && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Save story</Trans>
						</Button>
					</div>
				</div>
			</div>
		</form>
	);
}
