import type { SavedData, SavedItem } from "./hooks";
import type { CareerProfileData } from "@rezumi/schema/career";
import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { EmptyState } from "@heroui-pro/react";
import { Alert, Avatar, Button, Chip, Dropdown, Header, Label, Skeleton } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";
import { formatList } from "@rezumi/utils/locale";
import { cn } from "@rezumi/utils/style";
import { CareerLoadError } from "./load-state";
import { defaultPair, formatMoney, matchingPlace, meetsMinimum, moneyDifference, sameTerms } from "./offer-compare";
import { CareerWidget, useCareerTime, useNow } from "./shared";
import { orpc } from "@/libs/orpc/client";

type Offer = SavedItem & { data: SavedData<"offer"> };
type Side = "a" | "b";

const PAIR_KEY = "career:offers-pair";

const readPair = (): { a?: string; b?: string } => {
	try {
		return JSON.parse(localStorage.getItem(PAIR_KEY) ?? "{}") as { a?: string; b?: string };
	} catch {
		return {};
	}
};

const writePair = (a: string | undefined, b: string | undefined) => {
	try {
		localStorage.setItem(PAIR_KEY, JSON.stringify({ a, b }));
	} catch {
		// Private windows can refuse storage; the pair stays in the URL.
	}
};

const companyOf = (offer: Offer) => offer.application?.company ?? t`Deleted application`;
const versionLabel = (offer: Offer) => (offer.data.version === "verbal" ? t`Verbal offer` : t`Written offer`);

type OffersPageProps = { a: string | undefined; b: string | undefined };

/** C20: two saved offers side by side, in their own currency and pay period, against the user's requirements. */
export function OffersPage({ a, b }: OffersPageProps) {
	const navigate = useNavigate();
	const query = useQuery(orpc.career.savedItems.queryOptions({ input: { kind: "offer" } }));
	const profileQuery = useQuery(orpc.career.profile.queryOptions());
	const offers = query.data?.filter((item): item is Offer => item.data.kind === "offer");

	const setPair = (next: { a: string | undefined; b: string | undefined }) =>
		void navigate({ to: "/dashboard/career/offers", search: next });

	// Fill the URL with a pair: the remembered one if it still exists, else the two newest from different jobs.
	useEffect(() => {
		const offers = query.data?.filter((item) => item.data.kind === "offer");
		if (!offers?.length) return;
		const exists = (id: string | undefined) => id !== undefined && offers.some((offer) => offer.id === id);
		if (exists(a) && a !== b && (exists(b) || offers.length === 1)) {
			writePair(a, b);
			return;
		}
		const stored = readPair();
		const [first, second] =
			exists(stored.a) && exists(stored.b) && stored.a !== stored.b ? [stored.a, stored.b] : defaultPair(offers);
		// No distinct second offer leaves the right column empty, never a copy of the left.
		const nextA = exists(a) ? a : first;
		const next = { a: nextA, b: exists(b) && b !== nextA ? b : nextA === second ? first : second };
		if (next.a !== a || next.b !== b)
			void navigate({ to: "/dashboard/career/offers", search: { a: next.a, b: next.b }, replace: true });
	}, [query.data, a, b, navigate]);

	if ((query.isError && !query.data) || (profileQuery.isError && !profileQuery.data))
		return (
			<CareerLoadError
				onRetry={() => {
					void query.refetch();
					void profileQuery.refetch();
				}}
			/>
		);
	if (query.isPending || profileQuery.isPending)
		return (
			<div className="grid gap-4">
				<Skeleton className="h-[520px] rounded-2xl" />
			</div>
		);

	if (!offers?.length)
		return (
			<EmptyState className="rounded-2xl bg-surface-secondary">
				<EmptyState.Header>
					<EmptyState.Media variant="icon">
						<Icon name="scales" size={20} />
					</EmptyState.Media>
					<EmptyState.Title>
						<Trans>No offers to compare yet</Trans>
					</EmptyState.Title>
					<EmptyState.Description>
						<Trans>Paste an offer into an application's Messages tab.</Trans>
					</EmptyState.Description>
				</EmptyState.Header>
			</EmptyState>
		);

	const left = offers.find((offer) => offer.id === a);
	const right = offers.find((offer) => offer.id === b);
	const pair = [left, right].filter((offer): offer is Offer => offer !== undefined);

	return (
		<div className="grid gap-4">
			<CareerWidget
				title={<Trans>Offer comparison</Trans>}
				trailing={
					<div className="flex items-center gap-1.5">
						<IconButton
							icon="arrows-left-right"
							label={t`Swap`}
							variant="ghost"
							isDisabled={!left || !right}
							onPress={() => setPair({ a: b, b: a })}
						/>
						<Button
							size="sm"
							onPress={() =>
								void navigate({
									to: "/dashboard/coach/{-$conversationId}",
									params: { conversationId: undefined },
									search: { offers: pair.map((offer) => offer.id) },
								})
							}
						>
							<Trans>Plan what to ask</Trans>
						</Button>
					</div>
				}
				contentClassName="gap-0 p-0"
			>
				<p className="px-5 pt-4 pb-3 text-sm text-muted">
					<Trans>
						Compared in their original currency and pay period. Comparing doesn't share anything with the coach.
					</Trans>
				</p>
				<ComparisonTable
					offers={offers}
					left={left}
					right={right}
					onChoose={(side, id) => setPair(side === "a" ? { a: id, b } : { a, b: id })}
				/>
			</CareerWidget>

			<div className="grid gap-4">
				<Alert status="warning">
					<Alert.Indicator className="shrink-0" />
					<Alert.Content>
						<Alert.Title>
							<Trans>Totals aren't added up on purpose.</Trans>
						</Alert.Title>
						<Alert.Description>
							<Trans>
								Bonus and equity depend on conditions, and equity value is uncertain for both. Read the original offer
								documents before comparing totals.
							</Trans>
						</Alert.Description>
					</Alert.Content>
				</Alert>
				<OpenQuestions offers={pair} />
			</div>
		</div>
	);
}

type Note = { icon: IconName; tone: "better" | "warn" | "muted"; text: string };
type Cell = { value: ReactNode; strong?: boolean; notes: Note[] };
type Requirement = { met: boolean | null; text: string };

type ComparisonTableProps = {
	offers: Offer[];
	left: Offer | undefined;
	right: Offer | undefined;
	onChoose: (side: Side, id: string) => void;
};

/** A real table: the offers are its columns and each term a row. Narrow screens scroll it inside its own box. */
function ComparisonTable({ offers, left, right, onChoose }: ComparisonTableProps) {
	const cells = useCells();
	const { data: profile } = useQuery(orpc.career.profile.queryOptions());
	const rows = [
		{ key: "base", label: t`Base salary` },
		{ key: "variable", label: t`Bonus` },
		{ key: "equity", label: t`Equity` },
		{ key: "location", label: t`Where you work` },
		{ key: "leave", label: t`Leave` },
		{ key: "learning", label: t`Learning budget` },
		{ key: "other", label: t`Other benefits` },
		{ key: "respondBy", label: t`Respond by` },
	] as const;
	const columns = [left, right].map((offer, index) => (offer ? cells(offer, index === 0 ? right : left) : undefined));
	const { locale } = useCareerTime();
	const requirements = [left, right].map((offer) => (offer && profile ? requirementsFor(offer, profile, locale) : []));
	const hasRequirements = requirements.some((list) => list.length > 0);
	const label = "sticky start-0 z-[1] w-40 px-5 py-3.5 text-start text-sm font-normal text-muted md:w-48";

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[640px] table-fixed border-collapse">
				<thead>
					<tr>
						<td className="sticky start-0 z-[1] w-40 bg-surface md:w-48" />
						{(["a", "b"] as const).map((side) => {
							const offer = side === "a" ? left : right;
							const other = side === "a" ? right : left;
							return (
								<th key={side} scope="col" className="p-2 text-start align-top font-normal">
									{offer || side === "a" ? (
										<OfferHeader
											offer={offer}
											offers={offers}
											otherId={other?.id}
											onChoose={(id) => onChoose(side, id)}
										/>
									) : (
										<div className="grid gap-1 rounded-xl bg-default p-4">
											<p className="text-sm font-semibold">
												<Trans>Save another offer to compare</Trans>
											</p>
											<p className="text-sm font-normal text-muted">
												<Trans>Paste an offer into an application's Messages tab.</Trans>
											</p>
											{offers.length > 1 && (
												<OfferHeader
													offer={undefined}
													offers={offers}
													otherId={other?.id}
													onChoose={(id) => onChoose(side, id)}
												/>
											)}
										</div>
									)}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.key} className="border-t border-separator align-top">
							<th scope="row" className={cn(label, "bg-surface")}>
								{row.label}
							</th>
							{columns.map((column, index) => {
								const offer = index === 0 ? left : right;
								const cell = column?.[row.key];
								return (
									<td key={index} className="px-5 py-3.5">
										{offer && cell && (
											<>
												<p className={cn("text-sm leading-[21px] tabular-nums", cell.strong && "font-semibold")}>
													{cell.value}
												</p>
												{cell.notes.map((note) =>
													note.tone === "better" ? (
														<Chip
															key={note.text}
															size="sm"
															variant="soft"
															color="success"
															className="mt-1.5 w-fit gap-1"
														>
															<Icon name={note.icon} size={14} />
															<Chip.Label>{note.text}</Chip.Label>
														</Chip>
													) : (
														<p
															key={note.text}
															className={cn(
																"mt-1.5 flex items-start gap-1 text-xs",
																note.tone === "warn" ? "text-warning-soft-foreground" : "text-muted",
															)}
														>
															<Icon name={note.icon} size={14} className="mt-px shrink-0" />
															{note.text}
														</p>
													),
												)}
											</>
										)}
									</td>
								);
							})}
						</tr>
					))}
					{hasRequirements && (
						<tr className="border-t border-separator bg-surface-secondary align-top">
							<th scope="row" className={cn(label, "bg-surface-secondary font-semibold text-foreground")}>
								<Trans>Your requirements</Trans>
							</th>
							{requirements.map((list, index) => (
								<td key={index} className="px-5 py-3.5">
									<ul className="grid gap-1.5">
										{list.map((item) => (
											<li
												key={item.text}
												className={cn(
													"flex items-center gap-1.5 text-sm",
													item.met === true && "text-success-soft-foreground",
													item.met === false && "text-danger",
													item.met === null && "text-warning-soft-foreground",
												)}
											>
												<Icon
													name={item.met === true ? "check-circle" : item.met === false ? "x-circle" : "question"}
													size={16}
													className="shrink-0"
												/>
												{item.text}
											</li>
										))}
									</ul>
								</td>
							))}
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}

type OfferHeaderProps = {
	offer: Offer | undefined;
	offers: Offer[];
	otherId: string | undefined;
	onChoose: (id: string) => void;
};

/** The column header is the picker: every application with a saved offer, and each version of it. */
function OfferHeader({ offer, offers, otherId, onChoose }: OfferHeaderProps) {
	const { when } = useCareerTime();
	const groups = new Map<string, Offer[]>();
	for (const item of offers) {
		const key = item.applicationId ?? item.id;
		groups.set(key, [...(groups.get(key) ?? []), item]);
	}

	return (
		<Dropdown>
			{offer ? (
				<Button
					variant="ghost"
					className="h-auto min-h-0 w-full justify-start gap-3 rounded-xl px-3 py-3 text-start font-normal"
				>
					<Avatar size="md" className="shrink-0">
						<Avatar.Fallback>{companyOf(offer).charAt(0).toLocaleUpperCase()}</Avatar.Fallback>
					</Avatar>
					<span className="grid min-w-0 flex-1">
						<span className="truncate text-[15px] font-semibold">{companyOf(offer)}</span>
						{offer.application?.role && <span className="truncate text-sm text-muted">{offer.application.role}</span>}
						<span className="text-xs text-muted">
							{versionLabel(offer)} · {t`saved ${when(offer.createdAt)}`}
						</span>
					</span>
					<Icon name="caret-down" size={18} className="shrink-0 text-muted" />
				</Button>
			) : (
				<Button variant="secondary" size="sm" className="mt-2 w-fit">
					<Trans>Choose an offer</Trans>
				</Button>
			)}
			<Dropdown.Popover placement="bottom start" className="w-72">
				<Dropdown.Menu>
					{[...groups.values()].map((versions) => {
						const [first] = versions;
						if (!first) return null;
						return (
							<Dropdown.Section key={first.id}>
								<Header>
									{companyOf(first)}
									{first.application?.role ? ` · ${first.application.role}` : ""}
								</Header>
								{versions.map((item) => (
									<Dropdown.Item
										key={item.id}
										id={item.id}
										textValue={`${versionLabel(item)} · ${when(item.createdAt)}`}
										isDisabled={item.id === otherId}
										onAction={() => onChoose(item.id)}
									>
										<Label className="flex-1">
											{versionLabel(item)} · {when(item.createdAt)}
										</Label>
										{item.id === offer?.id && <Icon name="check" size={16} />}
									</Dropdown.Item>
								))}
							</Dropdown.Section>
						);
					})}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}

/** Each term of one offer, with notes against the other column where they can be compared honestly. */
function useCells() {
	const { locale, when, relative } = useCareerTime();
	const now = useNow();

	return (offer: Offer, other: Offer | undefined): Record<string, Cell> => {
		const terms = offer.data;
		const company = companyOf(offer);
		const unknown: Cell = {
			value: <span className="text-muted">{t`Unknown`}</span>,
			notes: [{ icon: "question", tone: "warn", text: t`Not in the offer · ask ${company}` }],
		};
		const money = (amount: number) => {
			const value = formatMoney(locale, terms.currency, amount);
			return { hour: t`${value} an hour`, month: t`${value} a month`, year: t`${value} a year` }[terms.period];
		};
		const better = (key: "base" | "variable" | "learning"): Note[] => {
			if (!other) return [];
			const difference = moneyDifference(terms, other.data, key);
			if (difference !== null && difference > 0)
				return [{ icon: "arrow-up", tone: "better", text: t`${formatMoney(locale, terms.currency, difference)} more` }];
			if (key === "base" && difference === null && other.data.base !== null && terms.base !== null)
				return [
					{
						icon: "info",
						tone: "muted",
						text:
							terms.currency === other.data.currency
								? t`Different pay period, not compared`
								: t`Different currency, not compared`,
					},
				];
			return [];
		};
		const text = (value: string): Cell => (value.trim() ? { value, notes: [] } : unknown);

		const days = terms.officeDays;
		const office =
			days === null
				? null
				: days === 0
					? terms.location
						? null
						: t`Remote`
					: plural(days, { one: "# office day a week", other: "# office days a week" });
		const place = [terms.location.trim(), office].filter(Boolean).join(" · ");

		const respondBy = terms.respondBy ? new Date(terms.respondBy) : null;
		const hoursLeft = respondBy ? (respondBy.getTime() - now.getTime()) / 3_600_000 : null;

		return {
			base: terms.base === null ? unknown : { value: money(terms.base), strong: true, notes: better("base") },
			variable:
				terms.variable === null
					? unknown
					: {
							value: money(terms.variable),
							notes: [
								...better("variable"),
								...(terms.variableConditions.trim()
									? [{ icon: "question", tone: "warn", text: terms.variableConditions } as const]
									: []),
							],
						},
			equity: terms.equity.trim()
				? {
						value: terms.equity,
						notes: [
							{
								icon: "question",
								tone: "warn",
								// A percentage of the company is worth what the valuation says, after dilution.
								text: terms.equity.includes("%") ? t`Valuation and dilution uncertain` : t`Value uncertain`,
							},
						],
					}
				: unknown,
			location: place ? { value: place, notes: [] } : unknown,
			leave: text(terms.leave),
			learning: terms.learning === null ? unknown : { value: money(terms.learning), notes: better("learning") },
			other: text(terms.other),
			respondBy:
				respondBy && hoursLeft !== null
					? {
							value: when(respondBy),
							notes: [{ icon: "clock", tone: hoursLeft < 48 ? "warn" : "muted", text: relative(respondBy, now) }],
						}
					: unknown,
		};
	};
}

/** Checks against Preferences: minimum base (same terms only), office days, places. */
function requirementsFor(offer: Offer, profile: CareerProfileData, locale: string) {
	const terms = offer.data;
	const list: Requirement[] = [];
	const { amount, currency } = profile.minBase;
	if (amount !== null) {
		const minimum = formatMoney(locale, currency, amount);
		list.push({
			met: meetsMinimum(terms, profile.minBase),
			text: sameTerms(terms, profile.minBase) ? t`${minimum} minimum` : t`${minimum} minimum, in other terms`,
		});
	}
	if (profile.maxOfficeDays !== null && terms.officeDays !== null) {
		const days = terms.officeDays;
		const limit = profile.maxOfficeDays;
		list.push({
			met: days <= limit,
			text:
				days === 0
					? t`Remote`
					: days === limit
						? plural(days, { one: "# office day, your limit", other: "# office days, your limit" })
						: days < limit
							? plural(days, { one: "# office day, under your limit", other: "# office days, under your limit" })
							: plural(days, { one: "# office day, over your limit", other: "# office days, over your limit" }),
		});
	}
	if (profile.locations.length > 0 && terms.location.trim()) {
		const match = matchingPlace(terms.location, profile.locations);
		list.push({
			met: match ? true : null,
			text: match ? terms.location : t`${terms.location}, not one of your places`,
		});
	}
	return list;
}

type OpenQuestionsProps = { offers: Offer[] };

/** What neither offer says yet, as questions to ask, led by what the user said matters. */
function OpenQuestions({ offers }: OpenQuestionsProps) {
	const { locale } = useCareerTime();
	const { data: profile } = useQuery(orpc.career.profile.queryOptions());
	const names = (list: Offer[]) => formatList(locale, list.map(companyOf));

	const checks: [string, (terms: Offer["data"]) => boolean][] = [
		[t`What is the base salary, and is it negotiable?`, (terms) => terms.base === null],
		[t`Is there a bonus, and what does it depend on?`, (terms) => terms.variable === null],
		[
			t`How is the bonus decided, and how much of it was paid out last year?`,
			(terms) => terms.variable !== null && terms.variableConditions.trim() !== "",
		],
		[t`Is equity part of the offer?`, (terms) => !terms.equity.trim()],
		[
			t`What is the equity worth today: strike price, latest valuation, vesting and exercise window?`,
			(terms) => terms.equity.trim() !== "",
		],
		[t`How many days a week are expected in the office?`, (terms) => terms.officeDays === null],
		[t`How many days of leave come with it?`, (terms) => !terms.leave.trim()],
		[t`Is there a learning budget?`, (terms) => terms.learning === null],
		[t`Which other benefits come with it, like pension or allowances?`, (terms) => !terms.other.trim()],
		[t`When do they need your answer?`, (terms) => terms.respondBy === null],
	];
	const questions = checks.flatMap(([question, open]) => {
		const who = offers.filter((offer) => open(offer.data));
		return who.length
			? [{ question, ask: who.length === offers.length && offers.length > 1 ? t`Ask both` : t`Ask ${names(who)}` }]
			: [];
	});

	const priorities = profile?.priorities.trim() ?? "";
	// The first sentence keeps the lead-in short; the full text is in Preferences.
	const said = priorities.length > 160 ? (priorities.split(/(?<=[.!?])\s/)[0] ?? priorities) : priorities;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(
				questions.map((item, index) => `${index + 1}. ${item.question} · ${item.ask}`).join("\n"),
			);
			toast.add({ description: t`Questions copied` });
		} catch {
			toast.add({ type: "error", description: t`Couldn't copy the questions. Select the text and copy it manually.` });
		}
	};

	return (
		<CareerWidget title={<Trans>Not in either offer yet</Trans>} contentClassName="gap-3 p-4">
			{questions.length === 0 ? (
				<p className="text-sm text-muted">
					<Trans>Both offers cover everything compared here.</Trans>
				</p>
			) : (
				<>
					<p className="text-sm leading-[21px] text-muted">
						{said
							? offers.length > 1
								? t`You said: “${said}” Ask both companies before deciding.`
								: t`You said: “${said}” Ask before deciding.`
							: t`Ask before deciding.`}
					</p>
					<ol className="grid gap-2.5">
						{questions.map((item, index) => (
							<li key={item.question} className="grid grid-cols-[24px_minmax(0,1fr)] text-sm leading-[21px]">
								<span className="text-muted tabular-nums">{index + 1}.</span>
								<span>
									{item.question} <span className="text-xs text-muted">· {item.ask}</span>
								</span>
							</li>
						))}
					</ol>
					<Button variant="secondary" size="sm" className="w-fit" onPress={() => void copy()}>
						<Trans>Copy questions</Trans>
					</Button>
				</>
			)}
		</CareerWidget>
	);
}
