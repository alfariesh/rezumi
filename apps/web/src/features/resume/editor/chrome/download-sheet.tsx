import type { ReactNode } from "react";
import { Sheet } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "@/features/resume/editor/store";

/**
 * Download: every format, in a sheet 440px from the right (a full-height bottom sheet on phones), opened from the ▾
 * beside Download PDF. History lives in the panel.
 */
export function DownloadSheetFrame({ children }: { children: ReactNode }) {
	const open = useEditorStore((state) => state.sheetTab === "download");
	const setTab = useEditorStore((state) => state.setSheetTab);
	const isPhone = useBreakpoint() === "mobile";

	return (
		<Sheet isOpen={open} onOpenChange={(next) => !next && setTab(null)} placement={isPhone ? "bottom" : "right"}>
			<Sheet.Backdrop>
				<Sheet.Content className={cn(isPhone ? "h-[calc(100svh-1.5rem)]" : "w-full sm:max-w-[440px]")}>
					<Sheet.Dialog className="gap-0">
						{isPhone && <Sheet.Handle />}
						<Sheet.CloseTrigger aria-label={t`Close`} />
						<Sheet.Header className="px-5 pt-3.5 pb-2.5">
							<Sheet.Heading>
								<Trans>Download</Trans>
							</Sheet.Heading>
						</Sheet.Header>
						<Sheet.Body className="min-h-0 flex-1 overflow-y-auto p-5 pt-2">{children}</Sheet.Body>
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}
