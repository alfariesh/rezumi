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
import { LetterThumbnail, OpenLink } from "./document-card";
import { ResumeThumbnail } from "./resume-thumbnail";
import { WidgetHeading, widgetActionClass } from "@/components/layout/widget-heading";
import { useDialogStore } from "@/dialogs/store";
import { formatRelativeTime } from "@/libs/locale";
import { orpc } from "@/libs/orpc/client";

/** How many documents Home previews, before the tile that starts a new one. */
const LIMIT = 3;

/**
 * The row of previews: a strip to swipe that runs to the widget's edges, so the next card peeks, and four equal
 * columns once there's room. The 4px of vertical padding keeps the previews' rings from being clipped by the scroll.
 */
const ROW =
	"-mx-4 -my-1 flex snap-x scroll-px-4 gap-5 overflow-x-auto px-4 py-1 [scrollbar-width:none] @2xl:mx-0 @2xl:grid @2xl:grid-cols-4 @2xl:overflow-visible @2xl:px-0";
const ITEM = "w-36 shrink-0 snap-start @2xl:w-auto";
/** The whole first page, at the page's own ratio. */
const FRAME = "relative block aspect-page overflow-hidden rounded-lg bg-white ring-1 ring-separator";

type RecentDocumentsProps = { className?: string | undefined };

/**
 * Home's way back into the editor: the first page of the documents edited last, newest first, each opening its editor,
 * and a tile to start a new one. The full library, with search, tags and sorting, stays in Documents.
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
		<Widget role="region" aria-labelledby={titleId} className={cn(className)}>
			<WidgetHeading
				id={titleId}
				icon="file-text"
				title={<Trans>Recent documents</Trans>}
				action={
					recent?.length ? (
						<Link to="/dashboard/documents" className={widgetActionClass}>
							<Trans>All documents</Trans>
						</Link>
					) : undefined
				}
			/>
			<Widget.Content className="@container p-4">
				{isError && !data ? (
					<div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1.5">
						<p className="text-sm text-muted">
							<Trans>Couldn't load documents</Trans>
						</p>
						<Button size="sm" variant="secondary" isDisabled={isFetching} onPress={() => void refetch()}>
							<Trans>Retry</Trans>
						</Button>
					</div>
				) : !recent ? (
					<div role="status" className={ROW}>
						<span className="sr-only">{t`Loading`}</span>
						{Array.from({ length: LIMIT + 1 }, (_, key) => (
							<div key={key} className={cn(ITEM, "grid content-start gap-2")}>
								<Skeleton className="aspect-page rounded-lg" />
								<Skeleton className="h-4 w-3/5 rounded-md" />
								<Skeleton className="h-3 w-2/5 rounded-md" />
							</div>
						))}
					</div>
				) : (
					<div className={ROW}>
						{recent.map((document) => (
							<OpenLink
								key={document.id}
								document={document}
								className={cn(
									ITEM,
									"group/preview grid min-w-0 content-start gap-2 rounded-xl text-foreground no-underline",
									"focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
								)}
							>
								<span
									className={cn(
										FRAME,
										"transition-[scale] duration-quick ease-enter group-hover/preview:ring-accent group-active/preview:scale-[0.98]",
									)}
								>
									{document.type === "resume" ? (
										<ResumeThumbnail resume={document} />
									) : (
										<LetterThumbnail name={document.name} />
									)}
								</span>
								<span className="grid min-w-0 gap-0.5 px-0.5">
									<span className="truncate text-sm font-medium">{document.name}</span>
									<span className="truncate text-xs text-muted">
										{document.type === "resume" ? t`Resume` : t`Cover letter`}
										{" · "}
										{formatRelativeTime(document.updatedAt, i18n.locale)}
									</span>
								</span>
							</OpenLink>
						))}
						<button
							type="button"
							onClick={() => openDialog("document.new", undefined)}
							className={cn(
								ITEM,
								"group/new grid min-w-0 content-start gap-2 rounded-xl text-start text-foreground",
								"focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none",
							)}
						>
							<span
								className={cn(
									"grid aspect-page place-items-center rounded-lg bg-control text-muted transition-colors duration-quick group-hover/new:bg-default group-hover/new:text-foreground",
								)}
							>
								<Icon name="plus" size={24} />
							</span>
							<span className="px-0.5 text-sm font-medium">
								<Trans>New document</Trans>
							</span>
						</button>
					</div>
				)}
			</Widget.Content>
		</Widget>
	);
}
