import type { ApplicationClosedReason } from "@rezumi/schema/applications/data";
import { Button, Modal, Radio, RadioGroup } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { CLOSED_REASONS, getClosedReasonLabel } from "../../stages";

type CloseDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onClose: (reason: ApplicationClosedReason) => void;
};

/** "Close this application": one reason, kept for Insights. It replaces Reject, Archive and Delete buttons. */
export function CloseDialog({ open, onOpenChange, onClose }: CloseDialogProps) {
	const descriptionId = useId();
	const [reason, setReason] = useState<ApplicationClosedReason>("not-selected");

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size="sm">
				<Modal.Dialog aria-describedby={descriptionId}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							<Trans>Close this application</Trans>
						</Modal.Heading>
						<p id={descriptionId} className="text-sm text-muted">
							<Trans>The reason is kept for Insights. Linked documents aren't touched.</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="p-1">
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
					</Modal.Body>
					<Modal.Footer>
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
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
