import type { Portfolio } from "./queries";
import type { PortfolioAiDraft } from "@rezumi/portfolio/draft";
import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { produce } from "immer";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { applyPortfolioDraft, countPortfolioPlaceholders } from "@rezumi/portfolio/draft";
import { portfolioThemePicture } from "@rezumi/portfolio/sharing";
import { htmlToText } from "@rezumi/portfolio/text";
import { PORTFOLIO_AI_NOTE_LENGTH } from "@rezumi/schema/portfolio/ai";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { defaultPortfolioTheme, portfolioThemeLineup } from "@rezumi/schema/portfolio/themes";
import { PortfolioLoadState, PortfolioPage } from "./layout";
import { usePortfolio, usePortfolioAction } from "./queries";
import { client, orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { routes } from "@/routes";
import {
	Button,
	Card,
	EmptyState,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	PickerSheet,
	Screen,
	Spinner,
	Switch,
	Text,
	TextArea,
	TextField,
	Typography,
	cx,
	showToast,
} from "@/ui";

type Source = { kind: "profile" | "empty" } | { kind: "resume"; id: string; name: string };

export function CreatePortfolioScreen() {
	const { t } = useLingui();
	const query = usePortfolio();
	const online = useOnline();
	const router = useRouter();
	const close = () => (router.canGoBack() ? router.back() : router.replace(routes.portfolio()));
	return (
		<PortfolioPage title={t`Create portfolio`}>
			{!query.data ? (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			) : !query.data.enabled ? (
				<Screen>
					<EmptyState kind="page" title={t`Portfolios aren't available for this account.`} />
				</Screen>
			) : (
				<CreatePortfolioForm existing={query.data.portfolio} close={close} />
			)}
		</PortfolioPage>
	);
}

type CreatePortfolioFormProps = { existing: Portfolio | null; close: () => void };

function CreatePortfolioForm({ existing, close }: CreatePortfolioFormProps) {
	const { t, i18n } = useLingui();
	const { server } = useSession();
	const online = useOnline();
	const [source, setSource] = useState<Source>({ kind: "profile" });
	const [resumePicker, setResumePicker] = useState(false);
	const [theme, setTheme] = useState<PortfolioTheme>(defaultPortfolioTheme);
	const [name, setName] = useState("");
	const [withAi, setWithAi] = useState(false);
	const [createdHere, setCreatedHere] = useState<Portfolio | null>(null);
	const resumes = useQuery({ ...orpc.resume.list.queryOptions(), enabled: online });
	const plan = usePlan();
	const premium = hasPlanFeature(plan, "premiumPortfolioThemes");
	const ai = useHasAIProvider();
	const action = usePortfolioAction();
	const disabled = !online || action.isPending;
	const useAi = withAi && source.kind !== "empty" && ai.hasAIProvider;

	if (createdHere) return <DraftPortfolioForm portfolio={createdHere} close={close} />;
	if (existing)
		return (
			<Screen>
				<EmptyState
					kind="page"
					title={t`You already have a portfolio`}
					action={{ label: t`Open portfolio`, onPress: close }}
				/>
			</Screen>
		);

	const create = () =>
		action.mutate(async () => {
			const portfolio = await client.portfolio.create({
				sourceResumeId: source.kind === "resume" ? source.id : null,
				...(source.kind === "empty" ? { startEmpty: true, basics: { name: name.trim() } } : {}),
				theme,
			});
			if (useAi) setCreatedHere(portfolio);
			else close();
		});

	return (
		<Screen>
			<ListSection title={t`Start with`}>
				<ListRow
					title={t`Your Profile`}
					description={t`Bring in work and career details from your Profile.`}
					isSelected={source.kind === "profile"}
					onPress={() => setSource({ kind: "profile" })}
					isDisabled={disabled}
				/>
				<ListRow
					title={t`A resume`}
					description={
						source.kind === "resume"
							? source.name
							: resumes.isError
								? t`Couldn't load your resumes.`
								: resumes.isPending
									? t`Loading resumes…`
									: !resumes.data?.length
										? t`You don't have a resume yet.`
										: t`Choose a resume to use as your source.`
					}
					isSelected={source.kind === "resume"}
					onPress={() => (resumes.isError ? void resumes.refetch() : setResumePicker(true))}
					isDisabled={disabled || (!resumes.isError && !resumes.data?.length)}
				/>
				<ListRow
					title={t`A blank page`}
					description={t`Start with your name and a theme.`}
					isSelected={source.kind === "empty"}
					onPress={() => setSource({ kind: "empty" })}
					isDisabled={disabled}
				/>
			</ListSection>
			{source.kind === "empty" ? (
				<TextField isDisabled={disabled}>
					<Label>{t`Name`}</Label>
					<Input
						accessibilityLabel={t`Name`}
						value={name}
						maxLength={PORTFOLIO_LIMITS.text.name}
						onChangeText={setName}
						autoCapitalize="words"
					/>
				</TextField>
			) : null}
			<View className="gap-3">
				<Typography.Heading type="h5">{t`Choose a theme`}</Typography.Heading>
				<View className="flex-row flex-wrap justify-between gap-y-3">
					{portfolioThemeLineup.map((item) => {
						const locked = item.plan === "plus" && !premium;
						const selected = item.id === theme;
						return (
							<Pressable
								key={item.id}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected, disabled: locked || disabled }}
								accessibilityLabel={locked ? t`${item.name}, available with Plus` : item.name}
								testID={`portfolio-theme-${item.id}`}
								disabled={locked || disabled}
								onPress={() => setTheme(item.id)}
								className={cx(
									"w-[48%] overflow-hidden rounded-xl border bg-surface",
									selected ? "border-accent" : "border-border",
								)}
							>
								<Image
									source={{ uri: `${server}${portfolioThemePicture(item.id, i18n.locale).thumb}` }}
									resizeMode="cover"
									className="aspect-video w-full bg-surface-secondary"
								/>
								<View className="flex-row items-center justify-between gap-2 p-3">
									<Text weight="semibold">{item.name}</Text>
									{locked ? (
										<Text size="xs" tone="muted">
											Plus
										</Text>
									) : selected ? (
										<Icon name="check" size={16} tone="accent" />
									) : null}
								</View>
							</Pressable>
						);
					})}
				</View>
			</View>
			{source.kind !== "empty" && ai.hasAIProvider ? (
				<ListSection>
					<ListRow
						title={t`Draft with AI`}
						description={t`Review suggested writing before saving it to your draft.`}
						trailing={
							<Switch
								accessibilityLabel={t`Draft with AI`}
								isSelected={withAi}
								isDisabled={disabled}
								onSelectedChange={setWithAi}
							/>
						}
					/>
				</ListSection>
			) : null}
			<Button
				testID="portfolio-create-submit"
				isDisabled={
					disabled ||
					(theme !== defaultPortfolioTheme &&
						!premium &&
						portfolioThemeLineup.some((item) => item.id === theme && item.plan === "plus"))
				}
				onPress={create}
			>
				{action.isPending ? <Spinner size="sm" /> : null}
				<Button.Label>{t`Create draft`}</Button.Label>
			</Button>
			<PickerSheet
				isOpen={resumePicker}
				onOpenChange={setResumePicker}
				title={t`Choose a resume`}
				closeLabel={t`Close`}
				searchLabel={t`Find a resume`}
				options={(resumes.data ?? []).map((resume) => ({ value: resume.id, label: resume.name }))}
				emptyLabel={() => t`No resumes found.`}
				value={source.kind === "resume" ? source.id : null}
				onPick={(id) => {
					const resume = resumes.data?.find((item) => item.id === id);
					if (resume) setSource({ kind: "resume", id, name: resume.name });
				}}
			/>
		</Screen>
	);
}

type DraftPortfolioFormProps = { portfolio: Portfolio; close: () => void };

function DraftPortfolioForm({ portfolio, close }: DraftPortfolioFormProps) {
	const { t } = useLingui();
	const online = useOnline();
	const write = usePortfolioAction();
	const [note, setNote] = useState("");
	const [draft, setDraft] = useState<PortfolioAiDraft | null>(null);
	const disabled = !online || write.isPending;

	return (
		<Screen>
			<Typography.Heading type="h4">{draft ? t`Review the AI draft` : t`Draft with AI`}</Typography.Heading>
			{draft ? (
				<>
					<Card className="gap-3">
						{draft.greeting ? <Text weight="semibold">{draft.greeting}</Text> : null}
						{draft.about ? <Text>{htmlToText(draft.about)}</Text> : null}
						{draft.works.map((work) => (
							<View key={work.id} className="gap-1">
								<Text weight="semibold">{portfolio.data.works.items.find((item) => item.id === work.id)?.title}</Text>
								{work.summary ? <Text>{work.summary}</Text> : null}
								{work.html ? <Text>{htmlToText(work.html)}</Text> : null}
							</View>
						))}
					</Card>
					<Button
						isDisabled={disabled}
						onPress={() =>
							write.mutate(async () => {
								const data = produce(portfolio.data, (data) => applyPortfolioDraft(data, draft));
								await client.portfolio.update({ data, expectedUpdatedAt: portfolio.updatedAt });
								showToast({
									title: countPortfolioPlaceholders(data)
										? t`Draft saved. Fill in the text in brackets before publishing.`
										: t`Draft saved`,
								});
								close();
							})
						}
					>{t`Save to portfolio`}</Button>
				</>
			) : (
				<>
					<TextField isDisabled={disabled}>
						<Label>{t`Instructions (optional)`}</Label>
						<TextArea
							accessibilityLabel={t`Instructions (optional)`}
							value={note}
							onChangeText={setNote}
							maxLength={PORTFOLIO_AI_NOTE_LENGTH}
						/>
					</TextField>
					<Button
						isDisabled={disabled}
						onPress={() =>
							write.mutate(async () => {
								setDraft(await client.portfolio.ai.draft(note.trim() ? { note: note.trim() } : {}));
							})
						}
					>
						{write.isPending ? <Spinner size="sm" /> : null}
						<Button.Label>{t`Generate draft`}</Button.Label>
					</Button>
				</>
			)}
			<Button variant="tertiary" isDisabled={write.isPending} onPress={close}>{t`Keep original draft`}</Button>
		</Screen>
	);
}
