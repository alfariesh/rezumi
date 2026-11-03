import { Alert, Button, Skeleton } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Fragment } from "react";
import { cn } from "@rezumi/utils/style";
import { RowSeparator } from "@/components/layout/icon-row";

type CareerLoadErrorProps = { onRetry: () => void };

export function CareerLoadError({ onRetry }: CareerLoadErrorProps) {
	return (
		<Alert status="danger" role="alert" className="items-center">
			<Alert.Indicator className="shrink-0" />
			<Alert.Content>
				<Alert.Description>
					<Trans>Couldn't load this. Your saved data hasn't changed.</Trans>
				</Alert.Description>
			</Alert.Content>
			<Button variant="secondary" size="sm" onPress={onRetry}>
				<Trans>Try again</Trans>
			</Button>
		</Alert>
	);
}

type RowsSkeletonProps = { rows?: number };

/**
 * List rows while they load, in the shape `RowIcon` rows share: the 40px tile, a title line and two muted lines,
 * 12px apart with the rule under the text (`RowSeparator`).
 */
export function RowsSkeleton({ rows = 2 }: RowsSkeletonProps) {
	return (
		<div role="status" className="grid">
			<span className="sr-only">{t`Loading`}</span>
			{Array.from({ length: rows }, (_, index) => (
				<Fragment key={index}>
					{index > 0 && <RowSeparator />}
					<div className={cn("flex items-start gap-3", index > 0 && "pt-3", index < rows - 1 && "pb-3")}>
						<Skeleton className="size-10 shrink-0 rounded-xl" />
						<div className="grid flex-1 gap-2 pt-0.5">
							<Skeleton className="h-4 w-2/5 rounded-md" />
							<Skeleton className="h-3.5 w-4/5 rounded-md" />
							<Skeleton className="h-3 w-1/4 rounded-md" />
						</div>
					</div>
				</Fragment>
			))}
		</div>
	);
}
