import type { Portfolio } from "../queries";
import { useLingui } from "@lingui/react/macro";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { PortfolioLoadState, PortfolioPage } from "../layout";
import { PortfolioPreview } from "../preview";
import { PublishSettings } from "../publish";
import { portfolioFailure, usePortfolio } from "../queries";
import { AiTools } from "./ai";
import { PortfolioAssistant } from "./assistant";
import { Content } from "./content";
import { Design } from "./design";
import { EditorProvider, useEditor } from "./store";
import { WorkPane } from "./work";
import { client } from "@/api/client";
import { useOnline } from "@/api/online";
import { getAccountScope, useSession } from "@/auth/session";
import { routes } from "@/routes";
import { useUnsavedChangesGuard } from "@/shell/unsaved-changes";
import { Button, EmptyState, IconButton, Screen, Segment, Text, showToast, useIsWide } from "@/ui";

type Pane = "content" | "work" | "design" | "publish";

export function PortfolioEditorScreen() {
	const { t } = useLingui();
	const { thread } = useLocalSearchParams<{ thread?: string }>();
	useSession();
	const scope = getAccountScope();
	const query = usePortfolio();
	const online = useOnline();
	const portfolio = query.data?.portfolio;
	if (scope && portfolio)
		return (
			<EditorProvider key={`${scope}:${portfolio.id}`} scope={scope} portfolio={portfolio}>
				<Editor
					key={thread}
					initialThread={thread}
					portfolio={portfolio}
					contactAvailable={query.data?.contactFormAvailable === true}
					limit={query.data?.limits.works ?? 0}
					refresh={query.refetch}
				/>
			</EditorProvider>
		);
	return (
		<PortfolioPage title={t`Edit portfolio`}>
			{query.data && !portfolio ? (
				<Screen>
					<EmptyState kind="page" title={t`You don't have a portfolio yet.`} />
				</Screen>
			) : (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			)}
		</PortfolioPage>
	);
}

type EditorProps = {
	initialThread?: string | undefined;
	portfolio: Portfolio;
	contactAvailable: boolean;
	limit: number;
	refresh: () => Promise<unknown>;
};

function Editor({ portfolio: remote, contactAvailable, limit, refresh, initialThread }: EditorProps) {
	const { t } = useLingui();
	const router = useRouter();
	const online = useOnline();
	const wide = useIsWide();
	const { store, scope } = useEditor();
	const [pane, setPane] = useState<Pane>("content");
	const [workId, setWorkId] = useState<string | null>(null);
	const [assistantOpen, setAssistantOpen] = useState(!!initialThread);
	const [opening, setOpening] = useState(false);
	const current = store();
	const portfolio = current.portfolio;
	const status = current.status;
	const currentWork = portfolio?.data.works.items.find((work) => work.id === workId);
	const focusedWork =
		pane === "work" && Boolean(currentWork?.title.trim()) && !currentWork?.hidden ? currentWork : undefined;
	const version = portfolio?.updatedAt.getTime();
	useUnsavedChangesGuard({ dirty: current.dirty || status === "saving" });

	useEffect(() => {
		const state = store.getState();
		if (!state.portfolio || state.dirty || state.status !== "saved") return;
		// The query may see updates from Publish. Leave the current version's edit history in the shared store.
		if (remote.updatedAt > state.portfolio.updatedAt) state.applyServerEdit(remote);
		else if (remote.updatedAt.getTime() === state.portfolio.updatedAt.getTime()) state.applySettings(remote);
	}, [remote, store]);

	const ready = async () => {
		if (opening || !online) return false;
		setOpening(true);
		try {
			if (await store.getState().flush()) return true;
			showToast({ title: t`Save or resolve your changes first.`, variant: "warning" });
			return false;
		} finally {
			setOpening(false);
		}
	};
	const preview = async () => {
		if (!(await ready())) return;
		router.push({ pathname: routes.portfolio("preview"), params: focusedWork ? { workId: focusedWork.id } : {} });
	};
	const changePane = async (next: Pane) => {
		if (next === "publish" && !(await ready())) return;
		setAssistantOpen(false);
		setPane(next);
	};
	const reload = async () => {
		const conflict = store.getState().conflict;
		try {
			const latest = conflict?.server ?? (await client.portfolio.get(undefined, { context: { scope } })).portfolio;
			if (latest) store.getState().load(latest);
			else await refresh();
		} catch (error) {
			showToast({ title: portfolioFailure(error), variant: "danger" });
		}
	};

	const labels = {
		saved: online ? t`Saved` : t`Offline`,
		saving: online ? t`Saving…` : t`Waiting for connection`,
		error: online ? t`Couldn't save. Retrying…` : t`Offline. Changes are waiting to save.`,
		invalid:
			current.problem?.kind === "too-large"
				? t`This portfolio is too large to save.`
				: current.problem?.kind === "field"
					? t`Review the field that couldn't be saved.`
					: current.problem?.kind === "refused"
						? portfolioFailure(current.problem.error)
						: t`A picture or file is unavailable.`,
		conflict: t`This portfolio changed on another device.`,
		gone: t`This portfolio is no longer available.`,
	};
	return (
		<PortfolioPage
			title={assistantOpen ? t`Portfolio assistant` : t`Edit portfolio`}
			actions={
				portfolio ? (
					<>
						<IconButton
							icon="arrow-counter-clockwise"
							label={t`Undo`}
							isDisabled={!current.undoStack.length || pane === "publish"}
							onPress={current.undo}
						/>
						<IconButton
							icon="arrow-clockwise"
							label={t`Redo`}
							isDisabled={!current.redoStack.length || pane === "publish"}
							onPress={current.redo}
						/>
						<IconButton
							icon="eye"
							label={t`Preview`}
							testID="portfolio-editor-preview"
							isDisabled={!online || opening}
							onPress={() => void preview()}
						/>
					</>
				) : undefined
			}
		>
			{portfolio ? (
				<>
					<View className="gap-2 border-b border-border px-4 pb-3">
						<Text
							tone={status === "invalid" || status === "conflict" || status === "gone" ? "danger" : "muted"}
							accessibilityLiveRegion="polite"
						>
							{labels[status]}
						</Text>
						{status === "invalid" && current.problem?.kind === "field" ? (
							<Text tone="muted" selectable>
								{current.problem.path.join(" / ")}
							</Text>
						) : null}
						{status === "error" && online ? (
							<Button size="sm" variant="secondary" onPress={() => void current.flush()}>{t`Retry save`}</Button>
						) : null}
						{status === "conflict" ? (
							<View className="flex-row flex-wrap gap-2">
								<Button
									size="sm"
									variant="secondary"
									isDisabled={!online}
									onPress={() => void reload()}
								>{t`Use saved version`}</Button>
								<Button
									size="sm"
									variant="secondary"
									isDisabled={!online || !current.conflict?.updatedAt}
									onPress={() => void current.keepMine()}
								>{t`Keep my changes`}</Button>
							</View>
						) : null}
						<Segment<Pane>
							accessibilityLabel={t`Portfolio editor sections`}
							value={pane}
							onValueChange={(next) => void changePane(next)}
							options={[
								{ value: "content", label: t`Content` },
								{ value: "work", label: t`Work` },
								{ value: "design", label: t`Design` },
								{ value: "publish", label: t`Publish` },
							]}
						/>
						{pane === "work" && !assistantOpen ? (
							<Button
								size="sm"
								variant="secondary"
								isDisabled={!online}
								onPress={() => setAssistantOpen(true)}
							>{t`Portfolio assistant`}</Button>
						) : null}
					</View>
					<View className="flex-1 flex-row">
						<View className="flex-1">
							{assistantOpen ? (
								<PortfolioAssistant
									initialThread={initialThread}
									portfolio={portfolio}
									workId={pane === "work" ? workId : null}
									onBack={() => {
										setAssistantOpen(false);
										if (initialThread) router.setParams({ thread: undefined });
									}}
								/>
							) : null}
							{!assistantOpen && pane === "content" ? (
								<Content
									data={portfolio.data}
									contactAvailable={contactAvailable}
									actions={
										<AiTools hasSource={portfolio.data.useProfileSource !== false && !portfolio.sourceResume?.inTrash}>
											<Button
												size="sm"
												variant="secondary"
												isDisabled={!online}
												onPress={() => setAssistantOpen(true)}
											>{t`Portfolio assistant`}</Button>
										</AiTools>
									}
								/>
							) : null}
							{!assistantOpen && pane === "work" ? (
								<WorkPane portfolio={portfolio} limit={limit} workId={workId} onOpen={setWorkId} />
							) : null}
							{!assistantOpen && pane === "design" ? <Design data={portfolio.data} /> : null}
							{pane === "publish" ? <PublishSettings portfolio={remote} refresh={refresh} /> : null}
						</View>
						{wide && pane !== "publish" && online ? (
							<View className="flex-1 border-l border-border">
								<PortfolioPreview
									key={focusedWork?.id ?? "home"}
									initialWorkId={focusedWork?.id}
									version={version}
									compact
								/>
							</View>
						) : null}
					</View>
				</>
			) : (
				<PortfolioLoadState />
			)}
		</PortfolioPage>
	);
}
