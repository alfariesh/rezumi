// Your fit (the web's listing-fit.tsx, K8): the workspace's Fit check run on a listing before tracking it. It costs
// what Fit costs (the consent before it runs names the cost on Android; iOS uses the person's own AI connection); the
// answer is kept, so opening the listing again shows it without charging, and tracking carries it into the workspace.
// A check run before the Profile changed shows "Check again".
import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { listingFitKey, useListingFit } from "./queries";
import { client } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { useHasAIProvider } from "@/features/ai/providers";
import { ReportAiContent } from "@/features/ai/report-content";
import { useWorking, workingSteps } from "@/features/workspace/working";
import { routes } from "@/routes";
import { Button, Chip, Icon, Skeleton, Spinner, Text, Typography, cx, haptics, showToast } from "@/ui";

type Fit = NonNullable<NonNullable<ReturnType<typeof useListingFit>["data"]>["fit"]>;

type ListingFitProps = { listing: JobListingCard };

export function ListingFit({ listing }: ListingFitProps) {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const { server } = useSession();
	const connection = useHasAIProvider();
	const stored = useListingFit(listing.id);
	const check = useMutation({
		mutationFn: () => client.jobs.checkFit({ id: listing.id, locale: i18n.locale }),
		onSuccess: (result) => {
			if (getServer() !== server) return;
			queryClient.setQueryData(listingFitKey(listing.id, server), result);
			haptics.success();
		},
		onError: (error) => {
			// Declining the consent sends nothing and needs no message; too few credits has its own alert (the client's).
			if (error instanceof Error && error.name === "AbortError") return;
			if (error instanceof ORPCError && error.code === "INSUFFICIENT_CREDITS") return;
			haptics.error();
			const name = connection.defaultProvider?.label ?? t`Your AI connection`;
			// The consent step explains its own refusals ("Choose a tested AI provider…"); the server's are generic.
			const title =
				!(error instanceof ORPCError) && error instanceof Error && error.message
					? error.message
					: t`${name} didn't respond. Nothing was changed; try again.`;
			showToast({ title, variant: "danger" });
		},
	});
	const idle = stored.data?.fit ? t`Check again` : t`Check fit`;
	const label = useWorking(check.isPending, workingSteps("fit"), idle);
	const fit = stored.data?.fit;
	const outdated = stored.data?.outdated ?? false;

	const run = connection.hasAIProvider ? (
		<View className="gap-2">
			<Button
				size="sm"
				variant={fit ? "ghost" : "secondary"}
				isDisabled={check.isPending}
				onPress={() => check.mutate()}
				className="self-start"
				testID="job-check-fit"
			>
				{check.isPending ? <Spinner size="sm" /> : <Icon name="list-checks" size={16} tone="accent" />}
				<Button.Label>{label}</Button.Label>
			</Button>
			<Text size="xs" tone="muted">
				{t`Sends this job's posting and your Profile (details, and the facts and stories that are switched on) to ${connection.defaultProvider?.label ?? ""}.`}
			</Text>
		</View>
	) : (
		<ConnectAi loading={connection.isLoading} />
	);

	return (
		<View className="gap-3" accessibilityLabel={t`Your fit`}>
			<Typography.Heading type="h6" accessibilityRole="header">{t`Your fit`}</Typography.Heading>
			{stored.isPending ? (
				<Skeleton className="h-16 rounded-xl" variant="none" />
			) : !fit ? (
				<View className="gap-3 rounded-2xl bg-surface-secondary p-4">
					<Typography type="body-sm" className="text-muted">
						{t`Check each requirement against the facts and stories in your Profile. Gaps show as missing evidence, never missing ability.`}
					</Typography>
					{run}
				</View>
			) : (
				<View className="gap-4 rounded-2xl border border-separator p-4">
					<FitAnswer fit={fit} />
					<Text size="xs" tone="muted">
						{outdated
							? t`Your Profile changed since this check. Checking again uses AI again.`
							: t`Track this job to add evidence and questions in its workspace. The check goes with it.`}
					</Text>
					{outdated ? run : null}
					<ReportAiContent source="career" text={`${fit.headline}\n${fit.summary}`} />
				</View>
			)}
		</View>
	);
}

type ConnectAiProps = { loading: boolean };

function ConnectAi({ loading }: ConnectAiProps) {
	const { t } = useLingui();
	const router = useRouter();
	if (loading) return <Skeleton className="h-9 w-40 rounded-full" variant="none" />;
	return (
		<Button
			size="sm"
			variant="secondary"
			className="self-start"
			onPress={() => router.push(routes.account("ai-providers"))}
		>
			<Icon name="key" size={16} tone="accent" />
			<Button.Label>{t`Connect an AI provider`}</Button.Label>
		</Button>
	);
}

type FitAnswerProps = { fit: Fit };

function FitAnswer({ fit }: FitAnswerProps) {
	const { t } = useLingui();
	const count = (status: Fit["requirements"][number]["status"]) =>
		fit.requirements.filter((requirement) => requirement.status === status).length;
	const supported = count("supported");
	const partial = count("partial");
	const missing = count("missing");
	const statusLabel = { supported: t`Supported`, partial: t`Partly`, missing: t`Missing` } as const;
	const statusColor = { supported: "success", partial: "warning", missing: "default" } as const;
	return (
		<>
			<View className="gap-1">
				<Text weight="semibold">{fit.headline}</Text>
				<Typography type="body-sm" className="text-muted">
					{fit.summary}
				</Typography>
			</View>
			<View className="flex-row flex-wrap gap-1.5">
				<Chip size="sm" variant="soft" color="success">
					<Chip.Label>{t`${supported} supported`}</Chip.Label>
				</Chip>
				<Chip size="sm" variant="soft" color="warning">
					<Chip.Label>{t`${partial} partly`}</Chip.Label>
				</Chip>
				<Chip size="sm" variant="soft" color="default">
					<Chip.Label>{t`${missing} missing`}</Chip.Label>
				</Chip>
			</View>
			<View className="gap-3" accessibilityLabel={t`Requirements and your evidence`}>
				{fit.requirements.map((requirement) => (
					<View key={requirement.text} className="gap-1">
						<View className="flex-row flex-wrap items-center gap-2">
							<Text weight="medium" className="shrink">
								{requirement.text}
							</Text>
							<Chip size="sm" variant="soft" color={statusColor[requirement.status]}>
								<Chip.Label>{statusLabel[requirement.status]}</Chip.Label>
							</Chip>
						</View>
						<Typography type="body-sm" className={cx(requirement.status === "missing" && "text-muted")}>
							{requirement.evidence}
						</Typography>
					</View>
				))}
			</View>
			{fit.checks.length > 0 ? (
				<View className="gap-2 border-t border-separator pt-3">
					{fit.checks.map((entry) => (
						<View key={entry.label} className="flex-row gap-2">
							<Icon
								name={entry.met === true ? "check-circle" : entry.met === false ? "x-circle" : "question"}
								size={18}
								tone={entry.met === true ? "success" : entry.met === false ? "danger" : "warning"}
							/>
							<Typography type="body-sm" className="flex-1">
								{`${entry.label}. ${entry.text}`}
							</Typography>
						</View>
					))}
				</View>
			) : null}
			{fit.ask ? (
				<Typography type="body-sm" className="text-muted">
					{`${fit.ask.person ? t`Worth asking ${fit.ask.person}:` : t`Worth asking:`} ${fit.ask.text}`}
				</Typography>
			) : null}
		</>
	);
}
