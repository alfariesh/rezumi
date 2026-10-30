import type { CareerProfileData } from "@rezumi/schema/career";
import type { KeyboardEvent } from "react";
import { Segment } from "@heroui-pro/react";
import { Button, FieldError, Input, InputGroup, Label, TextArea, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { useDebouncedSave } from "../hooks";
import { CareerLoadError, CareerLoading } from "../load-state";
import { CareerWidget, useCareerTime, useNow } from "../shared";
import { parseAmount } from "./amount";
import { SearchRegionsField } from "./search-regions-field";
import { Token, TokenFrame, tokenInputClass } from "./token-field";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

const saveFailed = (error: unknown) => toastError(error, t`Couldn't save your preferences. Try again.`);

/** The Preferences profile, saved whole. The cache updates at once; a failed save puts the server copy back. */
export function useProfile() {
	const queryClient = useQueryClient();
	const queryKey = orpc.career.profile.queryKey();
	const query = useQuery(orpc.career.profile.queryOptions());
	const profile = query.data;
	const mutation = useMutation({
		...orpc.career.saveProfile.mutationOptions(),
		onError: (error) => {
			void queryClient.invalidateQueries({ queryKey });
			saveFailed(error);
		},
	});
	const save = (next: CareerProfileData) => {
		queryClient.setQueryData(queryKey, next);
		mutation.mutate(next);
	};
	return { profile, save, isError: query.isError, retry: () => void query.refetch() };
}

export function PreferencesPage() {
	const query = useQuery(orpc.career.profile.queryOptions());
	const profile = query.data;
	if (query.isError && !profile) return <CareerLoadError onRetry={() => void query.refetch()} />;
	// The form keeps its own draft once loaded, so a background refetch never overwrites what's being typed.
	return profile ? <PreferencesForm initial={profile} /> : <CareerLoading />;
}

type PreferencesFormProps = { initial: CareerProfileData };

function PreferencesForm({ initial }: PreferencesFormProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const now = useNow();
	const [draft, setDraft] = useState(initial);
	const [saved, setSaved] = useState(initial);
	const saves = useRef<Promise<unknown>>(Promise.resolve());
	const [status, setStatus] = useState<{ saving: boolean; failed: boolean; at: number | null }>({
		saving: false,
		failed: false,
		at: null,
	});
	const { timeZone } = useCareerTime();
	const id = useId();

	const change = (patch: Partial<CareerProfileData>) => {
		const next = { ...draft, ...patch };
		setDraft(next);
		// Times elsewhere follow the new timezone at once; the server copy follows within 2 seconds.
		queryClient.setQueryData(orpc.career.profile.queryKey(), next);
	};

	// Called directly (not through a mutation hook) so the flush on unmount still saves.
	const flush = useDebouncedSave(JSON.stringify(draft), JSON.stringify(saved), (json) => {
		const next = JSON.parse(json) as CareerProfileData;
		setStatus((current) => ({ ...current, saving: true, failed: false }));
		const operation = saves.current.then(() => client.career.saveProfile(next));
		saves.current = operation.catch(() => undefined);
		operation
			.then(() => {
				setSaved(next);
				setStatus({ saving: false, failed: false, at: Date.now() });
			})
			.catch((error: unknown) => {
				setStatus((current) => ({ ...current, saving: false, failed: true }));
				void queryClient.invalidateQueries({ queryKey: orpc.career.profile.queryKey() });
				saveFailed(error);
			});
	});

	const failed = status.failed && !status.saving;
	const dirty = !failed && (status.saving || JSON.stringify(draft) !== JSON.stringify(saved));
	const justNow = status.at !== null && now.getTime() - status.at < 60_000;

	return (
		<div className="grid max-w-[820px] gap-4" onBlur={() => flush()}>
			<CareerWidget
				title={<Trans>What you're looking for</Trans>}
				trailing={
					<span className="flex items-center gap-1.5">
						<span role="status" className="flex items-center gap-1 text-xs text-muted">
							<Icon name={failed ? "cloud-slash" : dirty ? "arrows-clockwise" : "cloud-check"} size={16} />
							{failed ? (
								<Trans>Not saved</Trans>
							) : dirty ? (
								<Trans>Saving…</Trans>
							) : justNow ? (
								<Trans>Saved just now</Trans>
							) : (
								<Trans>Saved</Trans>
							)}
						</span>
						{failed && (
							<Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onPress={() => flush(true)}>
								<Trans>Retry</Trans>
							</Button>
						)}
					</span>
				}
				contentClassName="gap-5 p-4"
			>
				<div className="grid gap-5 sm:grid-cols-2">
					<ChipField
						label={t`Target roles`}
						placeholder={t`Add a role, then Enter`}
						value={draft.targetRoles}
						onChange={(targetRoles) => change({ targetRoles })}
					/>
					<ChipField
						label={t`Where you want to work`}
						placeholder={t`Add a place, then Enter`}
						value={draft.locations}
						onChange={(locations) => change({ locations })}
					/>
					<div className="sm:col-span-2">
						<SearchRegionsField
							value={draft.searchRegions}
							accountTimeZone={timeZone}
							onChange={(searchRegions) => change({ searchRegions })}
						/>
					</div>
				</div>

				<TextField
					fullWidth
					value={draft.priorities}
					onChange={(priorities) => change({ priorities })}
					maxLength={4000}
				>
					<Label>
						<Trans>What matters to you</Trans>
					</Label>
					<TextArea variant="secondary" rows={3} className="min-h-[84px]" />
				</TextField>
			</CareerWidget>

			<CareerWidget title={<Trans>Requirements</Trans>} contentClassName="gap-5 p-4">
				<p className="text-sm text-muted">
					<Trans>Used to check roles and offers. Each is a number, so the coach can compare without guessing.</Trans>
				</p>

				<div className="grid gap-5 sm:grid-cols-2">
					<SalaryField locale={i18n.locale} value={draft.minBase} onChange={(minBase) => change({ minBase })} />

					<TextField>
						<Label>
							<Trans>Notice period</Trans>
						</Label>
						<InputGroup variant="secondary">
							<InputGroup.Input
								type="number"
								inputMode="numeric"
								min={0}
								max={52}
								value={draft.noticeWeeks ?? ""}
								onChange={(event) => {
									const weeks = event.target.valueAsNumber;
									change({ noticeWeeks: Number.isNaN(weeks) ? null : Math.min(52, Math.max(0, Math.round(weeks))) });
								}}
								className="[appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none"
							/>
							<InputGroup.Suffix>
								<Trans>weeks</Trans>
							</InputGroup.Suffix>
						</InputGroup>
					</TextField>

					<div className="grid content-start gap-1.5 sm:col-span-2">
						<span id={`${id}-office`} className="text-sm font-medium">
							<Trans>Office days a week, at most</Trans>
						</span>
						<Segment
							aria-labelledby={`${id}-office`}
							selectedKey={draft.maxOfficeDays === null ? "any" : String(draft.maxOfficeDays)}
							onSelectionChange={(key) => change({ maxOfficeDays: String(key) === "any" ? null : Number(key) })}
							className="w-fit max-w-full overflow-x-auto"
						>
							<Segment.Item id="any" className="touch-target w-auto flex-none px-3">
								<Trans>Any</Trans>
							</Segment.Item>
							{[0, 1, 2, 3, 4, 5].map((days) => (
								<Segment.Item key={days} id={String(days)} className="touch-target w-auto flex-none px-3 tabular-nums">
									{days === 0 ? t`Remote` : days}
								</Segment.Item>
							))}
						</Segment>
					</div>
				</div>

				<p className="text-xs text-muted">
					<Trans>Times are shown in {timeZone}.</Trans>{" "}
					<Link
						to="/dashboard/settings/app"
						hash="timezone"
						className="underline underline-offset-2 hover:text-foreground"
					>
						<Trans>Change timezone</Trans>
					</Link>
				</p>
			</CareerWidget>
		</div>
	);
}

const bareSelect =
	"field-sizing-content cursor-pointer appearance-none bg-transparent text-muted outline-none hover:text-foreground focus-visible:text-foreground";

type ChipFieldProps = { label: string; placeholder: string; value: string[]; onChange: (value: string[]) => void };

/** Enter or comma adds a chip, Backspace in an empty input removes the last one, × removes one. */
function ChipField({ label, placeholder, value, onChange }: ChipFieldProps) {
	const id = useId();
	const [input, setInput] = useState("");

	const add = () => {
		const chip = input.trim().slice(0, 200);
		if (chip && !value.includes(chip) && value.length < 20) onChange([...value, chip]);
		setInput("");
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add();
		} else if (event.key === "Backspace" && input === "" && value.length > 0) {
			onChange(value.slice(0, -1));
		}
	};

	return (
		<div className="grid content-start gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			<TokenFrame>
				{value.map((chip) => (
					<Token
						key={chip}
						removeLabel={t`Remove ${chip}`}
						onRemove={() => onChange(value.filter((item) => item !== chip))}
					>
						{chip}
					</Token>
				))}
				<Input
					id={id}
					value={input}
					placeholder={placeholder}
					onChange={(event) => setInput(event.target.value)}
					onKeyDown={onKeyDown}
					onBlur={add}
					className={tokenInputClass}
				/>
			</TokenFrame>
		</div>
	);
}

type SalaryFieldProps = {
	locale: string;
	value: CareerProfileData["minBase"];
	onChange: (value: CareerProfileData["minBase"]) => void;
};

const currencies = Intl.supportedValuesOf("currency");

/** Minimum base: currency prefix and period suffix are small selects; the amount gets separators on blur. */
function SalaryField({ locale, value, onChange }: SalaryFieldProps) {
	const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
	// While focused the raw typing shows; otherwise the formatted amount.
	const [typing, setTyping] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);
	const formatted = value.amount === null ? "" : number.format(value.amount);

	const symbol = (currency: string) =>
		new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "symbol" })
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? currency;

	const periods = { hour: t`/ hour`, month: t`/ month`, year: t`/ year` };

	return (
		<TextField
			isInvalid={invalid}
			validationBehavior="aria"
			value={typing ?? formatted}
			onChange={(text) => {
				setTyping(text);
				setInvalid(false);
			}}
		>
			<Label>
				<Trans>Minimum base salary</Trans>
			</Label>
			<InputGroup variant="secondary">
				<InputGroup.Prefix>
					<select
						aria-label={t`Currency`}
						value={value.currency}
						onChange={(event) => onChange({ ...value, currency: event.target.value })}
						className={bareSelect}
					>
						{currencies.map((currency) => (
							<option key={currency} value={currency}>
								{symbol(currency)}
							</option>
						))}
					</select>
				</InputGroup.Prefix>
				<InputGroup.Input
					inputMode="decimal"
					className="tabular-nums"
					onFocus={() => setTyping(typing ?? formatted)}
					onBlur={() => {
						const amount = parseAmount(typing ?? formatted, locale);
						if (amount === undefined) return setInvalid(true);
						onChange({ ...value, amount });
						setInvalid(false);
						setTyping(null);
					}}
				/>
				<InputGroup.Suffix>
					<select
						aria-label={t`Pay period`}
						value={value.period}
						onChange={(event) => onChange({ ...value, period: event.target.value as keyof typeof periods })}
						className={cn(bareSelect, "text-end text-xs")}
					>
						{Object.entries(periods).map(([period, label]) => (
							<option key={period} value={period}>
								{label}
							</option>
						))}
					</select>
				</InputGroup.Suffix>
			</InputGroup>
			<FieldError>
				<Trans>Enter a full amount, such as 95000. Your previous amount is unchanged.</Trans>
			</FieldError>
		</TextField>
	);
}
