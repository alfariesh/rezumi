import type { SheetTab } from "@/features/resume/editor/store";
import type { ReactNode } from "react";
import { Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@rezumi/ui/components/sheet";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "@/features/resume/editor/store";
import { useClosingValue } from "@/hooks/use-closing-value";

type DownloadSheetFrameProps = {
	tabs: { value: SheetTab; label: ReactNode; content: ReactNode }[];
	/** The tab shown when the open tab isn't one of `tabs`. */
	fallback: SheetTab;
};

/** Download & history: one sheet, 440px from the right; a full-height bottom sheet on phones. */
export function DownloadSheetFrame({ tabs, fallback }: DownloadSheetFrameProps) {
	const tab = useEditorStore((state) => state.sheetTab);
	// Closing keeps the open tab on screen until the sheet has slid away.
	const [shownTab, onOpenChangeComplete] = useClosingValue(tab);
	const setTab = useEditorStore((state) => state.setSheetTab);
	const isPhone = useBreakpoint() === "mobile";

	return (
		<Sheet
			open={tab !== null}
			onOpenChange={(open) => !open && setTab(null)}
			onOpenChangeComplete={onOpenChangeComplete}
		>
			<SheetContent
				side={isPhone ? "bottom" : "right"}
				closeLabel={t`Close`}
				className={cn("gap-0", isPhone && "h-[calc(100svh-1.5rem)]")}
			>
				<SheetHeader className="px-5 pt-3.5 pb-2.5">
					<SheetTitle>
						<Trans>Download & history</Trans>
					</SheetTitle>
				</SheetHeader>

				<Tabs
					selectedKey={tabs.find((item) => item.value === shownTab)?.value ?? fallback}
					onSelectionChange={(key) => {
						const value = String(key);
						// The page shows a version only while History is open.
						if (value !== "history") useEditorStore.setState({ historyVersionId: null });
						setTab(value as SheetTab);
					}}
					variant="secondary"
					className="min-h-0 flex-1 gap-0"
				>
					<Tabs.ListContainer className="px-5">
						<Tabs.List aria-label={t`Share sections`} className="w-full justify-start gap-5">
							{tabs.map((item) => (
								<Tabs.Tab key={item.value} id={item.value}>
									{item.label}
									<Tabs.Indicator />
								</Tabs.Tab>
							))}
						</Tabs.List>
					</Tabs.ListContainer>
					{tabs.map((item) => (
						<Tabs.Panel key={item.value} id={item.value} className="overflow-y-auto p-5">
							{item.content}
						</Tabs.Panel>
					))}
				</Tabs>
			</SheetContent>
		</Sheet>
	);
}
