import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { EmptyState } from "@heroui-pro/react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/**
 * - `page`: a page or list with nothing in it yet. An icon, a title naming what goes here, one sentence on what it's
 *   for, and the action that adds the first one.
 * - `filtered`: a search or filter that matched nothing. Say what was searched, and offer to clear it.
 * - `inline`: a small part of a page (a widget, a card, a sheet) with nothing to show. One line, an optional link, no
 *   big icon.
 */
export type EmptyBlockKind = "page" | "filtered" | "inline";

type EmptyBlockProps = {
	kind: EmptyBlockKind;
	/** `page` needs one; `filtered` defaults to the magnifying glass; `inline` has none. */
	icon?: IconName;
	/**
	 * In place of the icon, for the few places with a picture of their own: a chat's start screen shows the coach's
	 * orb, as the editors' assistant does.
	 */
	media?: ReactNode;
	title: ReactNode;
	/** One sentence, ending with a full stop. */
	description?: ReactNode;
	/** The buttons: one primary action for `page`, "Clear filters" for `filtered`, a small link for `inline`. */
	action?: ReactNode;
	className?: string;
};

/**
 * The one empty state the web app uses. Every empty list, search and widget goes through it, so they look and read
 * the same; import HeroUI's `EmptyState` only here (a lint rule enforces it).
 */
export function EmptyBlock({ kind, icon, media: picture, title, description, action, className }: EmptyBlockProps) {
	if (kind === "inline")
		return (
			<div
				className={cn(
					"flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-dashed border-border px-4 py-3.5",
					className,
				)}
			>
				<div className="grid min-w-0 gap-0.5">
					<p className="text-sm font-medium">{title}</p>
					{description && <p className="text-body-sm text-pretty text-muted">{description}</p>}
				</div>
				{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
			</div>
		);

	const media = icon ?? (kind === "filtered" ? "magnifying-glass" : undefined);

	return (
		<EmptyState className={cn(kind === "page" ? "py-16" : "py-12", className)}>
			<EmptyState.Header>
				{picture ? (
					<EmptyState.Media>{picture}</EmptyState.Media>
				) : (
					media && (
						<EmptyState.Media variant="icon">
							<Icon name={media} size={22} />
						</EmptyState.Media>
					)
				)}
				<EmptyState.Title>{title}</EmptyState.Title>
				{description && <EmptyState.Description className="max-w-sm text-pretty">{description}</EmptyState.Description>}
			</EmptyState.Header>
			{action && <EmptyState.Content className="flex flex-wrap justify-center gap-2">{action}</EmptyState.Content>}
		</EmptyState>
	);
}
