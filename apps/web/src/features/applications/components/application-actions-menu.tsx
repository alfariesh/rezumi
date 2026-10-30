import type { ApplicationSummary } from "../types";
import { Dropdown, Label, Separator } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { CLOSED_REASONS, getClosedReasonLabel, getStageColor, getStageLabel, PIPELINE } from "../stages";
import { useApplicationActions } from "../use-application-actions";
import { useConfirm } from "@/hooks/use-confirm";

// Keep pointer and clicks from reaching the card, which would start a drag or open the detail sheet. React portals
// bubble synthetic events through the React tree, so a menu item's click would otherwise reach the card.
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

type ApplicationActionsMenuProps = { application: ApplicationSummary; className?: string };

/** A card's ⋯ menu, the keyboard alternative to dragging: Move to…, Close…, and Delete after asking. */
export function ApplicationActionsMenu({ application, className }: ApplicationActionsMenuProps) {
	const { moveTo, close, remove } = useApplicationActions();
	const confirm = useConfirm();

	const onDelete = async () => {
		const confirmed = await confirm(t`Delete this application?`, {
			description: t`“${application.role} · ${application.company}” and its timeline are deleted permanently. This can't be undone.`,
			confirmText: t`Delete application`,
		});
		if (confirmed) remove.mutate({ id: application.id });
	};

	return (
		// The wrapper keeps pointer and clicks bubbling through the React portal away from the card, which would
		// start a drag or open the detail sheet.
		<div role="presentation" className={cn("shrink-0", className)} onClick={stop} onPointerDown={stop}>
			<Dropdown>
				<IconButton
					icon="dots-three"
					iconSize={18}
					size="sm"
					label={t`Options for ${application.role} at ${application.company}`}
				/>
				<Dropdown.Popover placement="bottom end" className="min-w-48">
					<Dropdown.Menu>
						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="move" textValue={t`Move to…`}>
								<Icon name="arrow-right" size={18} />
								<Label>
									<Trans>Move to…</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover>
								<Dropdown.Menu>
									{PIPELINE.map((status) => (
										<Dropdown.Item
											key={status}
											id={status}
											textValue={getStageLabel(status)}
											isDisabled={status === application.status}
											onAction={() => moveTo(application, status)}
										>
											<span
												aria-hidden="true"
												className="size-2 rounded-sm"
												style={{ background: getStageColor(status) }}
											/>
											<Label>{getStageLabel(status)}</Label>
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>

						<Dropdown.SubmenuTrigger>
							<Dropdown.Item id="close" textValue={t`Close…`}>
								<Icon name="check" size={18} />
								<Label>
									<Trans>Close…</Trans>
								</Label>
								<Dropdown.SubmenuIndicator />
							</Dropdown.Item>
							<Dropdown.Popover>
								<Dropdown.Menu>
									{CLOSED_REASONS.map((reason) => (
										<Dropdown.Item
											key={reason}
											id={reason}
											textValue={getClosedReasonLabel(reason)}
											onAction={() => close(application, reason)}
										>
											<Label>{getClosedReasonLabel(reason)}</Label>
										</Dropdown.Item>
									))}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown.SubmenuTrigger>

						<Separator />

						<Dropdown.Item id="delete" textValue={t`Delete…`} variant="danger" onAction={onDelete}>
							<Icon name="trash" size={18} />
							<Label>
								<Trans>Delete…</Trans>
							</Label>
						</Dropdown.Item>
					</Dropdown.Menu>
				</Dropdown.Popover>
			</Dropdown>
		</div>
	);
}
