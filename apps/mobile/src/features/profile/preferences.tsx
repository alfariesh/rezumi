// The Profile tab's Preferences panel (plans/mobile Phase 06): what the person is looking for, their requirements as
// numbers, and how the coach remembers facts, as on the web's Preferences page. Changes save by themselves two seconds
// after the last edit, on leaving a field and when the app goes to the background; a failed save keeps the draft.
import type { RouterOutput } from "@/api/client";
import type { IconName } from "@/ui";
import type { CareerProfileData } from "@rezumi/schema/career";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { careerProfileDataSchema } from "@rezumi/schema/career";
import { SearchRegionsField } from "./search-regions-field";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { parseAmount } from "@/features/career/amount";
import { useCareerQueries, useCareerTime } from "@/features/career/hooks";
import { routes } from "@/routes";
import {
	Alert,
	Button,
	Card,
	ChipInput,
	Description,
	EmptyState,
	FieldError,
	Icon,
	Input,
	Label,
	Screen,
	Segment,
	Select,
	Separator,
	Skeleton,
	Text,
	TextArea,
	TextField,
	Typography,
} from "@/ui";

export function PreferencesPanel() {
	const { t } = useLingui();
	const { server } = useSession();
	const { profile } = useCareerQueries();

	let body: ReactNode;
	if (!profile.data && profile.isError)
		body = (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load your preferences`}
				description={t`Check your connection and try again.`}
				action={{ label: t`Retry`, onPress: () => void profile.refetch() }}
			/>
		);
	else if (!profile.data) body = <PreferencesSkeleton />;
	// The draft starts from what was saved and is kept through refreshes; another account starts over.
	else body = <PreferencesForm key={server ?? "signed-out"} initial={profile.data} />;

	return (
		<Screen onRefresh={() => profile.refetch()}>
			<Typography type="body-sm" color="muted">
				{t`What you want next. Job searches, fit checks, offers and the coach use it.`}
			</Typography>
			{body}
		</Screen>
	);
}

type PreferencesCardProps = { icon: IconName; title: string; children: ReactNode };

function PreferencesCard({ icon, title, children }: PreferencesCardProps) {
	return (
		<View className="gap-2">
			<View className="min-h-11 flex-row items-center gap-2">
				<Icon name={icon} tone="muted" />
				<Typography.Heading type="h6" accessibilityRole="header" className="flex-1">
					{title}
				</Typography.Heading>
			</View>
			<Card className="gap-5">{children}</Card>
		</View>
	);
}

/** The three cards while preferences load: a few fields each. */
function PreferencesSkeleton() {
	const { t } = useLingui();
	return (
		<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-6">
			{[3, 4, 1].map((fields, card) => (
				<View key={card} className="gap-2">
					<Skeleton variant="none" className="h-5 w-40 rounded-md" />
					<Card className="gap-5">
						{Array.from({ length: fields }, (_, index) => (
							<View key={index} className="gap-2">
								<Skeleton variant="none" className="h-3.5 w-32 rounded-md" />
								<Skeleton variant="none" className="h-12 w-full rounded-xl" />
							</View>
						))}
					</Card>
				</View>
			))}
		</View>
	);
}

type PreferencesFormProps = { initial: CareerProfileData };

function PreferencesForm({ initial }: PreferencesFormProps) {
	const { t } = useLingui();
	const { locale, timeZone, profile: account } = useCareerTime();
	const router = useRouter();
	const session = useSession();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState(initial);
	const [amount, setAmount] = useState(
		initial.minBase.amount === null
			? ""
			: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(initial.minBase.amount),
	);
	const [notice, setNotice] = useState(initial.noticeWeeks === null ? "" : String(initial.noticeWeeks));
	const parsedAmount = parseAmount(amount, locale);
	const noticeValue =
		notice.trim() === "" ? null : /^\d+$/.test(notice) && Number(notice) <= 52 ? Number(notice) : undefined;
	const next = { ...draft, minBase: { ...draft.minBase, amount: parsedAmount }, noticeWeeks: noticeValue };
	const valid =
		parsedAmount === undefined || noticeValue === undefined ? null : careerProfileDataSchema.safeParse(next);
	const json = valid?.success ? JSON.stringify(valid.data) : null;
	const [saved, setSaved] = useState(JSON.stringify(initial));
	const [error, setError] = useState(false);
	const [saving, setSaving] = useState(false);
	const latest = useRef({ json, server: session.server, accountId: account.data?.id });
	const queue = useRef<Promise<unknown>>(Promise.resolve());
	const attempted = useRef<string | null>(saved);
	useLayoutEffect(() => {
		latest.current = { json, server: session.server, accountId: account.data?.id };
	});
	// Saves the latest valid draft once; writes queue in order, and one meant for another account or server is dropped.
	const flush = useCallback(
		(retry = false) => {
			const current = latest.current;
			if (!current.accountId || !current.json || (!retry && attempted.current === current.json)) return;
			attempted.current = current.json;
			const queuedJson = current.json;
			const value = careerProfileDataSchema.parse(JSON.parse(queuedJson));
			setSaving(true);
			setError(false);
			const write = queue.current.then(async () => {
				const identity = queryClient.getQueryData<RouterOutput["auth"]["getProfile"]>([
					...orpc.auth.getProfile.key(),
					current.server,
				]);
				if (getServer() !== current.server || identity?.id !== current.accountId) return;
				await client.career.saveProfile(value);
				setSaved(queuedJson);
				void queryClient.invalidateQueries({ queryKey: orpc.career.profile.key() });
			});
			queue.current = write
				.catch(() => {
					setError(true);
				})
				.finally(() => {
					if (attempted.current === current.json) setSaving(false);
				});
		},
		[queryClient],
	);
	useEffect(() => {
		const timer = setTimeout(() => flush(), 2000);
		return () => clearTimeout(timer);
	}, [json, account.data?.id, flush]);
	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) => {
			if (state !== "active") flush();
		});
		return () => {
			listener.remove();
			flush();
		};
	}, [flush]);
	const change = (patch: Partial<CareerProfileData>) => setDraft((current) => ({ ...current, ...patch }));

	const state = !valid?.success || error ? "unsaved" : saving || json !== saved ? "saving" : "saved";
	const status = { unsaved: t`Not saved`, saving: t`Saving…`, saved: t`Saved` }[state];
	const memoryHelp = {
		ask: t`The coach proposes each fact in the chat. Nothing is saved until you agree.`,
		auto: t`The coach saves facts you state, and tells you. You can undo.`,
		off: t`The coach doesn't remember anything from your messages.`,
	}[draft.memoryMode];
	const officeOptions = [
		{ value: "any", label: t`Any` },
		{ value: "0", label: t`Remote` },
		...[1, 2, 3, 4, 5].map((days) => ({ value: String(days), label: String(days) })),
	];
	const office = draft.maxOfficeDays === null ? "any" : String(draft.maxOfficeDays);
	const currencyValid = /^[A-Z]{3}$/.test(draft.minBase.currency);

	return (
		<View className="gap-6">
			<View className="gap-2">
				<View className="flex-row items-center gap-1.5">
					<Icon
						name={state === "saved" ? "check-circle" : state === "saving" ? "clock" : "warning-circle"}
						size={16}
						tone={error ? "danger" : "muted"}
					/>
					<Text size="xs" tone={error ? "danger" : "muted"} accessibilityLiveRegion="polite">
						{status}
					</Text>
				</View>
				{error ? (
					<>
						<Alert status="danger">
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Description>{t`Couldn't save your preferences. Your draft is still here.`}</Alert.Description>
							</Alert.Content>
						</Alert>
						<Button size="sm" variant="secondary" className="self-start" onPress={() => flush(true)}>
							<Button.Label>{t`Retry`}</Button.Label>
						</Button>
					</>
				) : null}
				{!valid?.success ? (
					<Alert status="warning">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>{t`Check your preferences. Invalid changes are not saved.`}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}
			</View>

			<PreferencesCard icon="compass" title={t`What you're looking for`}>
				<ChipInput
					variant="secondary"
					label={t`Target roles`}
					placeholder={t`Add a role, then Return`}
					values={draft.targetRoles}
					removeLabel={(role) => t`Remove ${role}`}
					onChange={(targetRoles) => change({ targetRoles })}
				/>
				<ChipInput
					variant="secondary"
					label={t`Where you want to work`}
					placeholder={t`Add a place, then Return`}
					values={draft.locations}
					removeLabel={(place) => t`Remove ${place}`}
					onChange={(locations) => change({ locations })}
				/>
				{account.data ? (
					// Waits for the account, so its time zone (not the UTC stand-in) decides the automatic country.
					<SearchRegionsField
						value={draft.searchRegions}
						accountTimeZone={timeZone}
						onChange={(searchRegions) => change({ searchRegions })}
					/>
				) : null}
				<TextField>
					<Label>{t`What matters to you`}</Label>
					<TextArea
						variant="secondary"
						value={draft.priorities}
						maxLength={4000}
						accessibilityLabel={t`What matters to you`}
						onChangeText={(priorities) => change({ priorities })}
						onBlur={() => flush()}
					/>
				</TextField>
			</PreferencesCard>

			<PreferencesCard icon="list-checks" title={t`Requirements`}>
				<Typography type="body-sm" color="muted">
					{t`Used to check roles and offers. Each is a number, so the coach can compare without guessing.`}
				</Typography>
				<TextField isInvalid={parsedAmount === undefined}>
					<Label>{t`Minimum base salary`}</Label>
					<Input
						variant="secondary"
						keyboardType="decimal-pad"
						value={amount}
						accessibilityLabel={t`Minimum base salary`}
						onChangeText={setAmount}
						onBlur={() => flush()}
					/>
					<FieldError>{t`Enter a full amount, such as 95000. Your previous amount is unchanged.`}</FieldError>
				</TextField>
				<TextField isInvalid={!currencyValid}>
					<Label>{t`Currency`}</Label>
					<Input
						variant="secondary"
						value={draft.minBase.currency}
						autoCapitalize="characters"
						maxLength={3}
						accessibilityLabel={t`Currency`}
						onChangeText={(currency) => change({ minBase: { ...draft.minBase, currency: currency.toUpperCase() } })}
						onBlur={() => flush()}
					/>
					<FieldError>{t`Enter a three-letter currency code.`}</FieldError>
				</TextField>
				<View className="gap-2">
					<Label>{t`Pay period`}</Label>
					<Segment
						accessibilityLabel={t`Pay period`}
						value={draft.minBase.period}
						onValueChange={(period) => change({ minBase: { ...draft.minBase, period } })}
						options={[
							{ value: "year", label: t`Per year` },
							{ value: "month", label: t`Per month` },
							{ value: "hour", label: t`Per hour` },
						]}
					/>
				</View>
				<Separator />
				<Select
					value={officeOptions.find((option) => option.value === office)}
					onValueChange={(option) => {
						if (option && !Array.isArray(option))
							change({ maxOfficeDays: option.value === "any" ? null : Number(option.value) });
					}}
				>
					<Label>{t`Office days a week, at most`}</Label>
					<Select.Trigger accessibilityLabel={t`Office days a week, at most`} className="bg-default">
						<Select.Value placeholder={t`Any`} />
						<Select.TriggerIndicator />
					</Select.Trigger>
					<Select.Portal>
						<Select.Overlay />
						<Select.Content presentation="popover" width="trigger">
							{officeOptions.map((option) => (
								<Select.Item key={option.value} value={option.value} label={option.label} />
							))}
						</Select.Content>
					</Select.Portal>
				</Select>
				<TextField isInvalid={noticeValue === undefined}>
					<Label>{t`Notice period (weeks)`}</Label>
					<Input
						variant="secondary"
						keyboardType="number-pad"
						value={notice}
						maxLength={3}
						accessibilityLabel={t`Notice period (weeks)`}
						onChangeText={setNotice}
						onBlur={() => flush()}
					/>
					<FieldError>{t`Enter a whole number from 0 to 52, or leave blank.`}</FieldError>
				</TextField>
				<View className="gap-1">
					<Description>{t`Times are shown in ${timeZone}.`}</Description>
					<Button
						size="sm"
						variant="ghost"
						className="-ms-3 self-start"
						onPress={() => router.push(routes.account("preferences"))}
					>
						<Button.Label>{t`Change timezone`}</Button.Label>
					</Button>
				</View>
			</PreferencesCard>

			<PreferencesCard icon="brain" title={t`Coach memory`}>
				<View className="gap-2">
					<Label>{t`Remember facts from my messages`}</Label>
					<Segment
						accessibilityLabel={t`Remember facts from my messages`}
						value={draft.memoryMode}
						onValueChange={(memoryMode) => change({ memoryMode })}
						options={[
							{ value: "ask", label: t`Ask first` },
							{ value: "auto", label: t`Automatically` },
							{ value: "off", label: t`Never` },
						]}
					/>
					<Description>{memoryHelp}</Description>
				</View>
			</PreferencesCard>
		</View>
	);
}
