import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { DocumentList } from "./document-list";
import { LibraryError } from "./library-error";
import { EmptyBlock } from "@/components/layout/empty-block";
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
		<>
			<PageHeader
				title={<Trans>Trash</Trans>}
				description={<Trans>Documents are deleted permanently after 30 days.</Trans>}
			/>

			{isError && <LibraryError retrying={isFetching} onRetry={() => void refetch()} />}

			{isError && !documents ? null : !isPending && documents?.length === 0 ? (
				<EmptyBlock
					kind="page"
					icon="trash"
					title={<Trans>Trash is empty</Trans>}
					description={<Trans>Documents you move here stay for 30 days.</Trans>}
				/>
			) : (
				<DocumentList documents={documents ?? []} label={t`Trash`} inTrash onTags={noop} onLink={noop} />
			)}
		</>
	);
}
