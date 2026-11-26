// Share's custom domain (plans/mobile Phase 08): connect the account's own domain, the DNS records to add in a sheet,
// the steps Cloudflare goes through, and the plan and problem notices, as on the web's `custom-domain-field.tsx`.
import type { RouterOutput } from "@/api/client";
import type { IconName } from "@/ui";
import type { DnsFindings, DomainStep } from "@rezumi/resume/custom-domain";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { View } from "react-native";
import { DOMAIN_SETTLING_REFRESH_MS, domainSteps, isDomainSettling, isRootDomain } from "@rezumi/resume/custom-domain";
import { portfolioHoldsShortLink } from "@rezumi/resume/sharing";
import { formatTimeSince } from "./time-since";
import { orpc } from "@/api/client";
import { canShowPlans, hasPlanFeature, showPlanAlert, usePlan } from "@/features/billing/plan";
import { showPlanAlertForError } from "@/features/billing/plan-alert";
import {
	Alert,
	Button,
	Card,
	Chip,
	ConfirmDialog,
	Icon,
	Input,
	Label,
	ListRow,
	ListSection,
	Sheet,
	Spinner,
	Text,
	TextField,
	Typography,
	haptics,
	showToast,
} from "@/ui";

type Domain = NonNullable<RouterOutput["customDomain"]["get"]>;

type ShareNoticeProps = {
	status: "default" | "accent" | "success" | "warning" | "danger";
	title?: string | undefined;
	children?: ReactNode;
};

/** A banner in Share: offline, a failed save, a plan or domain problem. */
export function ShareNotice({ status, title, children }: ShareNoticeProps) {
	return (
		<Alert status={status}>
			<Alert.Indicator />
			<Alert.Content>
				{title ? <Alert.Title>{title}</Alert.Title> : null}
				{children ? <Alert.Description>{children}</Alert.Description> : null}
			</Alert.Content>
		</Alert>
	);
}

/** The server's own words are English; each refusal has its wording here. A plan refusal explains the plan instead. */
function domainError(error: unknown) {
	if (showPlanAlertForError(error)) return;
	const code = error instanceof ORPCError ? error.code : null;
	const message =
		code === "INVALID_DOMAIN"
			? t`Enter a domain such as resume.example.com.`
			: code === "PRECONDITION_FAILED"
				? t`Custom domains aren't available here.`
				: code === "CONFLICT"
					? t`The domain changed while it was being checked. Check it again.`
					: code === "NOT_FOUND"
						? t`No domain is connected anymore. Pull to refresh.`
						: t`Couldn't update sharing. Try again.`;
	haptics.error();
	showToast({ title: message, variant: "danger" });
}

/**
 * The server's answer when custom domains aren't open to the account (not set up on this server, or portfolios not open
 * to it): the field stays away. Any other failure (a timeout, the server down) says so and offers a retry.
 */
const isUnavailable = (error: unknown) =>
	error instanceof ORPCError && ["PRECONDITION_FAILED", "FORBIDDEN", "NOT_FOUND"].includes(error.code);

type CustomDomainProps = { offline: boolean; readOnly?: boolean };

/**
 * Connects the account's own domain: the domain, the DNS records to add in a sheet, a check, and the result. The web's
 * `.cv` suggestion from OlaCV (a price, a discount code and a link to buy) has no place in the app (K6).
 */
export function CustomDomain({ offline, readOnly = false }: CustomDomainProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const domain = useQuery({
		...orpc.customDomain.get.queryOptions(),
		enabled: !offline,
		// The app's default retries a timeout or a server error, never a refusal (4xx).
		refetchInterval: (query) => (isDomainSettling(query.state.data) ? DOMAIN_SETTLING_REFRESH_MS : false),
	});
	const plan = usePlan();
	// Connecting needs the plan from the day portfolios open to the account; the server decides the same way.
	const portfolio = useQuery({ ...orpc.portfolio.status.queryOptions(), enabled: !offline });
	const locked = Boolean(portfolio.data?.enabled) && !hasPlanFeature(plan, "customDomain");
	const [hostname, setHostname] = useState("");
	const [recordsOpen, setRecordsOpen] = useState(false);
	const [confirmRemove, setConfirmRemove] = useState(false);
	const [dns, setDns] = useState<DnsFindings | null>(null);
	const store = (next: RouterOutput["customDomain"]["get"]) =>
		queryClient.setQueryData(orpc.customDomain.get.queryKey(), next);
	const set = useMutation({
		...orpc.customDomain.set.mutationOptions(),
		onSuccess: (next) => {
			store(next);
			setDns(null);
			if (!next.verified) setRecordsOpen(true);
		},
		onError: domainError,
	});
	const verify = useMutation({ ...orpc.customDomain.verify.mutationOptions(), onError: domainError });
	const remove = useMutation({
		...orpc.customDomain.remove.mutationOptions(),
		onSuccess: () => {
			store(null);
			setDns(null);
		},
		onError: domainError,
	});

	const connect = (value: string) => {
		if (locked) return showPlanAlert({ kind: "feature", feature: "customDomain" });
		set.mutate({ hostname: value.trim() });
	};

	const check = () =>
		verify.mutate(
			{},
			{
				onSuccess: (next) => {
					store(next);
					setDns(next.dns);
					if (next.verified) setRecordsOpen(false);
					if (!next.verified)
						showToast({ title: t`The records aren't visible yet. Check again later.`, variant: "danger" });
					else if (isDomainSettling(next))
						showToast({ title: t`DNS is right. HTTPS is being set up, which usually takes a few minutes.` });
					else if (next.stage === "problem")
						showToast({ title: t`This domain needs your attention. See what's below.`, variant: "danger" });
					else showToast({ title: t`Domain connected`, variant: "success" });
				},
			},
		);

	if (domain.isPending) return null;
	if (domain.isError) {
		if (isUnavailable(domain.error)) return null;
		return (
			<View className="gap-2" testID="custom-domain-error">
				<ShareNotice status="danger">{t`Couldn't load your custom domain.`}</ShareNotice>
				<Button
					variant="secondary"
					size="sm"
					className="self-start"
					isDisabled={domain.isFetching}
					onPress={() => void domain.refetch()}
				>
					{domain.isFetching ? <Spinner size="sm" /> : null}
					<Button.Label>{t`Retry`}</Button.Label>
				</Button>
			</View>
		);
	}
	const current = domain.data;

	if (!current && readOnly) return <Text tone="muted">{t`No custom domain connected.`}</Text>;
	if (!current)
		return (
			<View className="gap-3">
				<TextField isDisabled={offline || set.isPending}>
					<View className="flex-row items-center gap-2">
						<Label>{t`Your domain`}</Label>
						{locked && canShowPlans() ? (
							<Chip size="sm" variant="soft" color="accent">
								<Icon name="lock" size={12} tone="accent" />
								<Chip.Label>Plus</Chip.Label>
							</Chip>
						) : null}
					</View>
					<Input
						accessibilityLabel={t`Your domain`}
						value={hostname}
						onChangeText={setHostname}
						placeholder="www.example.com"
						autoCapitalize="none"
						autoCorrect={false}
						keyboardType="url"
						returnKeyType="go"
						onSubmitEditing={() => {
							if (hostname.trim()) connect(hostname);
						}}
					/>
				</TextField>
				<Button
					variant="secondary"
					className="self-start"
					isDisabled={offline || !hostname.trim() || set.isPending}
					onPress={() => connect(hostname)}
				>
					{set.isPending ? <Spinner size="sm" /> : null}
					<Button.Label>{t`Connect`}</Button.Label>
				</Button>
			</View>
		);

	const redirecting = current.plan.state === "redirecting";
	const working = current.stage === "active" && !redirecting;
	const portfolioHolds = portfolioHoldsShortLink(portfolio.data);
	const checkButton = (label: string) => (
		<Button variant="ghost" size="sm" isDisabled={offline || verify.isPending} onPress={check}>
			{verify.isPending ? <Spinner size="sm" /> : null}
			<Button.Label>{label}</Button.Label>
		</Button>
	);

	return (
		<Card className="gap-3" testID="custom-domain">
			<View className="flex-row items-center gap-2">
				<Icon name={working ? "check-circle" : "warning-circle"} size={18} tone={working ? "success" : "warning"} />
				<Text mono weight="medium" numberOfLines={1} className="min-w-0 flex-1">
					{current.hostname}
				</Text>
				{readOnly ? null : (
					<Button
						variant="danger-soft"
						size="sm"
						isDisabled={offline || remove.isPending}
						// A connected domain stops working at once; coming back means checking DNS and waiting for HTTPS.
						onPress={() => (current.verified ? setConfirmRemove(true) : remove.mutate({}))}
					>
						{remove.isPending ? <Spinner size="sm" /> : null}
						<Button.Label>{t`Remove`}</Button.Label>
					</Button>
				)}
			</View>

			{redirecting ? (
				<PlanNotice plan={current.plan} />
			) : (
				<>
					{current.managed ? <DomainSteps steps={domainSteps(current, dns)} /> : null}
					{current.plan.state === "grace" ? <PlanNotice plan={current.plan} /> : null}
					{current.stage === "problem" && current.problem ? (
						<ShareNotice status="danger">{problemText(current.problem)}</ShareNotice>
					) : null}
					{current.stage === "active" ? (
						<Typography type="body-xs" className="text-muted">
							{portfolioHolds
								? t`Connected. Your domain opens your portfolio.`
								: t`Connected. Your domain opens your primary resume.`}
						</Typography>
					) : current.stage === "dns" ? (
						<>
							<Typography type="body-xs" className="text-muted">
								{t`Not connected yet. Add its DNS records where you manage the domain, then check.`}
							</Typography>
							{readOnly ? null : (
								<View className="flex-row flex-wrap gap-2">
									<Button variant="secondary" size="sm" onPress={() => setRecordsOpen(true)}>
										<Button.Label>{t`Show DNS records`}</Button.Label>
									</Button>
									{checkButton(t`Check DNS`)}
								</View>
							)}
						</>
					) : (
						<>
							{current.stage !== "problem" ? (
								<Typography type="body-xs" className="text-muted">
									{t`Setting up HTTPS. This usually takes a few minutes, and this screen updates by itself.`}
								</Typography>
							) : null}
							{readOnly ? null : <View className="flex-row flex-wrap gap-2">{checkButton(t`Check again`)}</View>}
						</>
					)}
				</>
			)}
			<DnsRecordsSheet
				domain={current}
				isOpen={recordsOpen}
				onOpenChange={setRecordsOpen}
				checking={verify.isPending}
				disabled={offline}
				onCheck={check}
				onUseWww={() => set.mutate({ hostname: `www.${current.hostname}` })}
			/>
			<ConfirmDialog
				isOpen={confirmRemove}
				onOpenChange={setConfirmRemove}
				title={t`Disconnect ${current.hostname}?`}
				message={t`Your domain stops opening your page right away. To connect it again, its DNS is checked and HTTPS is set up again, which can take a while.`}
				confirmLabel={t`Disconnect`}
				cancelLabel={t`Keep it connected`}
				destructive
				onConfirm={() => remove.mutate({})}
			/>
		</Card>
	);
}

const STEP_ICON: Record<DomainStep["state"], { name: IconName; tone: "success" | "accent" | "muted" | "danger" }> = {
	done: { name: "check-circle", tone: "success" },
	working: { name: "hourglass", tone: "accent" },
	waiting: { name: "circle", tone: "muted" },
	failed: { name: "x-circle", tone: "danger" },
};

const stepLabels = (): Record<DomainStep["key"], string> => ({
	routing: t`DNS points to Rezumi`,
	ownership: t`Ownership proven`,
	certificate: t`HTTPS certificate`,
	active: t`Active`,
});

const stepStates = (): Record<DomainStep["state"], string> => ({
	done: t`Done`,
	working: t`In progress`,
	waiting: t`Waiting`,
	failed: t`Failed`,
});

function DomainSteps({ steps }: { steps: DomainStep[] }) {
	const { t } = useLingui();
	const labels = stepLabels();
	const states = stepStates();
	return (
		<View className="gap-1.5" accessibilityLabel={t`Connection progress`}>
			{steps.map((step) => (
				<View
					key={step.key}
					accessible
					accessibilityLabel={`${labels[step.key]}, ${states[step.state]}`}
					className="flex-row items-center gap-2"
					testID={`domain-step-${step.key}-${step.state}`}
				>
					<Icon {...STEP_ICON[step.state]} size={16} />
					<Text size="xs" tone={step.state === "waiting" ? "muted" : "default"}>
						{labels[step.key]}
					</Text>
				</View>
			))}
		</View>
	);
}

/** A plan that no longer includes the domain: neutral on both platforms, with no call to buy (K6). */
function PlanNotice({ plan }: { plan: Domain["plan"] }) {
	const { t, i18n } = useLingui();
	const until = plan.until?.toLocaleDateString(i18n.locale, { day: "numeric", month: "long" }) ?? "";
	return (
		<Alert status="warning">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>
					{plan.state === "grace"
						? t`Your domain stops working on ${until}`
						: t`Your domain now goes to your Rezumi address`}
				</Alert.Title>
				<Alert.Description>{t`Your page keeps its address on Rezumi.`}</Alert.Description>
			</Alert.Content>
		</Alert>
	);
}

const problemText = (problem: NonNullable<Domain["problem"]>) => {
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

const copy = async (value: string, message: string) => {
	await Clipboard.setStringAsync(value);
	haptics.light();
	showToast({ title: message });
};

type DnsRecordsSheetProps = {
	domain: Domain;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	checking: boolean;
	disabled: boolean;
	onCheck: () => void;
	/** Connects `www.<domain>` instead, offered for a root domain when certificates are automated. */
	onUseWww: () => void;
};

/** The records that connect a custom domain, one group each; tapping a name or value copies it. */
function DnsRecordsSheet({
	domain,
	isOpen,
	onOpenChange,
	checking,
	disabled,
	onCheck,
	onUseWww,
}: DnsRecordsSheetProps) {
	const { t } = useLingui();
	const hostname = domain.hostname;
	const target = domain.target;
	const lastChecked = domain.lastCheckedAt ? formatTimeSince(domain.lastCheckedAt) : null;
	const hasCname = domain.records.some((record) => record.type === "CNAME");

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t`Connect ${hostname}`}
			closeLabel={t`Close`}
			detents={[0.6, 0.95]}
			footer={
				<Button isDisabled={disabled || checking} onPress={onCheck}>
					{checking ? <Spinner size="sm" /> : null}
					<Button.Label>{t`Check DNS`}</Button.Label>
				</Button>
			}
		>
			<View className="gap-4">
				<Typography type="body-sm" className="text-muted">
					{t`Add these records where you manage the domain, then check. Changes can take a few hours to reach everyone.`}
				</Typography>
				{domain.records.map((record) => (
					<ListSection key={`${record.type}-${record.value}`} title={record.type}>
						<ListRow
							title={record.name}
							description={t({ message: "Name", context: "DNS record" })}
							trailing={<Icon name="copy" size={16} tone="muted" />}
							accessibilityHint={t`Copies it`}
							onPress={() => void copy(record.name, t`Copied`)}
						/>
						<ListRow
							title={record.value}
							description={t`Value`}
							trailing={<Icon name="copy" size={16} tone="muted" />}
							accessibilityHint={t`Copies it`}
							onPress={() => void copy(record.value, t`Copied`)}
						/>
					</ListSection>
				))}
				{domain.managed ? (
					<>
						<Typography
							type="body-xs"
							className="text-muted"
						>{t`If your DNS is on Cloudflare, set the CNAME record to DNS only (grey cloud).`}</Typography>
						{isRootDomain(hostname) ? (
							<Alert status="warning">
								<Alert.Indicator />
								<Alert.Content>
									<Alert.Title>{t`A domain without www needs a DNS provider that allows it`}</Alert.Title>
									<Alert.Description>
										{t`${hostname} needs a CNAME at the root, which many providers don't allow. If yours doesn't, connect www.${hostname} and forward ${hostname} to it where you manage the domain.`}
									</Alert.Description>
									<Button
										size="sm"
										variant="secondary"
										className="mt-2 self-start"
										isDisabled={disabled}
										onPress={onUseWww}
									>
										<Button.Label>{t`Use www.${hostname}`}</Button.Label>
									</Button>
								</Alert.Content>
							</Alert>
						) : null}
					</>
				) : hasCname ? (
					<Typography type="body-xs" className="text-muted">
						{t`For a root domain such as example.com, use A and AAAA records with ${target}'s addresses instead of the CNAME.`}
					</Typography>
				) : null}
				{lastChecked ? <Text size="xs" tone="muted">{t`Last checked ${lastChecked} ago`}</Text> : null}
			</View>
		</Sheet>
	);
}
