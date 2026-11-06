import { EmptyState, Widget } from "@heroui-pro/react";
import { Button, buttonVariants, Chip, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { CreatePortfolioDialog } from "./create-dialog";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { WidgetHeading } from "@/components/layout/widget-heading";
import { CopyLinkButton } from "@/features/resume/share/copy-link-button";
import { useShareOrigin } from "@/features/resume/share/use-share-origin";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/libs/auth/client";
import { toastError } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

/**
 * Portfolio in the dashboard (`01-desain.md` section 8): a way in for an account without one, and the status card
 * (published or not, the address, Edit) for one that has it. Visitors and messages join in Phase 08, the domain in
 * Phase 09.
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
				<StatusCard />
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

function StatusCard() {
	const { data } = useQuery(orpc.portfolio.get.queryOptions());
	const { data: session } = authClient.useSession();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const origin = useShareOrigin();
	const portfolio = data?.portfolio;
	if (!portfolio) return null;
	const username = session?.user.username ?? "";
	const url = `${origin}/${encodeURIComponent(username)}`;

	const remove = async () => {
		const confirmed = await confirm(t`Delete your portfolio?`, {
			description: t`Its text, work, design and settings are deleted for good. Your resumes stay as they are.`,
			confirmText: t`Delete portfolio`,
			hold: true,
		});
		if (!confirmed) return;
		try {
			await client.portfolio.delete();
			await queryClient.invalidateQueries({ queryKey: orpc.portfolio.get.key() });
		} catch (error) {
			toastError(error, t`Couldn't delete your portfolio. Try again.`, { allowServerMessage: true });
		}
	};

	return (
		<Widget role="region" aria-labelledby="portfolio-status-title">
			<WidgetHeading
				id="portfolio-status-title"
				icon="globe-hemisphere-west"
				title={<Trans>Your portfolio</Trans>}
				action={
					portfolio.isPublic ? (
						<Chip size="sm" color="success" variant="soft">
							<Trans>Published</Trans>
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
				<p className="text-sm text-muted">
					{portfolio.isPublic ? (
						<Trans>Anyone with the link can see it. Visitor numbers are coming soon.</Trans>
					) : (
						<Trans>Only you can see it. Publish it from the editor when it's ready.</Trans>
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					<Link to="/builder/portfolio" className={buttonVariants({ variant: "primary" })}>
						<Icon name="pencil-simple" size={18} />
						<Trans>Edit portfolio</Trans>
					</Link>
					{portfolio.isPublic && (
						<a href={url} target="_blank" rel="noopener" className={buttonVariants({ variant: "secondary" })}>
							<Icon name="arrow-square-out" size={18} />
							<Trans>Open page</Trans>
						</a>
					)}
					<Button variant="ghost" className="text-danger" onPress={() => void remove()}>
						<Icon name="trash" size={18} />
						<Trans>Delete portfolio</Trans>
					</Button>
				</div>
			</Widget.Content>
		</Widget>
	);
}
