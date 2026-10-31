import type { RouterOutput } from "@/libs/orpc/client";
import { Button, Modal, Spinner, Table } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useId } from "react";
import { formatTimeSince } from "@rezumi/resume/sharing";
import { CopyText } from "./copy-text";

type DnsRecordsDialogProps = {
	domain: NonNullable<RouterOutput["customDomain"]["get"]>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	checking: boolean;
	onCheck: () => void;
};

/** The records that connect a custom domain, each name and value copied with a click, and the DNS check. */
export function DnsRecordsDialog({ domain, open, onOpenChange, checking, onCheck }: DnsRecordsDialogProps) {
	const { i18n } = useLingui();
	const descriptionId = useId();
	const hasCname = domain.records.some((record) => record.type === "CNAME");
	const lastChecked = domain.lastCheckedAt ? formatTimeSince(domain.lastCheckedAt, i18n.locale) : null;

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size="lg">
				<Modal.Dialog aria-describedby={descriptionId} className="sm:max-w-[680px]">
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							<Trans>Connect {domain.hostname}</Trans>
						</Modal.Heading>
						<p id={descriptionId} className="text-sm text-muted">
							<Trans>
								Add these records where you manage the domain, then check. Changes can take a few hours to reach
								everyone.
							</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="space-y-4">
						<Table variant="secondary">
							<Table.ScrollContainer>
								<Table.Content aria-label={t`DNS records`} dir="ltr" className="text-sm">
									<Table.Header>
										<Table.Column className="w-16">
											<Trans context="DNS record">Type</Trans>
										</Table.Column>
										<Table.Column isRowHeader>
											<Trans context="DNS record">Name</Trans>
										</Table.Column>
										<Table.Column>
											<Trans>Value</Trans>
										</Table.Column>
									</Table.Header>
									<Table.Body>
										{domain.records.map((record) => (
											<Table.Row key={`${record.type}-${record.value}`} id={`${record.type}-${record.value}`}>
												<Table.Cell className="align-top font-medium">{record.type}</Table.Cell>
												<Table.Cell className="align-top">
													<CopyText value={record.name} className="font-mono" />
												</Table.Cell>
												<Table.Cell className="align-top">
													<CopyText value={record.value} className="font-mono" />
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>

						{hasCname && (
							<p className="text-xs text-muted">
								<Trans>
									For a root domain such as example.com, use A and AAAA records with {domain.target}'s addresses instead
									of the CNAME.
								</Trans>
							</p>
						)}
					</Modal.Body>
					<Modal.Footer className="items-center">
						{lastChecked && (
							<p className="me-auto text-xs text-muted">
								<Trans>Last checked {lastChecked} ago</Trans>
							</p>
						)}
						<Button isPending={checking} onPress={onCheck}>
							{checking && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Check DNS</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
