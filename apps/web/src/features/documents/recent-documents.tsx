import { Widget } from "@heroui-pro/react";
import { Button, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { OpenLink } from "./document-card";
import { RowIcon } from "@/components/layout/icon-row";
import { WidgetAction, WidgetHeading, widgetActionClass } from "@/components/layout/widget-heading";
import { useDialogStore } from "@/dialogs/store";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";

/** How many documents Home lists: enough to pick up where you left off, short enough to stay a side column. */
const LIMIT = 4;

type RecentDocumentsProps = { className?: string | undefined };

/**
 * Home's shortcut back into the editor: the documents edited last, newest first, each opening its editor. The full
 * library, with search, tags and sorting, stays in Documents.
 */
export function RecentDocuments({ className }: RecentDocumentsProps) {
	const { i18n } = useLingui();
	const titleId = useId();
	const openDialog = useDialogStore((state) => state.openDialog);
	const { data, isError, isFetching, refetch } = useQuery(
		orpc.documents.list.queryOptions({ input: { trashed: false } }),
	);
	const recent = data?.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, LIMIT);

	return (
		<Widget role="region" aria-labelledby={titleId} className={className}>
			<WidgetHeading
				id={titleId}
				icon="file-text"
				title={<Trans>Recent documents</Trans>}
				action={
					recent?.length ? (
						<Link to="/dashboard/documents" className={widgetActionClass}>
							<Trans>All documents</Trans>
						</Link>
					) : recent ? (
						<WidgetAction onPress={() => openDialog("document.new", undefined)}>
							<Icon name="plus" size={16} />
							<Trans>New document</Trans>
						</WidgetAction>
					) : undefined
				}
			/>
			<Widget.Content className="grid gap-1 p-2">
				{isError && !data ? (
					<div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5">
						<p className="text-sm text-muted">
							<Trans>Couldn't load documents</Trans>
						</p>
						<Button size="sm" variant="secondary" isDisabled={isFetching} onPress={() => void refetch()}>
							<Trans>Retry</Trans>
						</Button>
					</div>
				) : !recent ? (
					<div role="status" className="grid gap-1">
						<span className="sr-only">{t`Loading`}</span>
						{[0, 1, 2].map((key) => (
							<div key={key} className="flex items-center gap-3 px-2 py-2">
								<Skeleton className="size-10 shrink-0 rounded-xl" />
								<div className="grid flex-1 gap-2">
									<Skeleton className="h-4 w-3/5 rounded-md" />
									<Skeleton className="h-3 w-2/5 rounded-md" />
								</div>
							</div>
						))}
					</div>
				) : recent.length === 0 ? (
					<p className="px-2 py-1.5 text-sm text-muted">
						<Trans>No documents yet.</Trans>
					</p>
				) : (
					recent.map((document) => (
						<OpenLink
							key={document.id}
							document={document}
							className={cn(
								"flex items-center gap-3 rounded-xl px-2 py-2 text-foreground no-underline transition-colors duration-quick hover:bg-default",
								"focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
							)}
						>
							<RowIcon>
								<Icon name={document.type === "resume" ? "file-text" : "envelope-simple"} size={20} />
							</RowIcon>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate text-sm font-medium">{document.name}</span>
								<span className="truncate text-xs text-muted">
									{document.type === "resume" ? t`Resume` : t`Cover letter`}
									{" · "}
									{formatRelativeTime(document.updatedAt, i18n.locale)}
								</span>
							</span>
						</OpenLink>
					))
				)}
			</Widget.Content>
		</Widget>
	);
}
