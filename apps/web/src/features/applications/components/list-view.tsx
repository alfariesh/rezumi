import type { ApplicationSummary } from "../types";
import type { ApplicationStatus } from "@rezumi/schema/applications/data";
import { ActionBar, EmptyState } from "@heroui-pro/react";
import { Button, Checkbox, Chip, Dropdown, Input, Label, Popover, Separator } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { describeNextStep, getNextStep } from "../next-step";
import { CLOSED_REASONS, getClosedReasonLabel, getStageColor, getStageLabel, LIST_ORDER, PIPELINE } from "../stages";
import { useInvalidateApplications } from "../use-application-actions";
import { useConfirm } from "@/hooks/use-confirm";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";

type SortKey = "role" | "next" | "updated";
type Sort = { key: SortKey; direction: "asc" | "desc" };

const nextStepTime = (application: ApplicationSummary) => {
	const step = getNextStep(application);
	return step.kind === "interview" || step.kind === "follow-up" ? step.at.getTime() : Number.POSITIVE_INFINITY;
};

// Sort keys are computed once per row, not once per comparison.
const sortValue: Record<SortKey, (application: ApplicationSummary) => string | number> = {
	role: (application) => application.role,
	next: nextStepTime,
	updated: (application) => new Date(application.updatedAt).getTime(),
};

// Header and cells follow the Documents table: a filled header bar with rounded ends, 16px/12px cell padding and a
// faint divider under every row.
const TH = "bg-surface-secondary px-4 py-2.5 text-start text-xs font-medium text-muted";
const ROW_DIVIDER = "[&>td]:border-b [&>td]:border-separator-tertiary/25";

const compareValues = (a: string | number, b: string | number) =>
	typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);

type ListViewProps = {
	applications: ApplicationSummary[];
	showClosed: boolean;
	selectedId: string | null;
	onOpen: (application: ApplicationSummary) => void;
};

/**
 * The default view: applications grouped by stage in the order that needs you first (Interview, Offer, Screening,
 * Applied, Saved, then Closed when shown). Groups collapse, headers sort within groups, and row checkboxes select
 * for bulk moves, tags, closing and deleting. Phones get two-line rows.
 */
export function ApplicationList({ applications, showClosed, selectedId, onOpen }: ListViewProps) {
	const breakpoint = useBreakpoint();
	const phone = breakpoint === "mobile";
	const [collapsed, setCollapsed] = useState<ReadonlySet<ApplicationStatus>>(new Set());
	const [sort, setSort] = useState<Sort>({ key: "updated", direction: "desc" });
	const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

	// Selections only cover what's on screen.
	const checkedIds = applications
		.filter(
			(application) =>
				checked.has(application.id) &&
				(application.status !== "closed" || showClosed) &&
				!collapsed.has(application.status),
		)
		.map((application) => application.id);
	if (checkedIds.length !== checked.size) setChecked(new Set(checkedIds));

	const groups = useMemo(() => {
		const sign = sort.direction === "asc" ? 1 : -1;
		const keys = new Map(applications.map((application) => [application.id, sortValue[sort.key](application)]));
		const key = (application: ApplicationSummary) => keys.get(application.id) ?? 0;
		return LIST_ORDER.filter((status) => status !== "closed" || showClosed)
			.map((status) => ({
				status,
				rows: applications
					.filter((application) => application.status === status)
					.sort(
						(a, b) =>
							sign * compareValues(key(a), key(b)) ||
							(sort.key === "role" ? sign * a.company.localeCompare(b.company) : 0),
					),
			}))
			.filter((group) => group.rows.length > 0);
	}, [applications, showClosed, sort]);

	const toggleGroup = (status: ApplicationStatus) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			return next;
		});

	const toggleRow = (id: string) =>
		setChecked((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const sortBy = (key: SortKey) =>
		setSort((current) =>
			current.key === key
				? { key, direction: current.direction === "asc" ? "desc" : "asc" }
				: { key, direction: key === "updated" ? "desc" : "asc" },
		);

	const header = (key: SortKey, label: string, className?: string) => (
		<th
			scope="col"
			aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
			className={cn(TH, className)}
		>
			<button
				type="button"
				onClick={() => sortBy(key)}
				className="inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground"
			>
				{label}
				{sort.key === key && <Icon name={sort.direction === "asc" ? "arrow-up" : "arrow-down"} size={14} />}
			</button>
		</th>
	);

	if (groups.length === 0)
		return (
			<EmptyState size="sm" className="rounded-2xl border border-dashed border-border py-6">
				<EmptyState.Header>
					<EmptyState.Media variant="icon">
						<Icon name="rows" size={20} />
					</EmptyState.Media>
					<EmptyState.Title>
						<Trans>No open applications</Trans>
					</EmptyState.Title>
					<EmptyState.Description className="max-w-sm text-pretty">
						<Trans>Closed applications are hidden. Turn on Show closed to see them.</Trans>
					</EmptyState.Description>
				</EmptyState.Header>
			</EmptyState>
		);

	return (
		<div className="grid min-w-0 content-start gap-3">
			<table className={cn("w-full border-separate border-spacing-0 text-sm", !phone && "table-fixed")}>
				{!phone && (
					<thead>
						<tr>
							<th scope="col" className={cn(TH, "w-11 rounded-s-2xl")}>
								<span className="sr-only">
									<Trans>Select</Trans>
								</span>
							</th>
							{header("role", t`Role`)}
							{header("next", t`Next step`, "w-1/4")}
							<th scope="col" className={cn(TH, "w-32 max-xl:hidden")}>
								<Trans>Stage</Trans>
							</th>
							{header("updated", t`Updated`, "w-32 max-lg:hidden")}
							<th scope="col" className={cn(TH, "w-24 rounded-e-2xl")}>
								<Trans>Sent</Trans>
							</th>
						</tr>
					</thead>
				)}

				{groups.map(({ status, rows }) => {
					const open = !collapsed.has(status);
					const groupId = `applications-group-${status}`;
					return (
						<tbody key={status} aria-labelledby={groupId}>
							<tr>
								<th
									scope="colgroup"
									colSpan={phone ? 1 : breakpoint === "wide" ? 6 : breakpoint === "desktop" ? 5 : 4}
									className="pt-3 text-start"
								>
									<button
										type="button"
										id={groupId}
										aria-expanded={open}
										onClick={() => toggleGroup(status)}
										className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm font-semibold transition-colors hover:bg-default"
									>
										<Icon
											name="caret-right"
											size={18}
											className={cn("text-muted transition-transform duration-standard", open && "rotate-90")}
										/>
										<span
											aria-hidden="true"
											className="size-2 rounded-sm"
											style={{ background: getStageColor(status) }}
										/>
										{getStageLabel(status)}
										<span className="text-xs font-normal text-muted tabular-nums">{rows.length}</span>
									</button>
								</th>
							</tr>
							{open &&
								rows.map((application) => (
									<ApplicationRow
										key={application.id}
										application={application}
										phone={phone}
										selected={application.id === selectedId}
										checked={checked.has(application.id)}
										onCheck={toggleRow}
										onOpen={onOpen}
									/>
								))}
						</tbody>
					);
				})}
			</table>

			<BulkBar ids={checkedIds} onDone={() => setChecked(new Set())} />
		</div>
	);
}

type ApplicationRowProps = {
	application: ApplicationSummary;
	phone: boolean;
	selected: boolean;
	checked: boolean;
	onCheck: (id: string) => void;
	onOpen: (application: ApplicationSummary) => void;
};

// Memoized with id-taking callbacks, so one row's change doesn't re-render the other rows.
const ApplicationRow = memo(function ApplicationRow({
	application,
	phone,
	selected,
	checked,
	onCheck,
	onOpen,
}: ApplicationRowProps) {
	const { i18n } = useLingui();
	const next = describeNextStep(getNextStep(application), application, i18n.locale);
	const sent = application.status !== "saved";
	const tone = next.tone === "warn" ? "text-warning-soft-foreground" : "text-muted";

	const initial = (
		<span
			aria-hidden="true"
			className="grid size-8 shrink-0 place-items-center rounded-xl bg-default text-[13px] font-semibold text-muted"
		>
			{application.company.slice(0, 1).toUpperCase()}
		</span>
	);

	const openButton = (
		<button type="button" data-application-open className="grid min-w-0 cursor-pointer text-start">
			<span className="truncate font-medium">{application.role}</span>
			<span className="truncate text-xs text-muted">
				{phone
					? `${application.company} · ${next.title}`
					: [application.company, application.location].filter(Boolean).join(" · ")}
			</span>
		</button>
	);

	if (phone) {
		return (
			<tr
				data-application-id={application.id}
				onClick={() => onOpen(application)}
				className={cn("cursor-pointer", ROW_DIVIDER, selected && "bg-accent-soft")}
			>
				<td className="py-2.5 ps-1">
					<div className="flex items-center gap-3">
						{initial}
						{openButton}
						<Icon name="caret-right" size={20} className="ms-auto shrink-0 text-muted" />
					</div>
				</td>
			</tr>
		);
	}

	return (
		<tr
			data-application-id={application.id}
			onClick={() => onOpen(application)}
			className={cn(
				"cursor-pointer transition-colors duration-quick hover:bg-default",
				ROW_DIVIDER,
				selected && "bg-accent-soft",
			)}
		>
			<td onClick={(event) => event.stopPropagation()} className="w-11 cursor-default px-4">
				<Checkbox
					isSelected={checked}
					onChange={() => onCheck(application.id)}
					aria-label={t`Select ${application.role} at ${application.company}`}
				>
					<Checkbox.Content>
						<Checkbox.Control>
							<Checkbox.Indicator />
						</Checkbox.Control>
					</Checkbox.Content>
				</Checkbox>
			</td>
			<td className="px-4 py-2.5">
				<div className="flex items-center gap-3">
					{initial}
					{openButton}
				</div>
			</td>
			<td className="px-4">
				<span className={cn("flex items-center gap-1.5", tone)}>
					<Icon name={next.icon} size={16} className="shrink-0" />
					<span className="min-w-0 truncate">{next.title}</span>
				</span>
			</td>
			<td className="px-4 max-xl:hidden">
				<Chip size="sm" variant="soft" className="gap-1.5">
					<span
						aria-hidden="true"
						className="size-2 rounded-full"
						style={{ background: getStageColor(application.status) }}
					/>
					{getStageLabel(application.status)}
				</Chip>
			</td>
			<td className="px-4 text-xs whitespace-nowrap text-muted max-lg:hidden">
				{formatRelativeTime(application.updatedAt, i18n.locale)}
			</td>
			<td className="px-4">
				{application.resumeId || application.coverLetterId ? (
					<span className="flex items-center gap-1 text-muted">
						{application.resumeId && <Icon name="file-text" size={18} aria-label={t`Resume`} />}
						{application.coverLetterId && <Icon name="envelope-simple" size={18} aria-label={t`Cover letter`} />}
					</span>
				) : (
					<span className={cn("text-xs", sent ? "text-warning-soft-foreground" : "text-muted")}>
						<Trans>None</Trans>
					</span>
				)}
			</td>
		</tr>
	);
});

type BulkBarProps = { ids: string[]; onDone: () => void };

/** For the checked rows: move them, tag them, close them with a reason, or delete them (after asking). */
function BulkBar({ ids, onDone }: BulkBarProps) {
	const invalidate = useInvalidateApplications();
	const confirm = useConfirm();
	const [tag, setTag] = useState("");

	const bulkUpdate = useMutation({
		...orpc.applications.bulkUpdate.mutationOptions(),
		onSuccess: (result) => {
			invalidate();
			onDone();
			toast.add({
				description: plural(result.updated, { one: "# application updated", other: "# applications updated" }),
			});
		},
		onError: () => toast.add({ type: "error", description: t`Couldn't update the applications. Try again.` }),
	});
	const bulkDelete = useMutation({
		...orpc.applications.bulkDelete.mutationOptions(),
		onSuccess: (result) => {
			invalidate();
			onDone();
			toast.add({
				description: plural(result.deleted, { one: "# application deleted", other: "# applications deleted" }),
			});
		},
		onError: () => toast.add({ type: "error", description: t`Couldn't delete the applications. Try again.` }),
	});

	return (
		<ActionBar aria-label={t`Applications`} isOpen={ids.length > 0}>
			<ActionBar.Prefix>
				<Chip size="sm" variant="soft" className="whitespace-nowrap tabular-nums" aria-live="polite">
					<Plural value={ids.length} one="# selected" other="# selected" />
				</Chip>
			</ActionBar.Prefix>
			<Separator orientation="vertical" className="h-5" />

			<ActionBar.Content>
				<Dropdown>
					<Button variant="ghost" size="sm">
						<Icon name="arrow-right" />
						<span className="action-bar__label">
							<Trans>Move to…</Trans>
						</span>
					</Button>
					<Dropdown.Popover placement="top start">
						<Dropdown.Menu>
							{PIPELINE.map((status) => (
								<Dropdown.Item
									key={status}
									id={status}
									textValue={getStageLabel(status)}
									onAction={() => bulkUpdate.mutate({ ids, status })}
								>
									<span
										aria-hidden="true"
										className="size-2 rounded-full"
										style={{ background: getStageColor(status) }}
									/>
									<Label>{getStageLabel(status)}</Label>
								</Dropdown.Item>
							))}
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>

				<Popover>
					<Button variant="ghost" size="sm">
						<Icon name="tag" />
						<span className="action-bar__label">
							<Trans>Add tag</Trans>
						</span>
					</Button>
					<Popover.Content placement="top start" className="w-60">
						<Popover.Dialog className="p-1">
							<form
								className="flex gap-1.5"
								onSubmit={(event) => {
									event.preventDefault();
									if (!tag.trim()) return;
									bulkUpdate.mutate({ ids, addTags: [tag.trim()] });
									setTag("");
								}}
							>
								<Input
									fullWidth
									aria-label={t`Tag`}
									value={tag}
									onChange={(event) => setTag(event.target.value)}
									autoFocus
								/>
								<Button size="sm" type="submit" isDisabled={!tag.trim()}>
									<Trans>Add</Trans>
								</Button>
							</form>
						</Popover.Dialog>
					</Popover.Content>
				</Popover>

				<Dropdown>
					<Button variant="ghost" size="sm">
						<Icon name="x-circle" />
						<span className="action-bar__label">
							<Trans>Close…</Trans>
						</span>
					</Button>
					<Dropdown.Popover placement="top start">
						<Dropdown.Menu>
							{CLOSED_REASONS.map((reason) => (
								<Dropdown.Item
									key={reason}
									id={reason}
									textValue={getClosedReasonLabel(reason)}
									onAction={() => bulkUpdate.mutate({ ids, status: "closed", closedReason: reason })}
								>
									<Label>{getClosedReasonLabel(reason)}</Label>
								</Dropdown.Item>
							))}
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>

				<Button
					size="sm"
					variant="ghost"
					className="text-danger"
					onPress={async () => {
						const confirmed = await confirm(
							plural(ids.length, { one: "Delete # application?", other: "Delete # applications?" }),
							{
								description: t`They and their timelines are deleted permanently. This can't be undone.`,
								confirmText: plural(ids.length, { one: "Delete # application", other: "Delete # applications" }),
							},
						);
						if (confirmed) bulkDelete.mutate({ ids });
					}}
				>
					<Icon name="trash" />
					<span className="action-bar__label">
						<Trans>Delete…</Trans>
					</span>
				</Button>
			</ActionBar.Content>

			<Separator orientation="vertical" className="h-5" />
			<ActionBar.Suffix>
				<Button isIconOnly size="sm" variant="ghost" aria-label={t`Clear selection`} onPress={onDone}>
					<Icon name="x" />
				</Button>
			</ActionBar.Suffix>
		</ActionBar>
	);
}
