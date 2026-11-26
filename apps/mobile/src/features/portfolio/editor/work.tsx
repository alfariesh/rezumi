import type { Portfolio } from "../queries";
import type { PortfolioData, PortfolioWork } from "@rezumi/schema/portfolio/data";
import { useLingui } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { View } from "react-native";
import {
	blockRoom,
	changeWorkSlug,
	duplicateWork,
	insertBlocks,
	newTextBlock,
	newWork,
	retitleWork,
	workMetrics,
	workRoom,
	workFromLink,
	worksFromImages,
	workSlugProblem,
} from "@rezumi/portfolio/editing";
import { resumeDataFromProfile } from "@rezumi/resume/profile";
import { PORTFOLIO_LIMITS as limits } from "@rezumi/schema/portfolio/limits";
import { escapeHtml } from "@rezumi/utils/string";
import { portfolioFailure } from "../queries";
import { AiField } from "./ai";
import { Blocks } from "./blocks";
import { Field, Group, Order, Toggle } from "./fields";
import { blockFromLink, MediaError } from "./media";
import { AddPictures, PicturePreview } from "./pictures";
import { offerUndo, useEdit, useEditor, useWorkEdit } from "./store";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { RichTextToolbar } from "@/features/entries/rich-text-field";
import {
	Button,
	Card,
	ChipInput,
	EmptyState,
	ListGroup,
	ListRow,
	Screen,
	Sheet,
	SortableHandle,
	SortableList,
	Spinner,
	Text,
	showToast,
} from "@/ui";
import { SheetMenu } from "@/ui/sheet-menu";

const { text: max } = limits;
type WorkPaneProps = {
	portfolio: Portfolio;
	limit: number;
	workId: string | null;
	onOpen: (id: string | null) => void;
};
type WorkMode = "menu" | "import" | "link" | "pictures";

export function WorkPane({ portfolio, limit, workId, onOpen }: WorkPaneProps) {
	const work = portfolio.data.works.items.find(({ id }) => id === workId);
	return work ? (
		<WorkEditor key={work.id} work={work} onBack={() => onOpen(null)} />
	) : (
		<WorkList portfolio={portfolio} limit={limit} onOpen={onOpen} />
	);
}

function WorkList({ portfolio, limit, onOpen }: Omit<WorkPaneProps, "workId">) {
	const { t } = useLingui();
	const { scope, store } = useEditor();
	const online = useOnline();
	const edit = useEdit();
	const [sheet, setSheet] = useState<WorkMode | null>(null);
	const [url, setUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const next = useRef<(() => void) | null>(null);
	const queryClient = useQueryClient();
	const data = portfolio.data;
	const works = data.works.items;
	const room = workRoom(data, limit);
	const resumeId = portfolio.sourceResumeId;
	const hasSource = resumeId ? !portfolio.sourceResume?.inTrash : data.useProfileSource !== false;
	const context = { scope };
	const resume = useQuery({
		...orpc.resume.getById.queryOptions({ input: { id: resumeId ?? "" }, context }),
		enabled: sheet === "import" && online && Boolean(resumeId) && hasSource,
	});
	const profile = useQuery({
		...orpc.profile.get.queryOptions({ context }),
		enabled: sheet === "import" && online && !resumeId && hasSource,
	});
	const source = resumeId ? resume : profile;
	const sourceData = resumeId ? resume.data?.data : profile.data ? resumeDataFromProfile(profile.data.data) : undefined;
	const projects =
		sourceData?.sections.projects.items.filter((item) => !works.some((work) => work.fromResumeItemId === item.id)) ??
		[];

	const add = (build: (current: PortfolioData) => PortfolioWork[]) => {
		const before = store.getState().portfolio?.data;
		if (!before || workRoom(before, limit) === 0) return;
		const items = build(before);
		const first = items[0];
		if (!first) return;
		edit(
			(draft) => {
				draft.works.items.push(...items);
			},
			{ structural: true },
		);
		offerUndo(store, before, t`Work added`);
		onOpen(first.id);
		setSheet(null);
	};
	const move = (id: string, shift: number) =>
		edit(
			(draft) => {
				const from = draft.works.items.findIndex((item) => item.id === id);
				if (from < 0 || !draft.works.items[from + shift]) return;
				const [item] = draft.works.items.splice(from, 1);
				if (item) draft.works.items.splice(from + shift, 0, item);
			},
			{ structural: true },
		);
	const remove = (id: string) => {
		const before = store.getState().portfolio?.data;
		edit(
			(draft) => {
				draft.works.items = draft.works.items.filter((item) => item.id !== id);
			},
			{ structural: true },
		);
		offerUndo(store, before, t`Work removed`);
	};

	const importProject = async (id: string) => {
		setBusy(true);
		try {
			if (!(await store.getState().flush())) throw new MediaError(t`Save your changes before importing a project.`);
			const before = store.getState().portfolio;
			if (!before) return;
			const saved = await client.portfolio.importWorks(
				{ resumeItemIds: [id], expectedUpdatedAt: before.updatedAt },
				{ context },
			);
			if (!store.getState().portfolio) return;
			store.getState().applyServerEdit(saved, before.data);
			void queryClient.invalidateQueries({ queryKey: orpc.portfolio.get.key() });
			const imported = saved.data.works.items.find((item) => item.fromResumeItemId === id);
			if (imported) onOpen(imported.id);
			setSheet(null);
		} catch (error) {
			showToast({ title: error instanceof MediaError ? error.message : portfolioFailure(error), variant: "danger" });
		} finally {
			setBusy(false);
		}
	};
	const addLink = async () => {
		setBusy(true);
		try {
			const { block, url: address } = await blockFromLink(url.trim(), scope);
			const title = block.title || t`New work`;
			const picture = block.type === "link" ? block.image : block.thumbnail;
			add((current) => [
				workFromLink(
					current,
					{ url: address, title, summary: block.type === "link" ? (block.description ?? "") : "" },
					block,
					picture,
				),
			]);
		} catch (error) {
			showToast({
				title: error instanceof MediaError ? error.message : t`Couldn't read that link.`,
				variant: "danger",
			});
		} finally {
			setBusy(false);
		}
	};
	const show = (mode: WorkMode) => {
		next.current = () => setSheet(mode);
		setSheet(null);
	};
	const header = (
		<View className="gap-3 p-4">
			<Button
				testID="portfolio-add-work"
				isDisabled={room === 0 || busy}
				onPress={() => setSheet("menu")}
			>{t`Add work`}</Button>
			{works.length === 0 ? (
				<EmptyState kind="inline" title={t`No work yet`} description={t`Add a project, a set of images or a link.`} />
			) : null}
			{room === 0 ? <Text tone="muted">{t`Your portfolio has reached its work limit.`}</Text> : null}
		</View>
	);
	return (
		<>
			<Screen scroll={false} bare testID="portfolio-editor-work">
				<SortableList
					data={works}
					keyExtractor={(item) => item.id}
					ListHeaderComponent={header}
					onReorder={(items) =>
						edit(
							(draft) => {
								draft.works.items = items;
							},
							{ structural: true },
						)
					}
					renderItem={({ item, index, drag }) => {
						const title = item.title || t`Untitled work`;
						const metric = workMetrics(item).find(({ id }) => id === item.highlightMetricId);
						return (
							<View className="px-4 pb-3">
								<Card className="gap-2">
									{item.cover ? <PicturePreview picture={item.cover} cover /> : null}
									<View className="flex-row items-center gap-2">
										<SortableHandle label={t`Reorder ${title}`} onDrag={drag} />
										<View className="flex-1">
											<ListRow
												title={title}
												description={metric ? `/${item.slug} · ${metric.label}` : `/${item.slug}`}
												onPress={() => onOpen(item.id)}
											/>
										</View>
										<SheetMenu
											label={t`Work actions`}
											closeLabel={t`Close`}
											items={[
												...(index > 0 ? [{ label: t`Move up`, onPress: () => move(item.id, -1) }] : []),
												...(index < works.length - 1 ? [{ label: t`Move down`, onPress: () => move(item.id, 1) }] : []),
												...(room
													? [
															{
																label: t`Duplicate work`,
																onPress: () =>
																	add((current) => [
																		duplicateWork(current, item, t`Copy of ${title}`.slice(0, max.workTitle)),
																	]),
															},
														]
													: []),
												{ label: t`Remove work`, destructive: true, onPress: () => remove(item.id) },
											]}
										/>
									</View>
								</Card>
							</View>
						);
					}}
				/>
			</Screen>
			<Sheet
				isOpen={sheet !== null}
				onOpenChange={(open) => {
					if (!open && !busy) setSheet(null);
				}}
				title={sheet === "import" ? t`Import from projects` : t`Add work`}
				closeLabel={t`Close`}
				onDidDismiss={() => {
					const action = next.current;
					next.current = null;
					action?.();
				}}
			>
				{sheet === "menu" ? (
					<ListGroup>
						<ListRow title={t`Start with a blank work`} onPress={() => add((current) => [newWork(current)])} />
						<ListRow
							title={t`Import from projects`}
							isDisabled={!online || !hasSource}
							onPress={() => show("import")}
						/>
						<ListRow title={t`Start from pictures`} isDisabled={!online} onPress={() => show("pictures")} />
						<ListRow
							title={t`Paste a link`}
							isDisabled={!online}
							onPress={() => {
								setUrl("");
								show("link");
							}}
						/>
					</ListGroup>
				) : null}
				{sheet === "import" ? (
					<ListGroup>
						{source.isPending ? (
							<Spinner />
						) : source.isError ? (
							<Button variant="secondary" onPress={() => void source.refetch()}>{t`Retry`}</Button>
						) : null}
						{source.data && !projects.length ? (
							<Text tone="muted">{t`There are no remaining projects to import.`}</Text>
						) : null}
						{projects.map((project) => (
							<ListRow
								key={project.id}
								title={project.name || t`Untitled project`}
								isDisabled={busy || room === 0}
								onPress={() => void importProject(project.id)}
							/>
						))}
					</ListGroup>
				) : null}
				{sheet === "pictures" ? (
					<View className="gap-3">
						<AddPictures
							label={t`Choose pictures`}
							inline
							limit={limits.imagesPerBlock}
							onPictures={(pictures, names) =>
								add((current) =>
									worksFromImages(
										current,
										pictures.map((image, index) => ({ image, fileName: names[index] ?? "" })),
										"one",
										t`New work`,
										limit,
									),
								)
							}
						/>
					</View>
				) : null}
				{sheet === "link" ? (
					<View className="gap-3">
						<Field label={t`URL`} value={url} onChange={setUrl} keyboard="url" max={max.url} />
						<Button isDisabled={busy || !url.trim()} onPress={() => void addLink()}>{t`Create work from link`}</Button>
					</View>
				) : null}
			</Sheet>
		</>
	);
}

type WorkEditorProps = { work: PortfolioWork; onBack: () => void };

function WorkEditor({ work, onBack }: WorkEditorProps) {
	const { t } = useLingui();
	const { store, lastSavedData } = useEditor();
	const change = useWorkEdit(work.id);
	const revision = store((state) => state.revision);
	const metrics = workMetrics(work);
	return (
		<>
			<RichTextToolbar />
			<Screen testID="portfolio-work-editor">
				<Button variant="secondary" onPress={onBack}>{t`All work`}</Button>
				<Group title={work.title || t`Untitled work`}>
					<Field
						label={t`Work title`}
						testID="portfolio-work-title"
						value={work.title}
						max={max.workTitle}
						onChange={(title) =>
							change((target, draft) => retitleWork(draft, target, title, lastSavedData()), { key: work.id + ":title" })
						}
					/>
					<WorkSlug key={`${work.slug}:${revision}`} work={work} />
					<AiField
						label={t`Summary`}
						value={work.summary}
						field="workSummary"
						max={max.workSummary}
						read={(data) => data.works.items.find(({ id }) => id === work.id)?.summary}
						write={(data, summary) => {
							const target = data.works.items.find(({ id }) => id === work.id);
							if (target) target.summary = summary;
						}}
					/>
					<Field
						label={t`Role`}
						value={work.role}
						max={max.workRole}
						onChange={(role) =>
							change(
								(target) => {
									target.role = role;
								},
								{ key: work.id + ":role" },
							)
						}
					/>
					<Field
						label={t`Date`}
						value={work.date}
						max={max.workDate}
						onChange={(date) =>
							change(
								(target) => {
									target.date = date;
								},
								{ key: work.id + ":date" },
							)
						}
					/>
					<ChipInput
						label={t`Tags`}
						values={work.tags}
						max={limits.tagsPerWork}
						maxLength={max.tag}
						removeLabel={(tag) => t`Remove ${tag}`}
						onChange={(tags) =>
							change((target) => {
								target.tags = tags;
							})
						}
					/>
					<Toggle
						label={t`Feature this work`}
						value={work.featured}
						onChange={(value) =>
							change((target) => {
								target.featured = value;
							})
						}
					/>
					<Toggle
						label={t`Hide this work`}
						value={work.hidden}
						onChange={(value) =>
							change((target) => {
								target.hidden = value;
							})
						}
					/>
				</Group>
				<Group title={t`Work cover`}>
					{work.cover ? (
						<>
							<PicturePreview
								picture={work.cover}
								onFocus={(focus) =>
									change((target) => {
										if (target.cover) target.cover.focus = focus;
									})
								}
							/>
							<Field
								label={t`Alternative text`}
								value={work.cover.alt}
								max={max.alt}
								onChange={(alt) =>
									change(
										(target) => {
											if (target.cover) target.cover.alt = alt;
										},
										{ key: work.id + ":cover-alt" },
									)
								}
							/>
							<Order
								remove={() =>
									change((target) => {
										delete target.cover;
									})
								}
							/>
						</>
					) : null}
					<AddPictures
						label={t`Choose cover picture`}
						onPictures={([picture]) => {
							if (picture)
								change((target) => {
									target.cover = picture;
								});
						}}
					/>
					{metrics.length ? (
						<ListGroup>
							<Text weight="semibold">{t`Featured metric`}</Text>
							{metrics.map((metric) => (
								<Toggle
									key={metric.id}
									label={metric.label || t`Untitled metric`}
									value={work.highlightMetricId === metric.id}
									onChange={(show) =>
										change((target) => {
											if (show) target.highlightMetricId = metric.id;
											else delete target.highlightMetricId;
										})
									}
								/>
							))}
						</ListGroup>
					) : null}
				</Group>
				{work.blocks.length === 0 && blockRoom(work) > 0 ? (
					<Button
						variant="secondary"
						onPress={() =>
							change(
								(target) => {
									insertBlocks(
										target,
										0,
										[t`Challenge`, t`Approach`, t`Result`].map((heading) =>
											newTextBlock(`<h2>${escapeHtml(heading)}</h2>`),
										),
									);
								},
								{ structural: true },
							)
						}
					>{t`Start a case study`}</Button>
				) : null}
				<Blocks work={work} />
			</Screen>
		</>
	);
}

function WorkSlug({ work }: Pick<WorkEditorProps, "work">) {
	const { t } = useLingui();
	const [slug, setSlug] = useState(work.slug);
	const { store, lastSavedData } = useEditor();
	const change = useWorkEdit(work.id);
	const data = store((state) => state.portfolio?.data);
	const issue = data ? workSlugProblem(data, work.id, slug) : "pattern";
	return (
		<View className="gap-2">
			<Field label={t`Work address`} value={slug} max={max.slug} onChange={setSlug} />
			{slug !== work.slug ? (
				<>
					{issue ? (
						<Text tone="danger">
							{issue === "taken"
								? t`That address is already used.`
								: t`Use lowercase letters, numbers and single hyphens.`}
						</Text>
					) : null}
					<Button
						size="sm"
						variant="secondary"
						isDisabled={Boolean(issue)}
						onPress={() =>
							change((work, draft) => {
								if (!workSlugProblem(draft, work.id, slug)) changeWorkSlug(draft, work, slug, lastSavedData());
							})
						}
					>{t`Set work address`}</Button>
				</>
			) : null}
		</View>
	);
}
