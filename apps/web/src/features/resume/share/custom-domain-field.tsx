import type { DnsFindings, DomainStatus, DomainStep } from "./domain-progress";
import type { RouterOutput } from "@/libs/orpc/client";
import type { IconName } from "@rezumi/ui/components/icon";
import { Alert, Button, Chip, Input, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";
import { CvDomainCard } from "./cv-domain-card";
import { DnsRecordsDialog } from "./dns-records-dialog";
import { domainSteps, isDomainSettling } from "./domain-progress";
import { portfolioHoldsShortLink } from "./short-link";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { openPlanDialog } from "@/features/billing/plan-dialog";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type CustomDomainFieldProps = {
	/** Suggest a `.cv` domain from OlaCV while none is connected (`FLAG_OLACV_SUGGESTION`). */
	suggest: boolean;
};

const SETTLING_REFRESH_MS = 15_000;

/** Connects the account's own domain: the domain, the DNS records to add in a dialog, a check, and the result. */
export function CustomDomainField({ suggest }: CustomDomainFieldProps) {
	const queryClient = useQueryClient();
	const {
		data: domain,
		isPending: loading,
		isError: unavailable,
	} = useQuery({
		...orpc.customDomain.get.queryOptions(),
		// A refusal means the feature isn't open to this account; the field stays away instead of retrying.
		retry: false,
		refetchInterval: (query) => (isDomainSettling(query.state.data) ? SETTLING_REFRESH_MS : false),
	});
	const plan = usePlan();
	// Connecting needs the plan from the day portfolios open to the account; the server decides the same way.
	const { data: portfolioStatus } = useQuery(orpc.portfolio.status.queryOptions());
	const locked = Boolean(portfolioStatus?.enabled) && !hasPlanFeature(plan, "customDomain");
	// No offer to buy a domain the plan can't connect.
	const offerDomain = suggest && !locked;
	const { data: suggestion } = useQuery({
		...orpc.customDomain.suggestion.queryOptions(),
		enabled: offerDomain && !loading && !domain,
		staleTime: 15 * 60_000,
	});
	const [hostname, setHostname] = useState("");
	const [recordsOpen, setRecordsOpen] = useState(false);
	const [dns, setDns] = useState<DnsFindings | null>(null);
	const refresh = (next: RouterOutput["customDomain"]["get"]) =>
		queryClient.setQueryData(orpc.customDomain.get.queryKey(), next);
	const set = useMutation({
		...orpc.customDomain.set.mutationOptions(),
		onSuccess: (next) => {
			refresh(next);
			setDns(null);
			if (!next.verified) setRecordsOpen(true);
		},
	});
	const verify = useMutation({ ...orpc.customDomain.verify.mutationOptions(), onSuccess: refresh });
	const remove = useMutation({
		...orpc.customDomain.remove.mutationOptions(),
		onSuccess: () => {
			refresh(null);
			setDns(null);
		},
	});
	const onError = (error: unknown) =>
		toastError(error, t`Couldn't update sharing. Try again.`, { allowServerMessage: true });

	const check = () =>
		verify.mutate(undefined, {
			onError,
			onSuccess: (next) => {
				setDns(next.dns);
				if (next.verified) setRecordsOpen(false);
				toast.add(
					!next.verified
						? { type: "error", description: t`The records aren't visible yet. Check again later.` }
						: isDomainSettling(next)
							? { description: t`DNS is right. HTTPS is being set up, which usually takes a few minutes.` }
							: next.stage === "problem"
								? { type: "error", description: t`This domain needs your attention. See what's below.` }
								: { description: t`Domain connected` },
				);
			},
		});

	if (loading || unavailable) return null;

	if (!domain)
		return (
			<>
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (locked) openPlanDialog({ kind: "feature", feature: "customDomain" });
						else set.mutate({ hostname }, { onError });
					}}
				>
					<TextField variant="secondary" value={hostname} onChange={setHostname} className="min-w-0 flex-1 gap-1.5">
						<Label className="flex items-center gap-2">
							<Trans>Your domain</Trans>
							{locked && (
								<Chip size="sm" variant="soft" color="accent">
									<Icon name="lock" size={12} aria-hidden />
									Plus
								</Chip>
							)}
						</Label>
						<Input
							variant="secondary"
							fullWidth
							placeholder="www.example.com"
							spellCheck={false}
							autoCapitalize="none"
							dir="ltr"
							className="font-mono text-sm"
						/>
					</TextField>
					<Button type="submit" variant="secondary" isPending={set.isPending} isDisabled={!hostname.trim()}>
						{set.isPending && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Connect</Trans>
					</Button>
				</form>
				{offerDomain && suggestion && (
					<CvDomainCard
						suggestion={suggestion}
						connecting={set.isPending}
						onConnect={() => set.mutate({ hostname: suggestion.domain }, { onError })}
					/>
				)}
			</>
		);

	const redirecting = domain.plan.state === "redirecting";
	const working = domain.stage === "active" && !redirecting;
	const portfolioHolds = portfolioHoldsShortLink(portfolioStatus);

	return (
		<div className="grid gap-3 rounded-xl bg-surface-secondary p-4 fields-on-card">
			<div className="flex items-center gap-2">
				<Icon
					name={working ? "check-circle" : "warning-circle"}
					size={18}
					className={working ? "text-success" : "text-warning"}
				/>
				<span className="min-w-0 flex-1 truncate font-mono text-sm font-medium" dir="ltr">
					{domain.hostname}
				</span>
				<Button
					variant="danger-soft"
					size="sm"
					isPending={remove.isPending}
					onPress={() => remove.mutate(undefined, { onError })}
				>
					{remove.isPending && <Spinner size="sm" color="current" aria-hidden />}
					<Trans>Remove</Trans>
				</Button>
			</div>

			{redirecting ? (
				<PlanNotice plan={domain.plan} />
			) : (
				<>
					{domain.managed && <DomainSteps steps={domainSteps(domain, dns)} />}
					{domain.plan.state === "grace" && <PlanNotice plan={domain.plan} />}
					{domain.stage === "problem" && domain.problem && <ProblemNotice problem={domain.problem} />}
					{domain.stage === "active" ? (
						<p className="text-xs text-muted">
							{portfolioHolds ? (
								<Trans>Connected. Your domain opens your portfolio.</Trans>
							) : (
								<Trans>Connected. Your domain opens your primary resume.</Trans>
							)}
						</p>
					) : domain.stage === "dns" ? (
						<>
							<p className="text-xs text-muted">
								<Trans>Not connected yet. Add its DNS records where you manage the domain, then check.</Trans>
							</p>
							<div className="flex flex-wrap gap-2">
								<Button variant="secondary" size="sm" onPress={() => setRecordsOpen(true)}>
									<Trans>Show DNS records</Trans>
								</Button>
								<Button variant="ghost" size="sm" isPending={verify.isPending} onPress={check}>
									{verify.isPending && <Spinner size="sm" color="current" aria-hidden />}
									<Trans>Check DNS</Trans>
								</Button>
							</div>
						</>
					) : (
						<>
							{domain.stage !== "problem" && (
								<p className="text-xs text-muted">
									<Trans>Setting up HTTPS. This usually takes a few minutes, and this page updates by itself.</Trans>
								</p>
							)}
							<div className="flex flex-wrap gap-2">
								<Button variant="ghost" size="sm" isPending={verify.isPending} onPress={check}>
									{verify.isPending && <Spinner size="sm" color="current" aria-hidden />}
									<Trans>Check again</Trans>
								</Button>
							</div>
						</>
					)}
				</>
			)}
			<DnsRecordsDialog
				domain={domain}
				open={recordsOpen}
				onOpenChange={setRecordsOpen}
				checking={verify.isPending}
				onCheck={check}
				onUseWww={() => set.mutate({ hostname: `www.${domain.hostname}` }, { onError })}
			/>
		</div>
	);
}

const STEP_ICON: Record<DomainStep["state"], { name: IconName; className: string }> = {
	done: { name: "check-circle", className: "text-success" },
	working: { name: "hourglass", className: "text-accent" },
	waiting: { name: "circle", className: "text-muted" },
	failed: { name: "x-circle", className: "text-danger" },
};

const stepLabels = (): Record<DomainStep["key"], string> => ({
	routing: t`DNS points to Rezumi`,
	ownership: t`Ownership proven`,
	certificate: t`HTTPS certificate`,
	active: t`Active`,
});

function DomainSteps({ steps }: { steps: DomainStep[] }) {
	const labels = stepLabels();
	return (
		<ol className="grid gap-1.5" aria-label={t`Connection progress`}>
			{steps.map((step) => (
				<li key={step.key} className={cn("flex items-center gap-2 text-xs", step.state === "waiting" && "text-muted")}>
					<Icon {...STEP_ICON[step.state]} size={16} aria-hidden />
					{labels[step.key]}
				</li>
			))}
		</ol>
	);
}

function PlanNotice({ plan }: { plan: DomainStatus["plan"] }) {
	const { i18n } = useLingui();
	const until = plan.until?.toLocaleDateString(i18n.locale, { day: "numeric", month: "long" }) ?? "";
	return (
		<Alert status="warning">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>
					{plan.state === "grace" ? (
						<Trans>Your domain stops working on {until}</Trans>
					) : (
						<Trans>Your domain now goes to your Rezumi address</Trans>
					)}
				</Alert.Title>
				<Alert.Description>
					<Trans>Your plan no longer includes a custom domain. Renew it and the domain comes back by itself.</Trans>
				</Alert.Description>
				<Button
					size="sm"
					variant="secondary"
					className="mt-2 w-fit"
					onPress={() => openPlanDialog({ kind: "feature", feature: "customDomain" })}
				>
					<Trans>See plans</Trans>
				</Button>
			</Alert.Content>
		</Alert>
	);
}

const problemText = (problem: NonNullable<DomainStatus["problem"]>) => {
	switch (problem) {
		case "dns_moved":
			return t`This domain no longer points to Rezumi. Put its CNAME record back, then check again.`;
		case "caa":
			return t`A CAA record on this domain blocks its HTTPS certificate. Remove that record or allow the certificate authority, then check again.`;
		case "certificate":
			return t`The HTTPS certificate couldn't be issued. Make sure the DNS records are still there, then check again.`;
		case "blocked":
			return t`This domain has been blocked and can't be connected. Contact support if you think that's wrong.`;
		case "rejected":
			return t`This domain can't be connected. Try a subdomain such as www.`;
		case "quota":
			return t`We can't set up more domains right now. The problem is on our side, and your domain connects by itself once it's solved.`;
	}
};

function ProblemNotice({ problem }: { problem: NonNullable<DomainStatus["problem"]> }) {
	return (
		<Alert status="danger">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{problemText(problem)}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}
