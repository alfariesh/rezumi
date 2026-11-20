import type { JobListingCard } from "@rezumi/schema/jobs/search";
import { Button, Chip, Link as TextLink, Skeleton, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CAREER_TASK_CREDIT_ACTIONS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { ThinkingOrb } from "@rezumi/ui/components/thinking-orb";
import { cn } from "@rezumi/utils/style";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu, getCreditsProblem } from "@/features/billing/ai-source-menu";
import { useDefaultProvider } from "@/features/career/hooks";
import { PrivacyLine, StatusPill, Working, workingSteps } from "@/features/career/shared";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { renderAsSpan } from "@/libs/typography";

type ListingFitProps = { listing: JobListingCard };

/**
 * The AI fit check of a listing (K8): the workspace's Fit check, run before tracking. It costs what Fit costs; the
 * answer is kept, so opening the listing again shows it without charging, and tracking the listing carries it into the
 * workspace, where gaps can be closed. A check run before the Profile changed is shown with "Check again".
 */
export function ListingFit({ listing }: ListingFitProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const connection = useDefaultProvider();
	const ai = useAiSource();
	const { provider } = connection;
	const query = orpc.jobs.fit.queryOptions({ input: { id: listing.id } });
	const stored = useQuery({ ...query, staleTime: 5 * 60_000 });
	const check = useMutation({
		...orpc.jobs.checkFit.mutationOptions(),
		onSuccess: (result) => queryClient.setQueryData(query.queryKey, result),
		onError: (error) => {
			// Too few Rezumi AI credits explains itself in the credits dialog.
			if (getCreditsProblem(error)) return;
			const name = provider?.label ?? t`Your AI connection`;
			toastError(error, t`${name} didn't respond. Nothing was changed; try again.`, { allowServerMessage: true });
		},
	});
	const run = () => check.mutate({ id: listing.id, locale: i18n.locale, ...aiSourceFields(ai) });
	const fit = stored.data?.fit;
	const outdated = stored.data?.outdated ?? false;

	const notice = connection.isUnavailable ? (
		<AiProviderLoadState state={connection} />
	) : !provider ? (
		<TextLink
			href="/dashboard/settings/app#ai-providers"
			className="w-fit gap-1.5 text-sm text-link no-underline hover:underline"
		>
			<Icon name="key" size={16} />
			<Trans>Connect an AI provider in Settings</Trans>
		</TextLink>
	) : (
		<div className="flex flex-wrap items-center gap-x-2">
			<PrivacyLine>
				{t`Sends this job's posting and your Profile (details, and the facts and stories that are switched on) to ${provider.label}.`}
			</PrivacyLine>
			<AiSourceMenu action={CAREER_TASK_CREDIT_ACTIONS.fit} />
		</div>
	);
	const button = provider && (
		<Button size="sm" variant={fit ? "ghost" : "secondary"} isPending={check.isPending} onPress={run}>
			{check.isPending && <ThinkingOrb size={16} tone="current" />}
			{check.isPending ? (
				<Working steps={workingSteps("fit")} />
			) : fit ? (
				<Trans>Check again</Trans>
			) : (
				<Trans>Check fit</Trans>
			)}
		</Button>
	);

	return (
		<section className="grid gap-3" aria-labelledby={`fit-${listing.id}`} aria-busy={stored.isPending}>
			<Typography id={`fit-${listing.id}`} type="h5" render={renderAsSpan}>
				<Trans>Your fit</Trans>
			</Typography>
			{stored.isPending ? (
				<Skeleton className="h-16 rounded-xl" />
			) : !fit ? (
				<div className="grid justify-items-start gap-3 rounded-2xl bg-surface-secondary p-4">
					<p className="text-body-sm text-pretty text-muted">
						<Trans>
							Check each requirement against the facts and stories in your Profile. Gaps show as missing evidence, never
							missing ability.
						</Trans>
					</p>
					{button}
					{notice}
				</div>
			) : (
				<div className="grid gap-4 rounded-2xl border border-separator p-4">
					<div className="grid gap-1">
						<p className="text-sm font-semibold text-pretty">{fit.headline}</p>
						<p className="text-body-sm text-pretty text-muted">{fit.summary}</p>
					</div>
					<FitCounts requirements={fit.requirements} />
					<ul className="grid gap-3" aria-label={t`Requirements and your evidence`}>
						{fit.requirements.map((requirement) => (
							<li key={requirement.text} className="grid gap-1">
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
									<span className="text-sm font-medium">{requirement.text}</span>
									<StatusPill status={requirement.status} />
								</div>
								<p className={cn("text-body-sm", requirement.status === "missing" ? "text-muted" : "text-foreground")}>
									{requirement.evidence}
								</p>
							</li>
						))}
					</ul>
					{fit.checks.length > 0 && (
						<ul className="grid gap-2 border-t border-separator pt-3">
							{fit.checks.map((entry) => (
								<li key={entry.label} className="flex gap-2 text-body-sm">
									<Icon
										name={entry.met === true ? "check-circle" : entry.met === false ? "x-circle" : "question"}
										size={18}
										className={cn(
											"mt-px shrink-0",
											entry.met === true && "text-success",
											entry.met === false && "text-danger",
											entry.met === null && "text-warning",
										)}
									/>
									<span>
										<strong className="font-semibold">{entry.label}.</strong> {entry.text}
									</span>
								</li>
							))}
						</ul>
					)}
					{fit.ask && (
						<p className="text-body-sm text-muted">
							<strong className="font-semibold text-foreground">
								{fit.ask.person ? t`Worth asking ${fit.ask.person}:` : t`Worth asking:`}
							</strong>{" "}
							{fit.ask.text}
						</p>
					)}
					<p className="text-body-xs text-muted">
						{outdated ? (
							<Trans>Your Profile changed since this check. Checking again uses AI again.</Trans>
						) : (
							<Trans>Track this job to add evidence and questions in its workspace. The check goes with it.</Trans>
						)}
					</p>
					{outdated && (
						<div className="grid justify-items-start gap-2">
							{button}
							{notice}
						</div>
					)}
				</div>
			)}
		</section>
	);
}

type FitCountsProps = { requirements: { status: "supported" | "partial" | "missing" }[] };

function FitCounts({ requirements }: FitCountsProps) {
	const count = (status: FitCountsProps["requirements"][number]["status"]) =>
		requirements.filter((requirement) => requirement.status === status).length;
	// Named as the workspace's Fit names them, so both share one translation.
	const supported = count("supported");
	const partial = count("partial");
	const missing = count("missing");
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Chip size="sm" variant="soft" color="success" className="tabular-nums">
				{t`${supported} supported`}
			</Chip>
			<Chip size="sm" variant="soft" color="warning" className="tabular-nums">
				{t`${partial} partly`}
			</Chip>
			<Chip size="sm" variant="soft" className="tabular-nums">
				{t`${missing} missing`}
			</Chip>
		</div>
	);
}
