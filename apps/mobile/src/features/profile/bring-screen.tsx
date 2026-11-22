// Profile → Bring what you have: a resume file, LinkedIn, GitHub or a website, read by the same flow as onboarding
// (Phase 05), then a review where anything can be unticked. What's kept is added to the open Profile and saved; nothing
// already there is replaced.
import type { SourcesStatus } from "@/features/onboarding/queries";
import type { SourceAvailability } from "@rezumi/resume/profile-sources";
import type { ProfileData } from "@rezumi/schema/profile/data";
import { useLingui } from "@lingui/react/macro";
import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { profileFromResume, resumeDataFromProfile } from "@rezumi/resume/profile";
import { countReviewEntries } from "@rezumi/resume/profile-sources";
import { emptyProfileData } from "@rezumi/schema/profile/data";
import { useProfileQuery } from "./source";
import { ProfileLoadError, ProfileSkeleton } from "./states";
import { saveProfileNow, updateProfile, useProfileEditor } from "./store";
import { useHasAIProvider } from "@/features/ai/provider-state";
import { useOnboardingData } from "@/features/onboarding/queries";
import { AccountSummary, SourceFields, SourcesNote } from "@/features/onboarding/source-fields";
import { SourceProgress } from "@/features/onboarding/source-progress";
import { SourceReview } from "@/features/onboarding/source-review";
import { useSourcesFlow } from "@/features/onboarding/use-sources-flow";
import { Button, Card, EmptyState, Screen, Separator, Text, showToast, useWindowSafeAreaInsets } from "@/ui";

const fallbackStatus: SourcesStatus = {
	linkedin: false,
	github: true,
	website: false,
	account: { name: "", email: "", image: null, githubUsername: null, providers: [] },
};

export function BringScreen() {
	const { t } = useLingui();
	const { query, ready } = useProfileQuery();
	const { status } = useOnboardingData();
	const sources: SourcesStatus | undefined = status.isError ? fallbackStatus : status.data;

	return (
		<>
			<Stack.Screen options={{ title: t`Bring what you have` }} />
			{!ready && query.isError ? (
				<ProfileLoadError onRetry={() => void query.refetch()} />
			) : !ready || !sources ? (
				<ProfileSkeleton />
			) : (
				<Bring status={sources} />
			)}
		</>
	);
}

type BringProps = { status: SourcesStatus };

function Bring({ status }: BringProps) {
	const { t } = useLingui();
	const router = useRouter();
	const insets = useWindowSafeAreaInsets();
	const ai = useHasAIProvider();
	// The Profile the review is worked out against, as it was when this screen opened.
	const [base] = useState<ProfileData>(() => {
		const data = useProfileEditor.getState().data;
		return data ? profileFromResume(data) : emptyProfileData();
	});
	const [step, setStep] = useState<"bring" | "review">("bring");
	const [busy, setBusy] = useState(false);
	const copied = useRef(new Map<string, string>());
	const availability: SourceAvailability = {
		linkedin: status.linkedin,
		github: status.github,
		website: status.website,
	};
	const flow = useSourcesFlow({
		base,
		availability,
		accountImage: status.account.image,
		github: status.account.githubUsername ?? "",
		aiAvailable: ai.hasAIProvider,
		restore: null,
	});

	const start = () => {
		if (flow.start() === null) setStep("review");
	};

	const save = async () => {
		setBusy(true);
		// What was kept goes onto the Profile as it is now, which may have been saved elsewhere since this screen opened
		// (a fresh read replaced it): the save then sends that version with nothing of it lost. A copied photo is
		// remembered, so working it out again after the copy is instant.
		let current = useProfileEditor.getState().data;
		let reviewed = await flow.finish(copied.current, current ? profileFromResume(current) : base);
		const latest = useProfileEditor.getState().data;
		if (latest && latest !== current) {
			current = latest;
			reviewed = await flow.finish(copied.current, profileFromResume(latest));
		}
		const { data, photoFailed } = reviewed;
		if (current) {
			const next = resumeDataFromProfile(data, current);
			updateProfile(
				(draft) => {
					draft.basics = next.basics;
					draft.picture = next.picture;
					draft.summary = next.summary;
					draft.sections = next.sections;
				},
				{ newStep: true },
			);
		}
		const saved = await saveProfileNow();
		setBusy(false);
		router.back();
		showToast({
			title: saved ? t`Added to your Profile` : t`Added. It saves once you're back online.`,
			variant: saved ? "success" : "default",
		});
		if (photoFailed) showToast({ title: t`Couldn't copy the photo. You can add one in Details.` });
	};

	const found = flow.groups.length > 0 || flow.photos.length > 0;
	const kept = countReviewEntries(flow.groups, flow.excluded);
	const footerStyle = { paddingBottom: insets.bottom + 12 };

	return (
		<View className="flex-1 bg-background">
			<Screen>
				{step === "bring" ? (
					<>
						<Text tone="muted">
							{t`Add any of these and we'll find what your Profile is missing. You check everything before it's added.`}
						</Text>
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
					</>
				) : (
					<>
						<Card>
							<Card.Body>
								<SourceProgress runs={flow.runs} onRetry={flow.retry} />
							</Card.Body>
						</Card>
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
										name={base.basics.name || status.account.name}
									/>
								</Card.Body>
							</Card>
						) : !flow.fetching ? (
							<EmptyState
								kind="page"
								icon="magnifying-glass"
								title={t`Nothing new to add`}
								description={t`Your Profile already has what we found, or the sources couldn't be read.`}
							/>
						) : null}
					</>
				)}
			</Screen>
			<View className="flex-row justify-end gap-2 border-t border-separator bg-surface px-4 pt-3" style={footerStyle}>
				{step === "bring" ? (
					<Button isDisabled={!flow.hasInput} onPress={start} testID="bring-continue">
						{t`Continue`}
					</Button>
				) : (
					<>
						<Button variant="secondary" isDisabled={busy} onPress={() => setStep("bring")}>
							{t`Back`}
						</Button>
						<Button
							isDisabled={flow.fetching || busy || (!found && !flow.fetching)}
							onPress={() => void save()}
							testID="bring-save"
						>
							{flow.fetching ? t`Reading…` : busy ? t`Adding…` : t`Add to my Profile`}
						</Button>
					</>
				)}
			</View>
		</View>
	);
}
