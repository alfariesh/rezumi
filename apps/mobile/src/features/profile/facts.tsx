import type { RouterInput } from "@/api/client";
// The Profile tab's Facts panel (plans/mobile Phase 06): the true things the coach and documents may use, searchable
// and filtered by type, as on the web's Facts page. A row's switch turns a fact on or off for coaching; pressing it
// opens the fact (source, history, Correct, Forget) in a sheet on phones and beside the list on tablets. Forgetting
// is immediate with Undo.
import type { Fact } from "@/features/career/hooks";
import type { FactCategory } from "@rezumi/schema/career";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useDeferredValue, useLayoutEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useProfileAccount } from "./account";
import { AddFactButton, AddFactFields, useAddFact } from "./facts-add";
import { FactDetail } from "./facts-detail";
import { FACT_CATEGORIES, categoryLabel, categoryOf, factExcerpt, sourceLabel } from "./facts-labels";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useCareerQueries, useUndoRows } from "@/features/career/hooks";
import { useIsTablet } from "@/shell/use-is-tablet";
import {
	Button,
	Card,
	Chip,
	EmptyState,
	Icon,
	ListGroup,
	Screen,
	SearchField,
	Separator,
	Sheet,
	Skeleton,
	SwipeableRow,
	Switch,
	Text,
	Typography,
	cx,
	showToast,
} from "@/ui";

type Open = { kind: "fact"; id: string } | { kind: "add" } | null;

export function FactsPanel() {
	const account = useProfileAccount();
	// Another account starts over: no selection or pending Undo carries across accounts.
	return <FactsContent key={account ?? "signed-out"} />;
}

function FactsContent() {
	const { t } = useLingui();
	const tablet = useIsTablet();
	const { facts, stories } = useCareerQueries();
	const undo = useUndoRows();
	const update = useFactUpdate();
	const [search, setSearch] = useState("");
	// The field updates at once; the list filters in a deferred render that typing can interrupt.
	const query = useDeferredValue(search).trim().toLocaleLowerCase();
	const [type, setType] = useState<FactCategory | null>(null);
	const [open, setOpen] = useState<Open>(null);
	const addForm = useAddFact((id) => {
		// The new fact shows even when the current search or filter wouldn't match it.
		setSearch("");
		setType(null);
		setOpen(id && tablet ? { kind: "fact", id } : null);
	});

	const all = (facts.data ?? []).filter((fact) => !undo.hidden.includes(fact.id));
	const visible = all.filter(
		(fact) =>
			(type === null || categoryOf(fact) === type) &&
			(!query ||
				`${fact.text} ${fact.source.quote} ${fact.company ?? ""} ${sourceLabel(fact)}`
					.toLocaleLowerCase()
					.includes(query)),
	);
	const selected = open?.kind === "fact" ? (all.find((fact) => fact.id === open.id) ?? null) : null;
	const refresh = () => Promise.allSettled([facts.refetch(), stories.refetch()]);

	const current: FactActions = {
		onOpen: (fact) => setOpen({ kind: "fact", id: fact.id }),
		onToggle: (fact, active) => {
			const status = active ? "active" : "excluded";
			void update(fact, { status }, { status });
		},
		onCorrect: (fact, text) =>
			void update(
				fact,
				{ text },
				{ text, revisions: [...fact.revisions, { text: fact.text, at: new Date().toISOString() }] },
			),
		onShare: (fact) => void update(fact, { share: true }, { applicationId: null, company: null }),
		onForget: (fact) => {
			if (open?.kind === "fact" && open.id === fact.id) setOpen(null);
			undo.remove(fact.id, t`Fact forgotten`, () => client.career.forgetFact({ id: fact.id }));
		},
	};
	// Rows get one set of callbacks for the panel's life, so a change re-renders only the row it touches.
	const latest = useRef(current);
	useLayoutEffect(() => {
		latest.current = current;
	});
	const [actions] = useState<FactActions>(() => ({
		onOpen: (fact) => latest.current.onOpen(fact),
		onToggle: (fact, active) => latest.current.onToggle(fact, active),
		onCorrect: (fact, text) => latest.current.onCorrect(fact, text),
		onShare: (fact) => latest.current.onShare(fact),
		onForget: (fact) => latest.current.onForget(fact),
	}));

	const filtersActive = type !== null || !!query;
	let body: ReactNode;
	if (!facts.data && facts.isError)
		body = (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load your facts`}
				description={t`Check your connection and try again.`}
				action={{ label: t`Retry`, onPress: () => void facts.refetch() }}
			/>
		);
	else if (!facts.data) body = <FactRowsSkeleton />;
	else if (all.length === 0)
		body = (
			<EmptyState
				kind="page"
				icon="list-checks"
				title={t`No facts yet`}
				description={t`Add something true you can support. The coach and your documents use the facts you turn on.`}
				action={{ label: t`Add a fact`, onPress: () => setOpen({ kind: "add" }) }}
			/>
		);
	else if (visible.length === 0)
		body = (
			<EmptyState
				kind="filtered"
				title={t`No facts match`}
				description={t`Try another word or type.`}
				action={{
					label: t`Show all facts`,
					onPress: () => {
						setSearch("");
						setType(null);
					},
				}}
			/>
		);
	else
		body = (
			<ListGroup>
				{visible.map((fact, index) => (
					<View key={fact.id}>
						{index > 0 ? <Separator className="ms-4" /> : null}
						<FactRow fact={fact} selected={tablet && selected?.id === fact.id} actions={actions} />
					</View>
				))}
			</ListGroup>
		);

	const list = (
		<>
			<Typography type="body-sm" color="muted">
				{t`True things about your work. The coach and your documents use only the facts you turn on.`}
			</Typography>
			{all.length > 0 || filtersActive ? (
				<>
					<SearchField value={search} onChange={setSearch}>
						<SearchField.Group>
							<SearchField.SearchIcon />
							<SearchField.Input placeholder={t`Search facts`} accessibilityLabel={t`Search facts`} />
							<SearchField.ClearButton accessibilityLabel={t`Clear search`} />
						</SearchField.Group>
					</SearchField>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						className="-mx-4"
						contentContainerClassName="gap-2 px-4"
					>
						<FilterChip label={t`All`} selected={type === null} onPress={() => setType(null)} />
						{FACT_CATEGORIES.map((category) => (
							<FilterChip
								key={category}
								label={categoryLabel(category)}
								selected={type === category}
								onPress={() => setType(category)}
							/>
						))}
					</ScrollView>
				</>
			) : null}
			{facts.data && all.length > 0 ? (
				<View className="flex-row items-center justify-between gap-3">
					<Text size="xs" weight="semibold" tone="muted" accessibilityRole="header">
						{t`Your facts · ${visible.length}`}
					</Text>
					<Button size="sm" variant="secondary" onPress={() => setOpen({ kind: "add" })}>
						<Icon name="plus" size={16} />
						<Button.Label>{t`Add fact`}</Button.Label>
					</Button>
				</View>
			) : null}
			{body}
		</>
	);

	const detail = selected ? <FactDetail key={selected.id} fact={selected} {...actions} /> : null;
	const adding = open?.kind === "add";

	if (tablet)
		return (
			<View className="flex-1 flex-row">
				<View className="w-2/5 border-e border-separator">
					<Screen onRefresh={refresh}>{list}</Screen>
				</View>
				<View className="flex-1">
					<Screen>
						{adding ? (
							<Card className="gap-5">
								<Typography.Heading type="h6" accessibilityRole="header">
									{t`Add a fact`}
								</Typography.Heading>
								<AddFactFields form={addForm} />
								<View className="flex-row justify-end gap-2">
									<Button variant="ghost" onPress={() => setOpen(null)}>
										<Button.Label>{t`Cancel`}</Button.Label>
									</Button>
									<AddFactButton form={addForm} />
								</View>
							</Card>
						) : detail ? (
							<Card>{detail}</Card>
						) : facts.data && all.length > 0 ? (
							<EmptyState
								kind="inline"
								title={t`Pick a fact`}
								description={t`Its source, what uses it and its corrections show here.`}
							/>
						) : null}
					</Screen>
				</View>
			</View>
		);

	return (
		<>
			<Screen onRefresh={refresh}>{list}</Screen>
			<Sheet
				isOpen={!!selected}
				onOpenChange={(isOpen) => {
					if (!isOpen) setOpen(null);
				}}
				title={t`Fact`}
				closeLabel={t`Close`}
			>
				{detail}
			</Sheet>
			<Sheet
				isOpen={adding}
				onOpenChange={(isOpen) => {
					if (!isOpen) setOpen(null);
				}}
				title={t`Add a fact`}
				closeLabel={t`Close`}
				footer={<AddFactButton form={addForm} />}
			>
				<AddFactFields form={addForm} />
			</Sheet>
		</>
	);
}

type FactActions = {
	onOpen: (fact: Fact) => void;
	onToggle: (fact: Fact, active: boolean) => void;
	onCorrect: (fact: Fact, text: string) => void;
	onShare: (fact: Fact) => void;
	onForget: (fact: Fact) => void;
};

type FactRowProps = { fact: Fact; selected: boolean; actions: FactActions };

// Memoized: typing in the search or one switch shouldn't re-render every row.
const FactRow = memo(function FactRow({ fact, selected, actions }: FactRowProps) {
	const { t } = useLingui();
	const on = fact.status === "active";
	return (
		<SwipeableRow
			variant="inline"
			openActionsLabel={t`Show actions`}
			closeActionsLabel={t`Hide actions`}
			actions={[
				{ key: "forget", label: t`Forget`, icon: "trash", variant: "danger", onPress: () => actions.onForget(fact) },
			]}
		>
			<View className={cx("flex-row items-center gap-3 bg-surface pe-4", selected && "bg-surface-secondary")}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={fact.text}
					accessibilityHint={t`Opens the fact's source and history`}
					accessibilityState={{ selected }}
					onPress={() => actions.onOpen(fact)}
					className="min-h-14 flex-1 gap-1.5 py-3.5 ps-4"
					testID={`fact-${fact.id}`}
				>
					<Text weight="medium" tone={on ? "default" : "muted"} numberOfLines={3}>
						{fact.text}
					</Text>
					<Text size="xs" tone="muted" numberOfLines={1}>
						{[categoryLabel(categoryOf(fact)), fact.company ? t`${fact.company} only` : null]
							.filter(Boolean)
							.join(" · ")}
					</Text>
				</Pressable>
				<Switch
					isSelected={on}
					onSelectedChange={(active) => actions.onToggle(fact, active)}
					accessibilityLabel={t`Use in coaching: ${factExcerpt(fact)}`}
				/>
			</View>
		</SwipeableRow>
	);
});

type FilterChipProps = { label: string; selected: boolean; onPress: () => void };

function FilterChip({ label, selected, onPress }: FilterChipProps) {
	return (
		<Chip
			variant={selected ? "primary" : "secondary"}
			color={selected ? "accent" : "default"}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected }}
			hitSlop={6}
		>
			<Chip.Label>{label}</Chip.Label>
		</Chip>
	);
}

/** Fact rows while the list loads: two lines of text and the switch at the end, as `FactRow` lays them out. */
function FactRowsSkeleton() {
	const { t } = useLingui();
	return (
		<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar">
			<ListGroup>
				{Array.from({ length: 4 }, (_, index) => (
					<View key={index}>
						{index > 0 ? <Separator className="ms-4" /> : null}
						<View className="flex-row items-center gap-3 px-4 py-4">
							<View className="flex-1 gap-2">
								<Skeleton variant="none" className="h-4 w-4/5 rounded-md" />
								<Skeleton variant="none" className="h-3 w-1/3 rounded-md" />
							</View>
							<Skeleton variant="none" className="h-7 w-12 rounded-full" />
						</View>
					</View>
				))}
			</ListGroup>
		</View>
	);
}

type FactUpdate = Omit<RouterInput["career"]["updateFact"], "id">;

/**
 * Saves a change to one fact, showing it at once: the cached lists are patched first, then refetched once the server
 * answers. A failure says so and the refetch puts the saved value back.
 */
function useFactUpdate() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const session = useSession();
	return async (fact: Fact, input: FactUpdate, patch: Partial<Fact>) => {
		if (session.status !== "signed-in" || getServer() !== session.server) return;
		queryClient.setQueriesData<Fact[]>({ queryKey: orpc.career.facts.key() }, (list) =>
			list?.map((row) => (row.id === fact.id ? { ...row, ...patch } : row)),
		);
		try {
			await client.career.updateFact({ id: fact.id, ...input });
		} catch {
			showToast({ title: t`Couldn't save that change. Check your connection and try again.`, variant: "danger" });
		} finally {
			void queryClient.invalidateQueries({ queryKey: orpc.career.key() });
		}
	};
}
