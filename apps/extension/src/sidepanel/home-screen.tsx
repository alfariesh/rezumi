import type { RouterOutput } from "./api";
import { Button, Spinner } from "@heroui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { followUpDay, localDay } from "../shared/follow-ups";
import { askWorker, orpc } from "./api";
import { errorKind } from "./errors";
import { ExternalButton } from "./posting-screen";
import { SaveError } from "./save-error";
import { useStatusLabels } from "./status";

/**
 * 01-desain.md §3.2: the open tab is not a job posting. Follow-ups due today or earlier (each with "Done"), what to do
 * next and the five newest applications (each opens in Rezumi).
 */
export function HomeScreen() {
	const recent = useQuery(orpc.applications.listSummary.queryOptions({ input: { limit: 5 } }));
	const labels = useStatusLabels();

	return (
		<div className="flex flex-col gap-6">
			<DueList />

			<section className="flex flex-col items-center gap-y-4 px-2 pt-6 text-center">
				<span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-control text-muted">
					<Icon name="briefcase" size={24} />
				</span>
				<p className="text-sm text-balance text-muted">
					<Trans comment="Browser extension home screen when the open tab is not a job posting">
						Open a job posting to save it to Rezumi.
					</Trans>
				</p>
			</section>

			<section aria-labelledby="recent-heading" className="flex flex-col gap-2">
				<h2 id="recent-heading" className="text-xs font-semibold text-muted">
					<Trans comment="Browser extension home: the newest saved applications">Recently saved</Trans>
				</h2>
				{recent.isPending ? (
					<p role="status" className="flex items-center gap-2 text-sm text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						<Trans>Loading…</Trans>
					</p>
				) : recent.data?.length ? (
					<ul className="flex flex-col divide-y divide-separator rounded-2xl border border-separator">
						{recent.data.map((application) => (
							<li key={application.id}>
								<a
									href={rezumiLink(`/dashboard/applications/${application.id}`)}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-3 px-3 py-2.5 hover:bg-control focus-visible:outline-2 focus-visible:outline-focus"
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium">{application.role}</span>
										<span className="block truncate text-xs text-muted">{application.company}</span>
									</span>
									<span className="shrink-0 rounded-full bg-control px-2 py-0.5 text-xs">
										{labels[application.status]}
									</span>
								</a>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-muted">
						<Trans>Nothing saved yet.</Trans>
					</p>
				)}
			</section>

			<div className="flex justify-center">
				<ExternalButton href={rezumiLink("/dashboard/applications")}>
					<Trans comment="Button in the browser extension that opens the application tracker on the web">
						Open application tracker
					</Trans>
				</ExternalButton>
			</div>
		</div>
	);
}

type DueItem = RouterOutput["applications"]["dueFollowUps"]["items"][number];

/** "Today", "Yesterday", "3 days ago" for a follow-up day, in the panel's language. */
function dueLabel(at: Date | string, locale: string) {
	const days = Math.round(
		(Date.parse(`${followUpDay(at)}T00:00:00Z`) - Date.parse(`${localDay()}T00:00:00Z`)) / 86_400_000,
	);
	const text = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** 01-desain.md §3.2 "Due": nothing shows when nothing is due. "Done" clears the reminder. */
function DueList() {
	const due = useQuery(orpc.applications.dueFollowUps.queryOptions({ input: {} }));
	if (!due.data?.items.length) return null;
	const { items, total } = due.data;
	return (
		<section aria-labelledby="due-heading" className="flex flex-col gap-2">
			<h2 id="due-heading" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
				<Icon name="bell" size={14} aria-hidden />
				<Trans comment="Browser extension home: follow-ups due today or earlier">Due</Trans>
				<span className="rounded-full bg-danger px-1.5 text-[11px] leading-4 text-danger-foreground tabular-nums">
					{total}
				</span>
			</h2>
			<ul className="flex flex-col divide-y divide-separator rounded-2xl border border-separator">
				{items.slice(0, 10).map((item) => (
					<DueRow key={item.id} item={item} />
				))}
			</ul>
			{total > 10 ? (
				<a
					href={rezumiLink("/dashboard/applications")}
					target="_blank"
					rel="noreferrer"
					className="text-xs text-muted underline underline-offset-2"
				>
					<Trans>See all in Rezumi</Trans>
				</a>
			) : null}
		</section>
	);
}

function DueRow({ item }: { item: DueItem }) {
	const { t, i18n } = useLingui();
	const queryClient = useQueryClient();
	const done = useMutation(orpc.applications.update.mutationOptions());
	const finish = () =>
		done.mutate(
			{ id: item.id, followUpAt: null, followUpNote: null },
			{
				onSuccess: () => {
					void askWorker({ type: "follow-ups" });
					void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
				},
			},
		);
	return (
		<li className="flex flex-col gap-2 px-3 py-2.5">
			<div className="flex items-start gap-3">
				<a
					href={rezumiLink(`/dashboard/applications/${encodeURIComponent(item.id)}`)}
					target="_blank"
					rel="noreferrer"
					className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-focus"
				>
					<span className="block truncate text-sm font-medium">{item.role}</span>
					<span className="block truncate text-xs text-muted">
						{item.company} · {dueLabel(item.followUpAt, i18n.locale)}
					</span>
					{item.followUpNote ? (
						<span className="mt-0.5 block text-xs text-pretty text-muted">{item.followUpNote}</span>
					) : null}
				</a>
				<Button
					size="sm"
					variant="secondary"
					aria-label={t({ message: `Done: ${item.role}`, comment: "Clear a follow-up reminder" })}
					isPending={done.isPending}
					onPress={finish}
				>
					<Icon name="check" size={14} aria-hidden />
					<Trans comment="Browser extension: mark a follow-up reminder as done">Done</Trans>
				</Button>
			</div>
			{done.isError ? <SaveError kind={errorKind(done.error)} onRetry={finish} /> : null}
		</li>
	);
}
