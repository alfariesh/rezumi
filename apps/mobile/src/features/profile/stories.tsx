// The Profile tab's Stories panel (plans/mobile Phase 06): STARR stories (Situation, Task, Action, Result,
// Reflection) backed by facts, as on the web's Stories page. A story opens to read in a sheet on phones and beside the
// list on tablets; Edit turns the same place into its editor. Deleting is immediate with Undo; leaving an editor with
// unsaved changes asks first, since a lost draft can't come back.
import type { Fact, Story } from "@/features/career/hooks";
import type { CareerStoryData } from "@rezumi/schema/career";
import type { ReactNode } from "react";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { StoryEditorFields, storyPayload, storyProblem } from "./stories-editor";
import { emptyStory, factChanged, filledParts } from "./stories-parts";
import { ChangedNotice, PartTiles, StoryReader } from "./stories-reader";
import { useSession } from "@/auth/session";
import { client, useCareerAction, useCareerQueries, useUndoRows } from "@/features/career/hooks";
import { useIsTablet } from "@/shell/use-is-tablet";
import {
	Alert,
	Button,
	Card,
	ConfirmDialog,
	EmptyState,
	Icon,
	ListGroup,
	Screen,
	Separator,
	Sheet,
	Skeleton,
	SwipeableRow,
	Text,
	Typography,
	cx,
	showToast,
} from "@/ui";

/** The story in the pane (`id: null` writes a new one); `key` grows with each opening, so each starts fresh. */
type Pane = { id: string | null; key: number };

export function StoriesPanel() {
	const { server } = useSession();
	// A server switch starts over: no open story, draft or pending Undo carries across accounts.
	return <StoriesContent key={server ?? "signed-out"} />;
}

function StoriesContent() {
	const { t } = useLingui();
	const tablet = useIsTablet();
	const { stories, facts } = useCareerQueries();
	const undo = useUndoRows();
	// The pane keeps its story while the sheet closes, so the sheet doesn't change under the person's finger.
	const [pane, setPane] = useState<Pane>({ id: null, key: 0 });
	const [open, setOpen] = useState(false);
	const show = (id: string | null) => {
		setPane((current) => ({ id, key: current.key + 1 }));
		setOpen(true);
	};

	const rows = (stories.data ?? []).filter((story) => !undo.hidden.includes(story.id));
	const factsById = new Map((facts.data ?? []).map((fact) => [fact.id, fact]));
	// Tablets always show a story beside the list: the first one until another is picked.
	const first = tablet && !open ? rows[0] : undefined;
	const paneId = first ? first.id : pane.id;
	// A deleted story stays in the cache until its Undo runs out; the pane closes on the hidden id.
	const paneStory = paneId ? ((stories.data ?? []).find((story) => story.id === paneId) ?? null) : null;
	const paneOpen = (open || !!first) && (paneId === null || (paneStory !== null && !undo.hidden.includes(paneId)));
	const selectedId = paneOpen ? paneId : null;
	const refresh = () => Promise.allSettled([stories.refetch(), facts.refetch()]);

	const remove = (story: Story) => {
		if (pane.id === story.id) setOpen(false);
		undo.remove(story.id, t`Story deleted`, () => client.career.deleteStory({ id: story.id }));
	};

	let body: ReactNode;
	if (!stories.data && stories.isError)
		body = (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load your stories`}
				description={t`Check your connection and try again.`}
				action={{ label: t`Retry`, onPress: () => void stories.refetch() }}
			/>
		);
	else if (!stories.data) body = <StoryRowsSkeleton />;
	else if (rows.length === 0)
		body = (
			<EmptyState
				kind="page"
				icon="book-open"
				title={t`No stories yet`}
				description={t`Write one about something you did, in five parts. Leave a part blank until you can support it.`}
				action={{ label: t`New story`, onPress: () => show(null) }}
			/>
		);
	else
		body = (
			<ListGroup>
				{rows.map((story, index) => (
					<View key={story.id}>
						{index > 0 ? <Separator className="ms-4" /> : null}
						<StoryRow
							story={story}
							changed={factChanged(story, factsById)}
							selected={tablet && selectedId === story.id}
							onOpen={() => show(story.id)}
							onDelete={() => remove(story)}
						/>
					</View>
				))}
			</ListGroup>
		);

	const list = (
		<>
			<Typography type="body-sm" color="muted">
				{t`Situation, Task, Action, Result, Reflection. Link each story to facts you can support; leave unknown outcomes blank.`}
			</Typography>
			{rows.length > 0 ? (
				<View className="flex-row items-center justify-between gap-3">
					<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
						{t`Your stories · ${rows.length}`}
					</Text>
					<Button size="sm" variant="secondary" onPress={() => show(null)}>
						<Icon name="plus" size={16} />
						<Button.Label>{t`New story`}</Button.Label>
					</Button>
				</View>
			) : null}
			{body}
		</>
	);

	const paneView = (
		<StoryPane
			// Each opening, and a different story, starts a fresh draft.
			key={first ? `first:${first.id}` : pane.key}
			story={paneStory}
			facts={facts.data ?? []}
			factsById={factsById}
			isOpen={paneOpen}
			tablet={tablet}
			onClose={() => setOpen(false)}
			onSaved={(id) => {
				if (tablet && id) show(id);
				else setOpen(false);
			}}
			onDelete={remove}
		/>
	);

	if (tablet)
		return (
			<View className="flex-1 flex-row">
				<View className="w-2/5 border-e border-separator">
					<Screen onRefresh={refresh}>{list}</Screen>
				</View>
				<View className="flex-1">
					<Screen>{paneOpen ? paneView : null}</Screen>
				</View>
			</View>
		);

	return (
		<>
			<Screen onRefresh={refresh}>{list}</Screen>
			{paneView}
		</>
	);
}

type StoryRowProps = {
	story: Story;
	changed: boolean;
	selected: boolean;
	onOpen: () => void;
	onDelete: () => void;
};

const StoryRow = memo(function StoryRow({ story, changed, selected, onOpen, onDelete }: StoryRowProps) {
	const { t } = useLingui();
	const filled = filledParts(story.data);
	const facts = story.data.factIds.length;
	const summary = `${t`${filled} of 5 parts`} · ${plural(facts, { one: "# fact", other: "# facts" })}`;
	return (
		<SwipeableRow
			variant="inline"
			openActionsLabel={t`Show actions`}
			closeActionsLabel={t`Hide actions`}
			actions={[{ key: "delete", label: t`Delete`, icon: "trash", variant: "danger", onPress: onDelete }]}
		>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={[story.data.title, summary, changed ? t`A fact changed. Review this story.` : null]
					.filter(Boolean)
					.join(", ")}
				accessibilityState={{ selected }}
				onPress={onOpen}
				className={cx("min-h-14 gap-2 bg-surface px-4 py-3.5", selected && "bg-surface-secondary")}
				testID={`story-${story.id}`}
			>
				<Text weight="semibold" numberOfLines={2}>
					{story.data.title}
				</Text>
				<Text size="xs" tone="muted" tabular>
					{summary}
				</Text>
				<PartTiles data={story.data} />
				{changed ? <ChangedNotice /> : null}
			</Pressable>
		</SwipeableRow>
	);
});

/** Story rows while the list loads: a title, the summary line and the five tiles. */
function StoryRowsSkeleton() {
	const { t } = useLingui();
	return (
		<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar">
			<ListGroup>
				{Array.from({ length: 3 }, (_, index) => (
					<View key={index}>
						{index > 0 ? <Separator className="ms-4" /> : null}
						<View className="gap-2.5 px-4 py-4">
							<Skeleton variant="none" className="h-4 w-3/5 rounded-md" />
							<Skeleton variant="none" className="h-3 w-1/3 rounded-md" />
							<View className="flex-row gap-2">
								{Array.from({ length: 5 }, (_, tile) => (
									<Skeleton key={tile} variant="none" className="size-7 rounded-lg" />
								))}
							</View>
						</View>
					</View>
				))}
			</ListGroup>
		</View>
	);
}

type StoryPaneProps = {
	/** The story to read or edit; null writes a new one. */
	story: Story | null;
	facts: readonly Fact[];
	factsById: ReadonlyMap<string, Fact>;
	/** Phones: whether the sheet is up. Tablets render the pane only while it is open. */
	isOpen: boolean;
	tablet: boolean;
	onClose: () => void;
	onSaved: (id: string | undefined) => void;
	onDelete: (story: Story) => void;
};

function StoryPane({ story, facts, factsById, isOpen, tablet, onClose, onSaved, onDelete }: StoryPaneProps) {
	const { t } = useLingui();
	const action = useCareerAction();
	const initial = (): CareerStoryData => (story ? { ...emptyStory(), ...story.data } : emptyStory());
	const [editing, setEditing] = useState(story === null);
	const [draft, setDraft] = useState(initial);
	const [tried, setTried] = useState(false);
	const [discarding, setDiscarding] = useState(false);
	const dirty = editing && JSON.stringify(draft) !== JSON.stringify(initial());

	const startEditing = () => {
		setDraft(initial());
		setTried(false);
		setEditing(true);
	};
	const cancel = () => {
		if (story) setEditing(false);
		else onClose();
	};
	const save = () => {
		setTried(true);
		if (storyProblem(draft) || action.pending) return;
		const payload = storyPayload(draft, facts);
		void action.run(
			() => client.career.saveStory({ ...payload, ...(story ? { id: story.id } : {}) }),
			(row) => {
				showToast({ title: t`Story saved`, variant: "success" });
				if (story) setEditing(false);
				else onSaved(row && typeof row === "object" && "id" in row ? String(row.id) : undefined);
			},
		);
	};

	const title = editing ? (story ? t`Edit story` : t`New story`) : t`Story`;
	const content =
		editing || !story ? (
			<>
				<StoryEditorFields
					draft={draft}
					onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
					facts={facts}
					tried={tried}
				/>
				{action.error ? (
					<Alert status="danger">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>{action.error}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}
			</>
		) : (
			<StoryReader story={story} facts={factsById} />
		);
	const buttons =
		editing || !story ? (
			<>
				{story ? (
					<Button variant="danger-soft" onPress={() => onDelete(story)}>
						<Button.Label>{t`Delete story`}</Button.Label>
					</Button>
				) : null}
				<View className="flex-1" />
				<Button variant="ghost" onPress={cancel}>
					<Button.Label>{t`Cancel`}</Button.Label>
				</Button>
				<Button variant="primary" isDisabled={action.pending} onPress={save}>
					<Button.Label>{action.pending ? t`Saving…` : t`Save story`}</Button.Label>
				</Button>
			</>
		) : (
			<>
				<Button variant="danger-soft" onPress={() => onDelete(story)}>
					<Button.Label>{t`Delete story`}</Button.Label>
				</Button>
				<View className="flex-1" />
				<Button variant="primary" onPress={startEditing}>
					<Icon name="pencil-simple" size={16} tone="accent-foreground" />
					<Button.Label>{t`Edit`}</Button.Label>
				</Button>
			</>
		);
	const discardDialog = (
		<ConfirmDialog
			isOpen={discarding}
			onOpenChange={setDiscarding}
			title={t`Discard your changes?`}
			message={t`What you changed in this story is lost.`}
			confirmLabel={t`Discard`}
			cancelLabel={t`Keep editing`}
			destructive
			onConfirm={onClose}
		/>
	);

	if (tablet)
		return (
			<Card className="gap-5">
				<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
					{title}
				</Text>
				{content}
				<View className="flex-row flex-wrap items-center gap-2">{buttons}</View>
				{discardDialog}
			</Card>
		);

	return (
		<>
			<Sheet
				isOpen={isOpen}
				onOpenChange={(next) => {
					if (!next) onClose();
				}}
				title={title}
				closeLabel={t`Close`}
				canDismiss={!dirty && !action.pending}
				onDismissAttempt={() => {
					if (dirty) setDiscarding(true);
				}}
				footer={<View className="flex-row flex-wrap items-center gap-2">{buttons}</View>}
			>
				{content}
			</Sheet>
			{discardDialog}
		</>
	);
}
