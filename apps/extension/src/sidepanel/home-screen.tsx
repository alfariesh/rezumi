import { Spinner } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { rezumiLink } from "../shared/config";
import { orpc } from "./api";
import { ExternalButton } from "./posting-screen";
import { useStatusLabels } from "./status";

/**
 * 01-desain.md §3.2: the open tab is not a job posting. What to do next and the five newest applications (each opens
 * in Rezumi). The "due" list joins in Phase 05.
 */
export function HomeScreen() {
	const recent = useQuery(orpc.applications.listSummary.queryOptions({ input: { limit: 5 } }));
	const labels = useStatusLabels();

	return (
		<div className="flex flex-col gap-6">
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
