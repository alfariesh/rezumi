import type { RouterOutput } from "@/libs/orpc/client";
import type { PortfolioReportStatus } from "@rezumi/schema/portfolio/moderation";
import { Button, buttonVariants, Chip, Spinner, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import {
	formatModerationTime,
	moderationActionLabel,
	reportReasonLabel,
	reportStatusColor,
	reportStatusLabel,
} from "./labels";
import { AdminCard } from "@/features/billing/admin/parts";
import { ReasonDialog } from "@/features/billing/admin/reason-dialog";
import { useOwnOrigins } from "@/features/portfolio/editor/pictures";
import { renderPortfolioPreview } from "@/features/portfolio/editor/preview";
import { portfolioErrorMessage } from "@/features/portfolio/errors";
import { client, orpc } from "@/libs/orpc/client";
import { renderAsH1 } from "@/libs/typography";

type Review = RouterOutput["portfolio"]["admin"]["get"];

type PendingAction =
	| { kind: "suspend" | "lift" | "ban" | "unban" }
	| { kind: "report"; reportId: string; status: PortfolioReportStatus };

/** The portfolio as visitors would see it, drawn in the browser so a taken-down portfolio can still be reviewed. */
function ReviewPreview({ review }: { review: Review }) {
	const origins = useOwnOrigins();
	const [document, setDocument] = useState<string | null>(null);
	// The review whose preview couldn't be drawn: a newer one (after an action) tries again.
	const [failedFor, setFailedFor] = useState<Review | null>(null);
	const failed = failedFor === review;

	useEffect(() => {
		let current = true;
		void renderPortfolioPreview({
			data: review.data,
			resume: review.resumeData,
			owner: { name: review.ownerName, username: review.username },
			links: { resume: false, resumePdf: false },
			origins,
			canHideCredit: true,
		})
			.then((html) => {
				if (current) setDocument(html);
			})
			.catch((error: unknown) => {
				console.error("Portfolio review preview failed", error);
				if (current) setFailedFor(review);
			});
		return () => {
			current = false;
		};
	}, [review, origins]);

	if (failed)
		return (
			<p className="text-body-sm text-danger" role="alert">
				<Trans>The preview couldn't be drawn. Reload the page to try again.</Trans>
			</p>
		);
	if (!document) return <Spinner size="sm" />;
	return (
		<iframe
			title={t`Portfolio preview`}
			srcDoc={document}
			// The page's own styles and pictures only: nothing in it runs, and it can't reach this page.
			sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
			className="h-[70vh] w-full rounded-xl border border-separator bg-white"
		/>
	);
}

type ActionDialogProps = {
	/** The last action asked for: it stays while the dialog closes, so the title doesn't change on the way out. */
	action: PendingAction | null;
	isOpen: boolean;
	onClose: () => void;
	review: Review;
};

/** Every moderation action asks why. The reason for a takedown is shown to the owner, so the dialog says so. */
function ActionDialog({ action, isOpen, onClose, review }: ActionDialogProps) {
	const queryClient = useQueryClient();
	const portfolioId = review.id;

	const send = async (reason: string) => {
		if (!action) return;
		if (action.kind === "suspend") await client.portfolio.admin.suspend({ portfolioId, reason });
		if (action.kind === "lift") await client.portfolio.admin.lift({ portfolioId, reason });
		if (action.kind === "ban") await client.portfolio.admin.setBanned({ portfolioId, banned: true, reason });
		if (action.kind === "unban") await client.portfolio.admin.setBanned({ portfolioId, banned: false, reason });
		if (action.kind === "report")
			await client.portfolio.admin.setReportStatus({ reportId: action.reportId, status: action.status, reason });
	};

	const run = async (reason: string) => {
		try {
			await send(reason);
		} finally {
			// A conflict means someone else changed it meanwhile: either way the page shows what's true now.
			await queryClient.invalidateQueries({ queryKey: orpc.portfolio.admin.key() });
		}
	};

	// In this feature's words, never the server's English.
	const describeError = (error: unknown) =>
		portfolioErrorMessage(error, {
			fallback: t`That didn't work. Reload the page and try again.`,
			byCode:
				action?.kind === "report"
					? {
							NOT_FOUND: t`This report doesn't exist anymore. Reload the page.`,
							PORTFOLIO_MODERATION_CONFLICT: t`This report already has that status. Reload the page to see what changed.`,
						}
					: { NOT_FOUND: t`This portfolio doesn't exist anymore. Its owner may have deleted it.` },
		});

	const title = {
		suspend: <Trans>Take this portfolio down?</Trans>,
		lift: <Trans>Lift the takedown?</Trans>,
		ban: <Trans>Ban this account?</Trans>,
		unban: <Trans>Lift the account ban?</Trans>,
		report: <Trans>Change this report's status?</Trans>,
	}[action?.kind ?? "report"];

	const description = {
		suspend: (
			<Trans>
				Visitors stop seeing it right away; nothing is deleted. The owner reads this reason in their editor, so don't
				mention who reported it.
			</Trans>
		),
		lift: <Trans>It shows again if the owner still has it published.</Trans>,
		ban: (
			<Trans>
				The owner is signed out, and all of their public pages and pictures stop being available. Use this for an
				account that's a problem as a whole.
			</Trans>
		),
		unban: <Trans>The owner can sign in again, and their public pages come back.</Trans>,
		report: <Trans>This only changes the report, not the portfolio.</Trans>,
	}[action?.kind ?? "report"];

	return (
		<ReasonDialog
			isOpen={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={title}
			description={description}
			danger={action?.kind === "suspend" || action?.kind === "ban"}
			submitLabel={<Trans>Confirm</Trans>}
			onSubmit={run}
			describeError={describeError}
		/>
	);
}

type PortfolioReviewPageProps = {
	portfolioId: string;
	/** The reports list's filter this page was opened from; "All reports" goes back to it. */
	from?: PortfolioReportStatus | "all" | undefined;
};

/** One portfolio under review: what it shows, the reports about it, what's been done, and the actions. */
export function PortfolioReviewPage({ portfolioId, from }: PortfolioReviewPageProps) {
	const query = useQuery(orpc.portfolio.admin.get.queryOptions({ input: { portfolioId } }));
	const [action, setPendingAction] = useState<PendingAction | null>(null);
	const [actionOpen, setActionOpen] = useState(false);
	const setAction = (next: PendingAction) => {
		setPendingAction(next);
		setActionOpen(true);
	};

	if (query.isPending) return <Spinner size="sm" />;
	if (query.isError)
		return (
			<p className="text-body-sm text-danger" role="alert">
				{portfolioErrorMessage(query.error, { fallback: t`Couldn't load this portfolio. Try again.` })}
			</p>
		);

	const review = query.data;
	const live = review.isPublic && !review.suspendedAt && !review.ownerBanned;
	const canBan = review.ownerRole !== "admin";

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div className="grid min-w-0 gap-1">
					<Link
						to="/dashboard/admin/portfolios"
						search={from ? { status: from } : {}}
						className="text-sm text-muted hover:underline"
					>
						<Trans>All reports</Trans>
					</Link>
					<Typography type="h2" render={renderAsH1}>
						@{review.username}
					</Typography>
					<p className="text-body-sm text-muted">
						{review.ownerName} · {review.ownerEmail}
					</p>
					<div className="flex flex-wrap gap-2">
						{review.suspendedAt ? (
							<Chip size="sm" color="danger" variant="soft">
								<Chip.Label>
									<Trans>Taken down</Trans>
								</Chip.Label>
							</Chip>
						) : (
							<Chip size="sm" variant="soft" color={live ? "success" : "default"}>
								<Chip.Label>{live ? <Trans>Published</Trans> : <Trans>Not published</Trans>}</Chip.Label>
							</Chip>
						)}
						{review.ownerBanned && (
							<Chip size="sm" color="danger" variant="soft">
								<Chip.Label>
									<Trans>Account banned</Trans>
								</Chip.Label>
							</Chip>
						)}
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{live && (
						<a
							href={`/${encodeURIComponent(review.username)}`}
							target="_blank"
							rel="noopener"
							className={buttonVariants({ variant: "secondary" })}
						>
							<Icon name="arrow-square-out" size={18} />
							<Trans>Open page</Trans>
						</a>
					)}
					<Link
						to="/dashboard/admin/billing/$userId"
						params={{ userId: review.ownerId }}
						className={buttonVariants({ variant: "secondary" })}
					>
						<Trans>Account</Trans>
					</Link>
					{review.suspendedAt ? (
						<Button variant="primary" onPress={() => setAction({ kind: "lift" })}>
							<Trans>Lift takedown</Trans>
						</Button>
					) : (
						<Button variant="danger" onPress={() => setAction({ kind: "suspend" })}>
							<Trans>Take down</Trans>
						</Button>
					)}
					{canBan &&
						(review.ownerBanned ? (
							<Button variant="secondary" onPress={() => setAction({ kind: "unban" })}>
								<Trans>Lift ban</Trans>
							</Button>
						) : (
							<Button variant="ghost" className="text-danger" onPress={() => setAction({ kind: "ban" })}>
								<Trans>Ban account</Trans>
							</Button>
						))}
				</div>
			</header>

			{review.suspendedAt && review.suspendedReason && (
				<AdminCard
					icon="warning"
					title={<Trans>Takedown reason</Trans>}
					description={formatModerationTime(review.suspendedAt)}
				>
					<p className="text-body-sm whitespace-pre-wrap">{review.suspendedReason}</p>
				</AdminCard>
			)}

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<AdminCard icon="eye" title={<Trans>Portfolio</Trans>} description={<Trans>As visitors would see it.</Trans>}>
					<ReviewPreview review={review} />
				</AdminCard>

				<div className="flex flex-col gap-4">
					<AdminCard icon="warning-circle" title={<Trans>Reports</Trans>}>
						{review.reports.length === 0 ? (
							<p className="text-body-sm text-muted">
								<Trans>No reports about this portfolio.</Trans>
							</p>
						) : (
							<ul className="grid gap-3">
								{review.reports.map((report) => (
									<li key={report.id} className="grid gap-2 rounded-xl bg-surface-secondary p-3 text-sm">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="font-medium">{reportReasonLabel(report.reason)}</span>
											<Chip size="sm" variant="soft" color={reportStatusColor(report.status)}>
												<Chip.Label>{reportStatusLabel(report.status)}</Chip.Label>
											</Chip>
										</div>
										<p className="break-words whitespace-pre-wrap">{report.details}</p>
										<p className="text-body-xs text-muted">
											{formatModerationTime(report.createdAt)}
											{report.reporterEmail ? ` · ${report.reporterEmail}` : ""}
										</p>
										<div className="flex flex-wrap gap-2">
											{report.status !== "dismissed" && (
												<Button
													size="sm"
													variant="tertiary"
													onPress={() => setAction({ kind: "report", reportId: report.id, status: "dismissed" })}
												>
													<Trans>Dismiss</Trans>
												</Button>
											)}
											{report.status !== "open" && (
												<Button
													size="sm"
													variant="tertiary"
													onPress={() => setAction({ kind: "report", reportId: report.id, status: "open" })}
												>
													<Trans>Reopen</Trans>
												</Button>
											)}
										</div>
									</li>
								))}
							</ul>
						)}
					</AdminCard>

					<AdminCard icon="clock-counter-clockwise" title={<Trans>History</Trans>}>
						{review.history.length === 0 ? (
							<p className="text-body-sm text-muted">
								<Trans>Nothing has been done yet.</Trans>
							</p>
						) : (
							<ul className="grid gap-2 text-sm">
								{review.history.map((entry) => (
									<li key={entry.id} className="grid gap-0.5">
										<span>
											{moderationActionLabel(entry.action)}
											{entry.actorName ? ` · ${entry.actorName}` : ""}
										</span>
										{entry.reason && <span className="text-muted">{entry.reason}</span>}
										<span className="text-xs text-muted">{formatModerationTime(entry.createdAt)}</span>
									</li>
								))}
							</ul>
						)}
					</AdminCard>
				</div>
			</div>

			<ActionDialog action={action} isOpen={actionOpen} onClose={() => setActionOpen(false)} review={review} />
		</div>
	);
}
