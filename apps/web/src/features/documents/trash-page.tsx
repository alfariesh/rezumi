import { EmptyState } from "@heroui-pro/react";
import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { DocumentList } from "./document-list";
import { LibraryError } from "./library-error";
import { PageHeader } from "@/components/layout/page-header";
import { orpc } from "@/libs/orpc/client";

const noop = () => undefined;

/** Trash: documents stay 30 days, then go for good. Restore, or Delete now after one confirmation. */
export function TrashPage() {
	const {
		data: documents,
		isPending,
		isError,
		isFetching,
		refetch,
	} = useQuery(orpc.documents.list.queryOptions({ input: { trashed: true } }));

	return (
		<div className="mx-auto grid w-full max-w-[1180px] content-start gap-5 px-8 py-8 max-sm:px-4 max-sm:py-5">
			<PageHeader
				back={
					<Link
						to="/dashboard"
						className={buttonVariants({ variant: "ghost", size: "sm", className: "-ms-2.5 w-fit gap-1.5 text-muted" })}
					>
						<Icon name="arrow-left" size={18} />
						<Trans>Back to documents</Trans>
					</Link>
				}
				title={<Trans>Trash</Trans>}
				description={<Trans>Documents are deleted permanently after 30 days.</Trans>}
			/>

			{isError && <LibraryError retrying={isFetching} onRetry={() => void refetch()} />}

			{isError && !documents ? null : !isPending && documents?.length === 0 ? (
				<EmptyState className="py-16">
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="trash" size={22} />
						</EmptyState.Media>
						<EmptyState.Title>
							<Trans>Trash is empty</Trans>
						</EmptyState.Title>
						<EmptyState.Description className="max-w-xs text-pretty">
							<Trans>Documents you move here stay for 30 days.</Trans>
						</EmptyState.Description>
					</EmptyState.Header>
				</EmptyState>
			) : (
				<DocumentList documents={documents ?? []} label={t`Trash`} inTrash onTags={noop} onLink={noop} />
			)}
		</div>
	);
}
