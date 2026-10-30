import type { ApplicationExportOptions } from "../csv";
import type { Application } from "../types";
import { Sheet } from "@heroui-pro/react";
import { Button, Input, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { exportApplicationsCsv, selectApplicationsForExport } from "../csv";
import { Combobox } from "@/components/ui/combobox";

type ExportApplicationsSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	applications: Application[];
	filtered: Application[];
};

export function ExportApplicationsSheet({ open, onOpenChange, applications, filtered }: ExportApplicationsSheetProps) {
	const id = useId();
	const [scope, setScope] = useState<ApplicationExportOptions["scope"]>("filtered");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const validRange = !from || !to || from <= to;
	const selected = selectApplicationsForExport(applications, filtered, { scope, from, to });

	return (
		<Sheet isOpen={open} onOpenChange={onOpenChange} placement="right">
			<Sheet.Backdrop>
				<Sheet.Content className="w-full sm:max-w-lg">
					<Sheet.Dialog>
						<Sheet.CloseTrigger aria-label={t`Close`} />
						<Sheet.Header>
							<Sheet.Heading>
								<Trans>Export applications</Trans>
							</Sheet.Heading>
							<p className="text-sm text-muted">
								<Trans>Download application details, contacts, notes, and timeline history as CSV.</Trans>
							</p>
						</Sheet.Header>
						<form
							className="contents"
							onSubmit={(event) => {
								event.preventDefault();
								if (!validRange || selected.length === 0) return;
								const blob = new Blob([exportApplicationsCsv(selected)], { type: "text/csv;charset=utf-8" });
								downloadWithAnchor(blob, `applications-${new Date().toISOString().slice(0, 10)}.csv`);
								onOpenChange(false);
							}}
						>
							<Sheet.Body className="flex flex-col gap-4">
								<div className="space-y-1.5">
									<Label htmlFor={`${id}-scope`}>
										<Trans>Applications to export</Trans>
									</Label>
									<Combobox
										id={`${id}-scope`}
										className="w-full"
										value={scope}
										onValueChange={(value) => value && setScope(value)}
										options={[
											{ value: "filtered", label: t`Current filters` },
											{ value: "all", label: t`All applications (including closed)` },
										]}
									/>
								</div>
								<div className="grid grid-cols-2 items-end gap-3">
									<div className="space-y-1.5">
										<Label htmlFor={`${id}-from`}>
											<Trans>Application date from</Trans>
										</Label>
										<Input
											fullWidth
											id={`${id}-from`}
											type="date"
											value={from}
											max={to || undefined}
											onChange={(event) => setFrom(event.target.value)}
										/>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor={`${id}-to`}>
											<Trans>Application date to</Trans>
										</Label>
										<Input
											fullWidth
											id={`${id}-to`}
											type="date"
											value={to}
											min={from || undefined}
											onChange={(event) => setTo(event.target.value)}
										/>
									</div>
								</div>
								{!validRange && (
									<p role="alert" className="text-sm text-danger-text">
										<Trans>Start date must be on or before end date.</Trans>
									</p>
								)}
								<p className="text-sm text-ink-3">
									<Plural value={selected.length} one="# application to export" other="# applications to export" />
								</p>
							</Sheet.Body>
							<Sheet.Footer>
								<Button variant="secondary" onPress={() => onOpenChange(false)}>
									<Trans>Cancel</Trans>
								</Button>
								<Button type="submit" isDisabled={!validRange || selected.length === 0}>
									<Trans>Download CSV</Trans>
								</Button>
							</Sheet.Footer>
						</form>
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}
