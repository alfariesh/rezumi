import { ProgressBar } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { usePortfolioEditorUi } from "../editor/ui";
import { orpc } from "@/libs/orpc/client";

const MEGABYTE = 1024 * 1024;

/** After an upload or a deleted upload: the meter reads the usage again. */
export const refreshPortfolioUsage = () => usePortfolioEditorUi.getState().noteUpload();

/** A storage size in the way the plan page and the limit messages count it. */
const formatSize = (bytes: number) => {
	const megabytes = bytes / MEGABYTE;
	return megabytes >= 1024
		? `${i18n.number(megabytes / 1024, { maximumFractionDigits: 1 })} GB`
		: `${i18n.number(Math.ceil(megabytes))} MB`;
};

/**
 * Pictures and PDFs stored for the portfolio against the plan's quota, the same numbers the server enforces (files
 * removed in the last day still count, until they're deleted).
 */
export function StorageMeter() {
	const queryClient = useQueryClient();
	const uploads = usePortfolioEditorUi((state) => state.uploads);
	const seen = useRef(uploads);
	useEffect(() => {
		if (seen.current === uploads) return;
		seen.current = uploads;
		// The editor keeps its own copy of the data, so reading it again never touches what's being typed.
		void queryClient.invalidateQueries({ queryKey: orpc.portfolio.get.queryKey() });
	}, [uploads, queryClient]);

	const { data } = useQuery({
		...orpc.portfolio.get.queryOptions({
			select: (result) => ({ used: result.usage.storageBytes, max: result.limits.storageBytes }),
		}),
		// Uploads made elsewhere in the editor (the intro, a client's logo) happen while this isn't on screen.
		refetchOnMount: "always",
	});
	if (!data) return null;
	const { used, max } = data;
	const size = formatSize(used);
	const total = formatSize(max);
	return (
		<ProgressBar
			aria-label={t`Storage for pictures and PDFs`}
			value={Math.min(used, max)}
			maxValue={Math.max(max, 1)}
			size="sm"
			color={used >= max ? "danger" : "default"}
			className="grid gap-1.5"
		>
			<span className="flex justify-between text-xs text-muted">
				<span>{t`Pictures and PDFs`}</span>
				<span>{t`${size} of ${total}`}</span>
			</span>
			<ProgressBar.Track>
				<ProgressBar.Fill />
			</ProgressBar.Track>
		</ProgressBar>
	);
}
