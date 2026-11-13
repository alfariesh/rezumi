import type { OnboardingStep } from "./steps";
import type { ProfileDto } from "@/features/profile/queries";
import type { SourceAvailability } from "@/features/profile/sources/model";
import type { AuthSession } from "@rezumi/auth/types";
import type { CareerProfileData } from "@rezumi/schema/career";
import type { ProfileData } from "@rezumi/schema/profile/data";
import type { SourcesStatus } from "@rezumi/schema/profile/sources";
import type { Template } from "@rezumi/schema/templates";
import type { ReactNode } from "react";
import { Stepper } from "@heroui-pro/react";
import { Button, Card, Separator, Skeleton, Typography } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import { defaultTemplate } from "@rezumi/schema/templates";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { formatList } from "@rezumi/utils/locale";
import { cn } from "@rezumi/utils/style";
import { answersOf, Questions, sameAnswers } from "./questions";
import { nextStep, ONBOARDING_STEPS, previousStep, skipSaves } from "./steps";
import { TemplateChoice } from "./template-choice";
import { PAGE_GUTTER } from "@/components/layout/page";
import { openPlanDialogForError } from "@/features/billing/plan-dialog";
import { CareerLoadError } from "@/features/career/load-state";
import { useNewDocumentsStore } from "@/features/documents/new-documents";
import { profileQueryOptions, storeSavedProfile } from "@/features/profile/queries";
import { sourceLabel } from "@/features/profile/sources/messages";
import { countReviewEntries, SOURCE_IDS } from "@/features/profile/sources/model";
import { focusFirstProblem, SourceFields, SourcesNote } from "@/features/profile/sources/source-fields";
import { SourceProgress } from "@/features/profile/sources/source-progress";
import { SourceReview } from "@/features/profile/sources/source-review";
import { finishReview, useSourcesFlow } from "@/features/profile/sources/use-sources-flow";
import { UserAvatar } from "@/features/user/avatar";
import { toastError } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { client, orpc } from "@/libs/orpc/client";

const FIELD_PREFIX = "onboarding-source";

const isVersionConflict = (error: unknown) => error instanceof ORPCError && error.code === "PROFILE_VERSION_CONFLICT";

type OnboardingPageProps = { session: AuthSession };

/**
 * The first run, full screen: bring what you have, two questions while it's read, review what was found, then pick a
 * template for the first resume. Skip is always there and saves the Profile as it stands, so this opens once.
 */
export function OnboardingPage({ session }: OnboardingPageProps) {
	const profile = useQuery(profileQueryOptions());
	const preferences = useQuery(orpc.career.profile.queryOptions());
	const status = useQuery(orpc.profile.sources.status.queryOptions());

	if ((profile.isError && !profile.data) || (preferences.isError && !preferences.data))
		return (
			<OnboardingFrame step="bring">
				<CareerLoadError
					onRetry={() => {
						void profile.refetch();
						void preferences.refetch();
					}}
				/>
			</OnboardingFrame>
		);

	// Without the sources' status (an older server, a failed read) a file and GitHub still work.
	const sources: SourcesStatus | undefined = status.isError ? fallbackStatus(session) : status.data;
	if (!profile.data || !preferences.data || !sources) return <OnboardingSkeleton />;

	return <Onboarding profile={profile.data} preferences={preferences.data} status={sources} />;
}

const fallbackStatus = (session: AuthSession): SourcesStatus => ({
	linkedin: false,
	github: true,
	website: false,
	account: {
		name: session.user.name,
		email: session.user.email,
		image: session.user.image ?? null,
		githubUsername: null,
		providers: [],
	},
});

type OnboardingProps = {
	profile: ProfileDto;
	preferences: CareerProfileData;
	status: SourcesStatus;
};

function Onboarding({ profile, preferences, status }: OnboardingProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const markNew = useNewDocumentsStore((state) => state.markNew);
	const [step, setStep] = useState<OnboardingStep>("bring");
	// The Profile the sources add to, and the version saved here (null until onboarding saves it).
	const [base, setBase] = useState(profile);
	const [saved, setSaved] = useState<{ data: ProfileData; updatedAt: Date | null } | null>(null);
	const [answers, setAnswers] = useState(() => answersOf(preferences));
	const savedAnswers = useRef(answersOf(preferences));
	const [template, setTemplate] = useState<Template>(defaultTemplate);
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
	});

	const version = saved ? saved.updatedAt : base.updatedAt;

	/** Saves the answers when they changed; a failure only says so, since both are optional. */
	const saveAnswers = () => {
		if (sameAnswers(answers, savedAnswers.current)) return;
		const previous = savedAnswers.current;
		savedAnswers.current = answers;
		const current = queryClient.getQueryData(orpc.career.profile.queryKey()) ?? preferences;
		client.career.saveProfile({ ...current, ...answers }).then(
			(result) => queryClient.setQueryData(orpc.career.profile.queryKey(), result),
			(error: unknown) => {
				savedAnswers.current = previous;
				toastError(error, t`Couldn't save your answers. You can add them later in Profile → Preferences.`);
			},
		);
	};

	/** Saves the Profile; a save made elsewhere meanwhile reloads it to review again. Returns whether it saved. */
	const saveProfile = async (data: ProfileData) => {
		try {
			const result = await client.profile.update({ data, expectedUpdatedAt: version });
			storeSavedProfile(queryClient, result);
			setSaved({ data: result.data, updatedAt: result.updatedAt });
			return true;
		} catch (error) {
			if (isVersionConflict(error)) {
				const fresh = await queryClient.fetchQuery({ ...profileQueryOptions(), staleTime: 0 }).catch(() => null);
				if (fresh) {
					setBase(fresh);
					setSaved(null);
				}
				toast.add({
					type: "warning",
					description: t`Your Profile was changed somewhere else. Check what's new, then save again.`,
				});
			} else {
				toastError(error, t`Couldn't save your Profile. Try again.`);
			}
			return false;
		}
	};

	const goTo = (next: OnboardingStep | null) => {
		if (next) setStep(next);
	};

	const continueFromBring = () => {
		const problems = flow.start();
		if (problems) {
			focusFirstProblem(FIELD_PREFIX, problems);
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
		const { data, photoFailed } = await finishReview(flow, copiedPhotos.current);
		const ok = await saveProfile(data);
		setBusy(null);
		if (!ok) return;
		if (photoFailed)
			toast.add({ type: "warning", description: t`Couldn't copy the photo. You can add one later in your Profile.` });
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
			markNew(resumeId);
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			void navigate({ to: "/builder/$resumeId", params: { resumeId }, replace: true });
		} catch (error) {
			setBusy(null);
			if (!openPlanDialogForError(error)) toastError(error, t`Couldn't create the resume. Try again.`);
		}
	};

	const skip = async () => {
		saveAnswers();
		if (skipSaves(saved !== null)) {
			setBusy("skip");
			try {
				const result = await client.profile.update({ data: base.data, expectedUpdatedAt: version });
				storeSavedProfile(queryClient, result);
			} catch (error) {
				// Saved somewhere else meanwhile: it exists, so onboarding won't open again either.
				if (!isVersionConflict(error)) {
					setBusy(null);
					toastError(error, t`Couldn't save your Profile, so this would open again. Try again.`);
					return;
				}
				await queryClient.fetchQuery({ ...profileQueryOptions(), staleTime: 0 }).catch(() => null);
			}
		}
		void navigate({ to: "/dashboard", replace: true });
	};

	const back = previousStep(step, flow.runs);
	const backButton = back && (
		<Button variant="ghost" isDisabled={busy !== null} onPress={() => goTo(back)}>
			<Icon name="arrow-left" size={18} className="rtl:-scale-x-100" />
			<Trans>Back</Trans>
		</Button>
	);

	const waitingFor = SOURCE_IDS.filter((id) => flow.runs[id]?.status === "loading").map(sourceLabel);

	switch (step) {
		case "bring":
			return (
				<OnboardingFrame
					step={step}
					title={t`Bring what you have`}
					description={t`Add any of these and we'll fill in your Profile. You check everything before it's saved.`}
					onSkip={() => void skip()}
					skipping={busy === "skip"}
					footer={
						<>
							<Button variant="tertiary" onPress={startFromScratch}>
								<Trans>Start from scratch</Trans>
							</Button>
							<Button isDisabled={!flow.hasInput} onPress={continueFromBring}>
								<Trans>Continue</Trans>
							</Button>
						</>
					}
				>
					<Card className="gap-6 p-4 sm:p-6">
						{(status.account.name || status.account.email) && (
							<>
								<AccountSummary account={status.account} />
								<Separator />
							</>
						)}
						<SourceFields
							idPrefix={FIELD_PREFIX}
							inputs={flow.inputs}
							onChange={flow.change}
							availability={availability}
							problems={flow.problems}
							accountGithub={status.account.githubUsername}
						/>
					</Card>
					<SourcesNote availability={availability} />
				</OnboardingFrame>
			);

		case "questions":
			return (
				<OnboardingFrame
					step={step}
					title={Object.keys(flow.runs).length > 0 ? t`While we read your details` : t`Two quick questions`}
					description={t`Both are optional. They help the coach find roles that fit you.`}
					onSkip={() => void skip()}
					skipping={busy === "skip"}
					footer={
						<>
							{backButton}
							<Button isPending={busy === "save"} onPress={() => void continueFromQuestions()}>
								{/* Sources usually take seconds: once they're in, the way on says where it leads. */}
								{Object.keys(flow.runs).length > 0 && !flow.fetching ? (
									<Trans>Review what we found</Trans>
								) : (
									<Trans>Continue</Trans>
								)}
							</Button>
						</>
					}
				>
					{Object.keys(flow.runs).length > 0 && (
						<Card className="p-4 sm:p-6">
							<SourceProgress runs={flow.runs} onRetry={flow.retry} />
						</Card>
					)}
					<Card className="p-4 sm:p-6">
						<Questions value={answers} onChange={setAnswers} />
					</Card>
				</OnboardingFrame>
			);

		case "review": {
			const found = flow.groups.length > 0 || flow.photos.length > 0;
			const kept = countReviewEntries(flow.groups, flow.excluded);
			const settled = SOURCE_IDS.every((id) => flow.runs[id]?.status !== "loading");
			const allDone = SOURCE_IDS.every((id) => !flow.runs[id] || flow.runs[id]?.status === "done");
			return (
				<OnboardingFrame
					step={step}
					title={t`Check what we found`}
					description={t`Untick anything you'd rather leave out. You can change it all later in your Profile.`}
					onSkip={() => void skip()}
					skipping={busy === "skip"}
					footer={
						<>
							{backButton}
							<Button
								isDisabled={!settled}
								isPending={busy === "save"}
								onPress={() => void saveReview()}
								className="min-w-0"
							>
								{!settled ? (
									<span className="truncate">
										<Trans>Waiting for {formatList(i18n.locale, waitingFor)}…</Trans>
									</span>
								) : found && (kept > 0 || flow.photo) ? (
									<Trans>Save to my Profile</Trans>
								) : (
									<Trans>Continue</Trans>
								)}
							</Button>
						</>
					}
				>
					{!allDone && (
						<Card className="p-4 sm:p-6">
							<SourceProgress runs={flow.runs} onRetry={flow.retry} />
						</Card>
					)}
					{found ? (
						<Card className="gap-4 p-2 sm:p-4">
							<p role="status" className="px-2 pt-2 text-sm font-medium sm:px-0 sm:pt-0">
								<Plural value={kept} one="# entry ticked" other="# entries ticked" />
							</p>
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
						</Card>
					) : (
						settled && <NothingFound />
					)}
				</OnboardingFrame>
			);
		}

		case "resume":
			return (
				<OnboardingFrame
					step={step}
					title={t`Pick a look for your first resume`}
					description={t`It starts with your Profile. You can switch templates any time.`}
					onSkip={() => void navigate({ to: "/dashboard", replace: true })}
					skipLabel={t`Not now`}
					footer={
						<>
							{backButton}
							<Button isPending={busy === "create"} onPress={() => void createResume()}>
								<Trans>Create my resume</Trans>
							</Button>
						</>
					}
				>
					<Card className="p-4 sm:p-6">
						<TemplateChoice profile={saved?.data ?? base.data} value={template} onChange={setTemplate} />
					</Card>
				</OnboardingFrame>
			);
	}
}

type OnboardingFrameProps = {
	step: OnboardingStep;
	title?: string;
	description?: string;
	onSkip?: () => void;
	skipLabel?: string;
	skipping?: boolean;
	footer?: ReactNode;
	children: ReactNode;
};

/**
 * The full-screen frame: the brand, where you are in four steps and Skip on top; the step's title, its content, and
 * Back and the one main action at the bottom. Each step's title takes focus when it opens.
 */
function OnboardingFrame(props: OnboardingFrameProps) {
	const { step, title, description, onSkip, skipLabel, skipping = false, footer, children } = props;
	const headingRef = useRef<HTMLHeadingElement>(null);
	const descriptionId = useId();
	const shown = useRef(false);

	// The first step's title is where a reader starts anyway; later steps move focus there, so Back and Continue
	// never leave it on a button that has gone.
	useEffect(() => {
		if (!title) return;
		if (shown.current) headingRef.current?.focus({ preventScroll: false });
		shown.current = true;
	}, [step, title]);

	const titles: Record<OnboardingStep, string> = {
		bring: t`Your details`,
		questions: t`Questions`,
		review: t`Review`,
		resume: t`First resume`,
	};

	return (
		<div className="flex min-h-svh flex-col bg-background">
			<header
				className={cn(
					"sticky top-0 z-20 grid h-16 grid-cols-[auto_1fr_auto] items-center gap-3 bg-background/90 backdrop-blur",
					PAGE_GUTTER,
				)}
			>
				<BrandIcon variant="icon" className="size-8" alt="Rezumi" />
				<Stepper
					size="sm"
					aria-label={t`Setup steps`}
					currentStep={ONBOARDING_STEPS.indexOf(step)}
					className="mx-auto w-full max-w-lg"
				>
					{ONBOARDING_STEPS.map((id) => (
						<Stepper.Step key={id} aria-current={id === step ? "step" : undefined}>
							<Stepper.Indicator />
							<Stepper.Content className="max-md:sr-only">
								<Stepper.Title>{titles[id]}</Stepper.Title>
							</Stepper.Content>
							<Stepper.Separator />
						</Stepper.Step>
					))}
				</Stepper>
				{onSkip ? (
					<Button variant="ghost" isPending={skipping} onPress={onSkip}>
						{skipLabel ?? <Trans>Skip</Trans>}
					</Button>
				) : (
					<span />
				)}
			</header>

			<main className={cn("mx-auto w-full max-w-[720px] flex-1 pt-4 pb-10 sm:pt-8", PAGE_GUTTER)}>
				<div key={step} className={cn(ENTER_CLASS, "grid gap-5")}>
					{title && (
						<div className="grid gap-2">
							{/* The page's h1, focusable from script only, described by the line under it. */}
							<Typography
								type="h2"
								render={({ children: text, className, ...heading }) => (
									<h1
										{...heading}
										ref={headingRef}
										tabIndex={-1}
										{...(description ? { "aria-describedby": descriptionId } : {})}
										className={cn(className, "outline-none")}
									>
										{text}
									</h1>
								)}
							>
								{title}
							</Typography>
							{description && (
								<p id={descriptionId} className="text-body text-muted">
									{description}
								</p>
							)}
						</div>
					)}
					{children}
				</div>
			</main>

			{footer && (
				<footer className="sticky bottom-0 z-20 border-t border-separator bg-background/90 backdrop-blur">
					<div className={cn("mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 py-3", PAGE_GUTTER)}>
						{footer}
					</div>
				</footer>
			)}
		</div>
	);
}

type AccountSummaryProps = { account: SourcesStatus["account"] };

/** What the account already gives the Profile: the name, email and photo from signing up or signing in. */
function AccountSummary({ account }: AccountSummaryProps) {
	return (
		<div className="grid gap-3">
			<span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
				<Icon name="check-circle" size={16} className="text-success" />
				<Trans>From your account</Trans>
			</span>
			<div className="flex items-center gap-3">
				<UserAvatar name={account.name} image={account.image} className="size-12" />
				<div className="grid min-w-0 flex-1">
					<span className="truncate text-base font-semibold">{account.name}</span>
					<span className="truncate text-sm text-muted" dir="ltr">
						{account.email}
					</span>
				</div>
			</div>
		</div>
	);
}

/** Every source finished without anything new: say so, and that it's fine to go on. */
function NothingFound() {
	return (
		<Card className="items-center gap-2 p-8 text-center">
			<span className="grid size-12 place-items-center rounded-full bg-default text-muted">
				<Icon name="magnifying-glass" size={24} />
			</span>
			<p className="text-base font-semibold">
				<Trans>Nothing new to add</Trans>
			</p>
			<p className="max-w-sm text-body-sm text-muted">
				<Trans>Your Profile already has what we found, or the sources couldn't be read. Fill it in any time.</Trans>
			</p>
		</Card>
	);
}

/** While the Profile and Preferences load: the frame with the first step's shape, so nothing jumps. */
function OnboardingSkeleton() {
	return (
		<OnboardingFrame step="bring">
			<div role="status" className="grid gap-5">
				<span className="sr-only">{t`Loading`}</span>
				<div className="grid gap-2">
					<Skeleton className="h-9 w-64 rounded-lg" />
					<Skeleton className="h-5 w-full max-w-md rounded-md" />
				</div>
				<Card className="gap-6 p-4 sm:p-6">
					<div className="flex items-center gap-3">
						<Skeleton className="size-12 rounded-full" />
						<div className="grid flex-1 gap-1.5">
							<Skeleton className="h-4 w-40 rounded-md" />
							<Skeleton className="h-3 w-56 rounded-md" />
						</div>
					</div>
					{[0, 1, 2].map((row) => (
						<div key={row} className="grid gap-2">
							<Skeleton className="h-4 w-32 rounded-md" />
							<Skeleton className="h-10 rounded-xl" />
						</div>
					))}
				</Card>
			</div>
		</OnboardingFrame>
	);
}
