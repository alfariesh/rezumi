import type { ApplicationClosedReason } from "@rezumi/schema/applications/data";
import { Button, Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rezumi/ui/components/dialog";
import { CLOSED_REASONS, getClosedReasonLabel } from "../../stages";

type CloseDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onClose: (reason: ApplicationClosedReason) => void;
};

/** "Close this application": one reason, kept for Insights. It replaces Reject, Archive and Delete buttons. */
export function CloseDialog({ open, onOpenChange, onClose }: CloseDialogProps) {
	const [reason, setReason] = useState<ApplicationClosedReason>("not-selected");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>
						<Trans>Close this application</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>The reason is kept for Insights. Linked documents aren't touched.</Trans>
					</DialogDescription>
				</DialogHeader>
				<RadioGroup
					aria-label={t`Reason`}
					value={reason}
					onChange={(value) => setReason(value as ApplicationClosedReason)}
					className="grid gap-1"
				>
					{CLOSED_REASONS.map((value) => (
						<Radio
							key={value}
							value={value}
							className="flex h-10 items-center rounded-lg px-2 transition-colors hover:bg-hover"
						>
							<Radio.Content className="flex-1 text-sm">
								<Radio.Control>
									<Radio.Indicator />
								</Radio.Control>
								{getClosedReasonLabel(value)}
							</Radio.Content>
						</Radio>
					))}
				</RadioGroup>
				<DialogFooter>
					<Button variant="secondary" onPress={() => onOpenChange(false)}>
						<Trans>Cancel</Trans>
					</Button>
					<Button
						onPress={() => {
							onClose(reason);
							onOpenChange(false);
						}}
					>
						<Trans>Close application</Trans>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
