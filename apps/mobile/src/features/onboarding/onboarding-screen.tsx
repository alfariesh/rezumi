// The first run after signing up (K5, the web's /onboarding): bring what you have, two questions while it's read,
// review what was found, then a template for the first resume, which opens in the builder. Skip is always there and
// saves the Profile as it stands, so this opens once. The steps' rules live in @rezumi/career/onboarding and the
// sources' in @rezumi/resume/profile-sources, shared with the web. Closing the app keeps the run (saved-run.ts).
import type { ProfileDto, SourcesStatus } from "./queries";
import type { OnboardingStep } from "@rezumi/career/onboarding";
import type { SourceAvailability } from "@rezumi/resume/profile-sources";
import type { CareerProfileData } from "@rezumi/schema/career";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { Template } from "@rezumi/schema/templates";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useRef, useState } from "react";
import { BackHandler, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { answersOf, nextStep, ONBOARDING_STEPS, previousStep, sameAnswers, skipSaves } from "@rezumi/career/onboarding";
import { countReviewEntries, SOURCE_IDS } from "@rezumi/resume/profile-sources";
import { defaultTemplate } from "@rezumi/schema/templates";
import { sourceLabel } from "./messages";
import { preferencesKey, profileQuery, storeSavedProfile, useOnboardingData } from "./queries";
import { Questions } from "./questions";
import { clearSavedOnboarding, loadSavedOnboarding, storeSavedOnboarding } from "./saved-run";
import { AccountSummary, SourceFields, SourcesNote } from "./source-fields";
import { SourceProgress } from "./source-progress";
import { SourceReview } from "./source-review";
import { TemplateChoice } from "./template-choice";
import { useSourcesFlow } from "./use-sources-flow";
import { client, orpc } from "@/api/client";
import { getAccountScope, useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { useNewDocuments } from "@/features/documents/new-documents";
import { routes } from "@/routes";
import {
	Button,
	Card,
	EmptyState,
	Icon,
	Screen,
	Separator,
	Skeleton,
	SkeletonGroup,
	Stepper,
	Text,
	Typography,
	cx,
	haptics,
	showToast,
} from "@/ui";
import { KeyboardFrame, useKeyboardVisible } from "@/ui/keyboard";

const isVersionConflict = (error: unknown) => error instanceof ORPCError && error.code === "PROFILE_VERSION_CONFLICT";

// Third-party views (keyboard controller) take no className.
const fill = { flex: 1 };

export function OnboardingScreen() {
	const { t } = useLingui();
	const { profile, preferences, status } = useOnboardingData();

	if ((profile.isError && !profile.data) || (preferences.isError && !preferences.data))
		return (
			<OnboardingFrame step="bring">
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load your details`}
					description={t`Check your connection, then try again.`}
					action={{
						label: t`Try again`,
						onPress: () => {
							void profile.refetch();
							void preferences.refetch();
						},
					}}
				/>
			</OnboardingFrame>
		);

	// Without the sources' status (an older server, a failed read) a file and GitHub still work.
	const sources: SourcesStatus | undefined = status.isError ? fallbackStatus : status.data;
	if (!profile.data || !preferences.data || !sources) return <OnboardingSkeleton />;

	return <Onboarding profile={profile.data} preferences={preferences.data} status={sources} />;
}

const fallbackStatus: SourcesStatus = {
	linkedin: false,
	github: true,
	website: false,
	account: { name: "", email: "", image: null, githubUsername: null, providers: [] },
};

type OnboardingProps = { profile: ProfileDto; preferences: CareerProfileData; status: SourcesStatus };

function Onboarding({ profile, preferences, status }: OnboardingProps) {
	const { t } = useLingui();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const ai = useHasAIProvider();
	const { width } = useWindowDimensions();
	// The account this run belongs to, fixed for the screen's life: a switch mid-way must not save into another one.
	const [scope] = useState(getAccountScope);
	const [restore] = useState(() => loadSavedOnboarding(Storage, scope));
	const [step, setStep] = useState<OnboardingStep>(restore?.step ?? "bring");
	// The Profile the sources add to, and the version saved here (null until onboarding saves it).
	const [base, setBase] = useState(profile);
	const [saved, setSaved] = useState<{ data: ProfileData; updatedAt: Date | null } | null>(() =>
		restore?.savedAt ? { data: profile.data, updatedAt: profile.updatedAt } : null,
	);
	const [answers, setAnswers] = useState(() => restore?.answers ?? answersOf(preferences));
	const savedAnswers = useRef(answersOf(preferences));
	const [template, setTemplate] = useState<Template>(restore?.template ?? defaultTemplate);
	const [busy, setBusy] = useState<"skip" | "save" | "create" | null>(null);
	const copiedPhotos = useRef(new Map<string, string>());
	const availability: SourceAvailability = {
		linkedin: status.linkedin,
		github: status.github,
		website: status.website,
	};
	const flow = useSourcesFlow({
		base: base.data,
		availability,
		accountImage: status.account.image,
		github: status.account.githubUsername ?? "",
		aiAvailable: ai.hasAIProvider,
		restore,
	});
	const version = saved ? saved.updatedAt : base.updatedAt;
	const finished = useRef(false);

	// Keeps the run on this device as it goes, so closing the app picks it up at the same step.
	useEffect(() => {
		if (finished.current) return;
		const { linkedin, linkedinOwn, github, website } = flow.inputs;
		storeSavedOnboarding(Storage, scope, {
			step,
			inputs: { linkedin, linkedinOwn, github, website },
			answers,
			runs: flow.runs,
			excluded: [...flow.excluded],
			...(flow.photoChoice !== undefined ? { photo: flow.photoChoice } : {}),
			template,
			savedAt: saved ? (saved.updatedAt?.toISOString() ?? new Date().toISOString()) : null,
		});
	}, [scope, step, flow.inputs, answers, flow.runs, flow.excluded, flow.photoChoice, template, saved]);

	const leave = (next: () => void) => {
		finished.current = true;
		clearSavedOnboarding(Storage, scope);
		next();
	};
	const toHome = () => leave(() => (router.canGoBack() ? router.back() : router.replace(routes.home())));

	/** Saves the answers when they changed; a failure only says so, since both are optional. */
	const saveAnswers = () => {
		if (sameAnswers(answers, savedAnswers.current)) return;
		const previous = savedAnswers.current;
		savedAnswers.current = answers;
		const current = queryClient.getQueryData<CareerProfileData>(preferencesKey(server)) ?? preferences;
		client.career.saveProfile({ ...current, ...answers }).then(
			(result) => queryClient.setQueryData(preferencesKey(server), result),
			() => {
				savedAnswers.current = previous;
				showToast({
					title: t`Couldn't save your answers. You can add them later in Profile → Preferences.`,
					variant: "danger",
				});
			},
		);
	};

	/** Saves the Profile; a save made elsewhere meanwhile reloads it to review again. Returns whether it saved. */
	const saveProfile = async (data: ProfileData) => {
		try {
			const result = await client.profile.update({ data, expectedUpdatedAt: version });
			storeSavedProfile(queryClient, server, result);
			setSaved({ data: result.data, updatedAt: result.updatedAt });
			return true;
		} catch (error) {
			if (isVersionConflict(error)) {
				const fresh = await queryClient.fetchQuery({ ...profileQuery(server), staleTime: 0 }).catch(() => null);
				if (fresh) {
					setBase(fresh);
					setSaved(null);
				}
				showToast({ title: t`Your Profile was changed somewhere else. Check what's new, then save again.` });
			} else showToast({ title: t`Couldn't save your Profile. Try again.`, variant: "danger" });
			return false;
		}
	};

	const goTo = (next: OnboardingStep | null) => {
		if (next) setStep(next);
	};

	const continueFromBring = () => {
		if (flow.start()) {
			haptics.error();
			return;
		}
		goTo(nextStep("bring", flow.runs));
	};

	const startFromScratch = () => {
		flow.skip();
		setStep("questions");
	};

	const continueFromQuestions = async () => {
		saveAnswers();
		const next = nextStep("questions", flow.runs);
		// Nothing to review: the Profile is saved as it stands before the first resume starts from it.
		if (next === "resume" && saved === null) {
			setBusy("save");
			const ok = await saveProfile(base.data);
			setBusy(null);
			if (!ok) return;
		}
		goTo(next);
	};

	const saveReview = async () => {
		setBusy("save");
		const { data, photoFailed } = await flow.finish(copiedPhotos.current);
		const ok = await saveProfile(data);
		setBusy(null);
		if (!ok) return;
		if (photoFailed) showToast({ title: t`Couldn't copy the photo. You can add one later in your Profile.` });
		setStep("resume");
	};

	const createResume = async () => {
		setBusy("create");
		try {
			const resumeId = await client.resume.create({
				name: t`Untitled resume`,
				tags: [],
				autoName: true,
				withSampleData: false,
				template,
			});
			useNewDocuments.getState().markNew({ id: resumeId, type: "resume" });
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			haptics.success();
			leave(() => router.replace(routes.builder(resumeId)));
		} catch {
			// A plan refusal explains itself (API client); anything else says to try again.
			setBusy(null);
			showToast({ title: t`Couldn't create the resume. Try again.`, variant: "danger" });
		}
	};

	const skip = async () => {
		saveAnswers();
		if (skipSaves(saved !== null)) {
			setBusy("skip");
			try {
				const result = await client.profile.update({ data: base.data, expectedUpdatedAt: version });
				storeSavedProfile(queryClient, server, result);
			} catch (error) {
				// Saved somewhere else meanwhile: it exists, so onboarding won't open again either.
				if (!isVersionConflict(error)) {
					setBusy(null);
					showToast({ title: t`Couldn't save your Profile, so this would open again. Try again.`, variant: "danger" });
					return;
				}
				await queryClient.fetchQuery({ ...profileQuery(server), staleTime: 0 }).catch(() => null);
			}
		}
		toHome();
	};

	const back = previousStep(step, flow.runs);

	// Android's back button steps back, and never leaves onboarding without Skip.
	useEffect(() => {
		const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
			if (back && busy === null) setStep(back);
			return true;
		});
		return () => subscription.remove();
	}, [back, busy]);

	const backButton = back ? (
		<Button variant="ghost" isDisabled={busy !== null} onPress={() => goTo(back)} testID="onboarding-back">
			<Icon name="arrow-left" size={16} />
			<Button.Label>{t`Back`}</Button.Label>
		</Button>
	) : (
		<View />
	);

	const waitingFor = SOURCE_IDS.filter((id) => flow.runs[id]?.status === "loading").map(sourceLabel);
	const ran = Object.keys(flow.runs).length > 0;
	const frame = { step, onSkip: () => void skip(), skipping: busy === "skip" };

	switch (step) {
		case "bring":
			return (
				<OnboardingFrame
					{...frame}
					title={t`Bring what you have`}
					description={t`Add any of these and we'll fill in your Profile. You check everything before it's saved.`}
					footer={
						<>
							<Button variant="tertiary" onPress={startFromScratch} testID="onboarding-scratch">
								<Button.Label>{t`Start from scratch`}</Button.Label>
							</Button>
							<Button isDisabled={!flow.hasInput} onPress={continueFromBring} testID="onboarding-continue">
								<Button.Label>{t`Continue`}</Button.Label>
							</Button>
						</>
					}
				>
					<Card>
						<Card.Body className="gap-6">
							{status.account.name || status.account.email ? (
								<>
									<AccountSummary account={status.account} />
									<Separator />
								</>
							) : null}
							<SourceFields
								inputs={flow.inputs}
								onChange={flow.change}
								availability={availability}
								problems={flow.problems}
								accountGithub={status.account.githubUsername}
								restoredFile={flow.restoredFile}
								onRemoveRestoredFile={flow.removeRestoredFile}
							/>
						</Card.Body>
					</Card>
					<SourcesNote availability={availability} />
				</OnboardingFrame>
			);

		case "questions":
			return (
				<OnboardingFrame
					{...frame}
					title={ran ? t`While we read your details` : t`Two quick questions`}
					description={t`Both are optional. They help the coach find roles that fit you.`}
					footer={
						<>
							{backButton}
							<Button
								isDisabled={busy === "save"}
								onPress={() => void continueFromQuestions()}
								testID="onboarding-continue"
							>
								<Button.Label>
									{busy === "save" ? t`Saving…` : ran && !flow.fetching ? t`Review what we found` : t`Continue`}
								</Button.Label>
							</Button>
						</>
					}
				>
					{ran ? (
						<Card>
							<Card.Body>
								<SourceProgress runs={flow.runs} onRetry={flow.retry} />
							</Card.Body>
						</Card>
					) : null}
					<Card>
						<Card.Body>
							<Questions value={answers} onChange={setAnswers} />
						</Card.Body>
					</Card>
				</OnboardingFrame>
			);

		case "review": {
			const found = flow.groups.length > 0 || flow.photos.length > 0;
			const kept = countReviewEntries(flow.groups, flow.excluded);
			const settled = !flow.fetching;
			const allDone = SOURCE_IDS.every((id) => !flow.runs[id] || flow.runs[id]?.status === "done");
			return (
				<OnboardingFrame
					{...frame}
					title={t`Check what we found`}
					description={t`Untick anything you'd rather leave out. You can change it all later in your Profile.`}
					footer={
						<>
							{backButton}
							<Button
								isDisabled={!settled || busy === "save"}
								onPress={() => void saveReview()}
								className="shrink"
								testID="onboarding-continue"
							>
								<Button.Label numberOfLines={1}>
									{!settled
										? t`Waiting for ${waitingFor.join(", ")}…`
										: busy === "save"
											? t`Saving…`
											: found && (kept > 0 || flow.photo)
												? t`Save to my Profile`
												: t`Continue`}
								</Button.Label>
							</Button>
						</>
					}
				>
					{!allDone ? (
						<Card>
							<Card.Body>
								<SourceProgress runs={flow.runs} onRetry={flow.retry} />
							</Card.Body>
						</Card>
					) : null}
					{found ? (
						<Card>
							<Card.Body className="gap-4">
								<Text weight="medium" accessibilityLiveRegion="polite">
									{kept === 1 ? t`1 entry ticked` : t`${kept} entries ticked`}
								</Text>
								<SourceReview
									merged={flow.merged}
									groups={flow.groups}
									excluded={flow.excluded}
									onExcludedChange={flow.setExcluded}
									photos={flow.photos}
									photo={flow.photo}
									onPhotoChange={flow.setPhoto}
									name={base.data.basics.name || status.account.name}
								/>
							</Card.Body>
						</Card>
					) : settled ? (
						<EmptyState
							kind="page"
							icon="magnifying-glass"
							title={t`Nothing new to add`}
							description={t`Your Profile already has what we found, or the sources couldn't be read. Fill it in any time.`}
						/>
					) : null}
				</OnboardingFrame>
			);
		}

		case "resume":
			return (
				<OnboardingFrame
					step={step}
					title={t`Pick a look for your first resume`}
					description={t`It starts with your Profile. You can switch templates any time.`}
					onSkip={toHome}
					skipLabel={t`Not now`}
					footer={
						<>
							{backButton}
							<Button isDisabled={busy === "create"} onPress={() => void createResume()} testID="onboarding-create">
								<Button.Label>{busy === "create" ? t`Creating…` : t`Create my resume`}</Button.Label>
							</Button>
						</>
					}
				>
					<Card>
						<Card.Body>
							<TemplateChoice
								profile={saved?.data ?? base.data}
								value={template}
								onChange={setTemplate}
								// The page's gutter (16) and the card's padding (16), both sides, within the readable width.
								width={Math.min(width, 720) - 64}
							/>
						</Card.Body>
					</Card>
				</OnboardingFrame>
			);
	}
}

type OnboardingFrameProps = {
	step: OnboardingStep;
	title?: string | undefined;
	description?: string | undefined;
	onSkip?: (() => void) | undefined;
	skipLabel?: string | undefined;
	skipping?: boolean | undefined;
	footer?: ReactNode;
	children: ReactNode;
};

/**
 * The full-screen frame: where you are in four steps and Skip on top; the step's title, its content, and Back and the
 * one main action at the bottom, above the keyboard. Kept to a readable width on tablets.
 */
function OnboardingFrame(props: OnboardingFrameProps) {
	const { step, title, description, onSkip, skipLabel, skipping = false, footer, children } = props;
	const { t } = useLingui();
	const insets = useSafeAreaInsets();
	// While typing, the field being typed in sits just above the keyboard: the actions wait until it closes.
	const typing = useKeyboardVisible();
	const titles: Record<OnboardingStep, string> = {
		bring: t`Your details`,
		questions: t`Questions`,
		review: t`Review`,
		resume: t`First resume`,
	};
	const top = { paddingTop: insets.top };
	const bottom = { paddingBottom: Math.max(insets.bottom, 12) };

	return (
		<View className="flex-1 bg-background" testID={`onboarding-${step}`}>
			<View className="gap-3 bg-background px-4 pb-3" style={top}>
				<View className="min-h-11 flex-row items-center justify-between">
					<Text size="xs" weight="semibold" tone="muted">
						{t`Step ${ONBOARDING_STEPS.indexOf(step) + 1} of ${ONBOARDING_STEPS.length}`}
					</Text>
					{onSkip ? (
						<Button variant="ghost" size="sm" isDisabled={skipping} onPress={onSkip} testID="onboarding-skip">
							<Button.Label>{skipping ? t`Saving…` : (skipLabel ?? t`Skip`)}</Button.Label>
						</Button>
					) : null}
				</View>
				<Stepper
					orientation="horizontal"
					currentStep={ONBOARDING_STEPS.indexOf(step)}
					steps={ONBOARDING_STEPS.map((id) => ({ title: titles[id] }))}
					stepLabel={(index, total) => t`Step ${index} of ${total}`}
				/>
			</View>
			<KeyboardFrame behavior="padding" style={fill}>
				{/* A new step starts at its top, not where the last one was scrolled to. */}
				<Screen key={step}>
					<View className="w-full max-w-[720px] gap-5 self-center">
						{title ? (
							<View className="gap-2">
								<Typography.Heading type="h2" accessibilityRole="header">
									{title}
								</Typography.Heading>
								{description ? (
									<Typography type="body-sm" color="muted">
										{description}
									</Typography>
								) : null}
							</View>
						) : null}
						{children}
					</View>
				</Screen>
				{footer && !typing ? (
					<View className="border-t border-separator bg-background px-4 pt-3" style={bottom}>
						<View className={cx("w-full max-w-[720px] flex-row items-center justify-between gap-3 self-center")}>
							{footer}
						</View>
					</View>
				) : null}
			</KeyboardFrame>
		</View>
	);
}

/** While the Profile and Preferences load: the first step's shape, so nothing jumps. */
function OnboardingSkeleton() {
	const { t } = useLingui();
	return (
		<OnboardingFrame step="bring">
			<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-5">
				<SkeletonGroup isLoading variant="none" className="gap-2">
					<Skeleton className="h-9 w-64 rounded-lg" />
					<Skeleton className="h-5 w-full rounded-md" />
				</SkeletonGroup>
				<Card>
					<Card.Body className="gap-6">
						<SkeletonGroup isLoading variant="none" className="flex-row items-center gap-3">
							<Skeleton className="size-12 rounded-full" />
							<View className="flex-1 gap-1.5">
								<Skeleton className="h-4 w-40 rounded-md" />
								<Skeleton className="h-3 w-56 rounded-md" />
							</View>
						</SkeletonGroup>
						{[0, 1, 2].map((row) => (
							<SkeletonGroup key={row} isLoading variant="none" className="gap-2">
								<Skeleton className="h-4 w-32 rounded-md" />
								<Skeleton className="h-12 rounded-xl" />
							</SkeletonGroup>
						))}
					</Card.Body>
				</Card>
			</View>
		</OnboardingFrame>
	);
}
