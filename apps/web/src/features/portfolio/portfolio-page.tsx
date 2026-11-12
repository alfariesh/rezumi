import { EmptyState, Widget } from "@heroui-pro/react";
import { Button, buttonVariants, Chip, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { CreatePortfolioDialog } from "./create-dialog";
import { portfolioErrorMessage } from "./errors";
import { PortfolioMessages } from "./statistics/portfolio-messages";
import { PortfolioStatistics } from "./statistics/portfolio-statistics";
import { invalidatePortfolioQueries, isPortfolioLive } from "./status";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { CopyLinkButton } from "@/features/resume/share/copy-link-button";
import { CustomDomainField } from "@/features/resume/share/custom-domain-field";
import { useShareOrigin } from "@/features/resume/share/use-share-origin";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { client, orpc } from "@/libs/orpc/client";

/**
 * Portfolio in the dashboard (`01-desain.md` section 8): a way in for an account without one, and the status card
 * (published or not, the address, Edit) for one that has it, its own domain, then its visitors and messages.
 */
export function PortfolioPage() {
	const { data, isPending } = useQuery(orpc.portfolio.get.queryOptions());
	const [creating, setCreating] = useState(false);

	return (
		<Page>
			<PageHeader
				title={<Trans>Portfolio</Trans>}
				description={<Trans>A one-page website at your own address, made from your resume and your work.</Trans>}
			/>
			{isPending ? (
				<div className="grid place-items-center py-16">
					<Spinner size="md" color="current" />
				</div>
			) : data?.portfolio ? (
				<div className="grid gap-4">
					<StatusCard />
					<DomainCard />
					{/* Nothing to count or read before its first publication. */}
					{data.portfolio.publishedAt && (
						<>
							<PortfolioStatistics />
							<PortfolioMessages />
						</>
					)}
				</div>
			) : (
				<EmptyState className="py-16">
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="globe-hemisphere-west" size={22} />
						</EmptyState.Media>
						<EmptyState.Title>
							<Trans>Turn your resume into a portfolio website</Trans>
						</EmptyState.Title>
						<EmptyState.Description className="max-w-sm text-pretty">
							<Trans>
								Show your work, results and services on one page that looks good on any phone, at
								rezumi.app/your-username.
							</Trans>
						</EmptyState.Description>
					</EmptyState.Header>
					<EmptyState.Content>
						<Button onPress={() => setCreating(true)}>
							<Icon name="plus" size={18} />
							<Trans>Create portfolio</Trans>
						</Button>
					</EmptyState.Content>
				</EmptyState>
			)}
			{creating && <CreatePortfolioDialog onClose={() => setCreating(false)} />}
		</Page>
	);
}

function DomainCard() {
	const { flags } = useRouteContext({ strict: false });
	const titleId = useId();
	if (!flags?.customDomains) return null;
	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading id={titleId} icon="globe" title={<Trans>Your domain</Trans>} />
			<Widget.Content className="grid gap-4">
				<CustomDomainField suggest={flags.olacvSuggestion ?? false} />
			</Widget.Content>
		</Widget>
	);
}

function StatusCard() {
	const { data } = useQuery(orpc.portfolio.get.queryOptions());
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const origin = useShareOrigin();
	const titleId = useId();
	const [deleting, setDeleting] = useState(false);
	const portfolio = data?.portfolio;
	if (!portfolio) return null;
	const username = session?.user.username ?? "";
	const url = `${origin}/${encodeURIComponent(username)}`;
	const live = isPortfolioLive(portfolio);

	const remove = async () => {
		const confirmed = await confirm(t`Delete your portfolio?`, {
			description: t`Its text, work, design and settings are deleted for good. Your resumes stay as they are.`,
			confirmText: t`Delete portfolio`,
			hold: true,
		});
		if (!confirmed) return;
		setDeleting(true);
		try {
			await client.portfolio.delete();
			toast.add({ type: "success", description: t`Your portfolio was deleted.` });
		} catch (error) {
			toast.add({
				type: "error",
				description: portfolioErrorMessage(error, {
					fallback: t`Couldn't delete your portfolio. Try again.`,
					// Deleted in another tab meanwhile: the page catches up below.
					byCode: { NOT_FOUND: t`Your portfolio was already deleted.` },
				}),
			});
		} finally {
			await invalidatePortfolioQueries(queryClient);
			setDeleting(false);
		}
	};

	return (
		<Widget role="region" aria-labelledby={titleId}>
			<WidgetHeading
				id={titleId}
				icon="globe-hemisphere-west"
				title={<Trans>Your portfolio</Trans>}
				action={
					live ? (
						<Chip size="sm" color="success" variant="soft">
							<Trans>Published</Trans>
						</Chip>
					) : portfolio.suspendedAt ? (
						<Chip size="sm" color="danger" variant="soft">
							<Trans>Taken down</Trans>
						</Chip>
					) : (
						<Chip size="sm" variant="soft">
							<Trans>Not published</Trans>
						</Chip>
					)
				}
			/>
			<Widget.Content className="grid gap-4">
				<div className="flex min-w-0 items-center gap-1">
					<span dir="ltr" className="min-w-0 truncate font-mono text-sm">
						{url.replace(/^https?:\/\//, "")}
					</span>
					<CopyLinkButton url={url} />
				</div>
				<p className="text-body-sm text-muted">
					{live ? (
						<Trans>Anyone with the link can see it.</Trans>
					) : portfolio.suspendedAt ? (
						<Trans>It was taken down, so visitors can't see it. Open the editor to see why and how to appeal.</Trans>
					) : (
						<Trans>Only you can see it. Publish it from the editor when it's ready.</Trans>
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					<Link to="/builder/portfolio" className={buttonVariants({ variant: "primary" })}>
						<Icon name="pencil-simple" size={18} />
						<Trans>Edit portfolio</Trans>
					</Link>
					{live && (
						<a href={url} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
							<Icon name="arrow-square-out" size={18} />
							<Trans>Open page</Trans>
						</a>
					)}
					{!portfolio.suspendedAt && (
						<Button variant="ghost" className="text-danger" isPending={deleting} onPress={() => void remove()}>
							<Icon name="trash" size={18} />
							<Trans>Delete portfolio</Trans>
						</Button>
					)}
				</div>
			</Widget.Content>
		</Widget>
	);
}
