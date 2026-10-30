import type { CsvField } from "../csv";
import { Sheet } from "@heroui-pro/react";
import { Button, Label, TextArea } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { NativeSelect } from "@rezumi/ui/components/native-select";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { autoMapHeaders, CSV_FIELDS, mapCsvToApplications, parseCsv, rowsToCsv } from "../csv";
import { useInvalidateApplications } from "../use-application-actions";
import { orpc } from "@/libs/orpc/client";

const MAX_IMPORT = 500;
const SAMPLE =
	"Company,Role,Stage,Stage Date,Location,Salary,Source,Tags,Contact Name,Contact Email,Contact Phone\nStripe,Frontend Engineer,applied,2026-07-01,Remote,$180k,LinkedIn,remote;react,Jane Doe,jane@example.com,+1 555 0100";

const fieldLabel = (field: CsvField) =>
	({
		company: t`Company`,
		role: t`Role`,
		status: t`Stage`,
		stageEnteredAt: t`Stage date`,
		location: t`Location`,
		salary: t`Salary`,
		source: t`Source`,
		sourceUrl: t`Link`,
		jobDescription: t`Job description`,
		postingSource: t`Posting source`,
		notes: t`Notes`,
		tags: t`Tags`,
		contactName: t`Contact name`,
		contactRole: t`Contact role`,
		contactType: t`Contact label`,
		contactEmail: t`Contact email`,
		contactPhone: t`Contact phone`,
		archived: t`Archived (closes it)`,
		contacts: t`Contacts`,
	})[field];

type ImportSheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/**
 * Import from CSV: paste or upload, confirm how the columns were matched (they're matched automatically), then
 * import. Rows with no company or role are skipped and can be downloaded to fix.
 */
export function ImportApplicationsSheet({ open, onOpenChange }: ImportSheetProps) {
	const invalidate = useInvalidateApplications();
	const [text, setText] = useState("");
	const [overrides, setOverrides] = useState<Record<number, CsvField | null>>({});
	const fileRef = useRef<HTMLInputElement>(null);

	const table = text.trim() ? parseCsv(text) : null;
	const headers = table?.[0] ?? [];
	const mapping = autoMapHeaders(headers).map((field, index) =>
		index in overrides ? (overrides[index] ?? null) : field,
	);
	const result = table ? mapCsvToApplications(table, mapping) : null;

	// The import endpoint takes 500 at a time; the rest is reported rather than refused.
	const importable = result ? result.rows.slice(0, MAX_IMPORT) : [];
	const overflow = (result?.rows.length ?? 0) - importable.length;

	const reset = () => {
		setText("");
		setOverrides({});
		if (fileRef.current) fileRef.current.value = "";
	};

	const importMutation = useMutation({
		...orpc.applications.import.mutationOptions(),
		onSuccess: (response) => {
			invalidate();
			const skipped = result?.skipped ?? 0;
			toast.add({
				description:
					skipped > 0
						? `${plural(response.imported, { one: "Imported # application.", other: "Imported # applications." })} ${plural(skipped, { one: "# row had no company or role and was skipped.", other: "# rows had no company or role and were skipped." })}`
						: plural(response.imported, { one: "Imported # application.", other: "Imported # applications." }),
			});
			onOpenChange(false);
		},
		onError: () => toast.add({ type: "error", description: t`Import failed. Check the CSV and try again.` }),
	});

	const downloadSkipped = () => {
		if (!result || result.skippedRows.length === 0) return;
		const blob = new Blob([rowsToCsv(headers, result.skippedRows)], { type: "text/csv" });
		downloadWithAnchor(blob, "skipped-applications.csv");
	};

	return (
		<Sheet
			isOpen={open}
			onOpenChange={onOpenChange}
			placement="right"
			// After an import, the rows clear once the sheet has slid away; closing without importing keeps them.
			onAnimationEnd={(next) => {
				if (next || !importMutation.isSuccess) return;
				reset();
				importMutation.reset();
			}}
		>
			<Sheet.Backdrop>
				<Sheet.Content className="w-full sm:max-w-lg">
					<Sheet.Dialog>
						<Sheet.CloseTrigger aria-label={t`Close`} />
						<Sheet.Header>
							<Sheet.Heading>
								<Trans>Import from CSV</Trans>
							</Sheet.Heading>
							<p className="text-sm text-muted">
								<Trans>
									Paste rows or upload a .csv. Columns are matched automatically, and you check the match before
									anything is saved.
								</Trans>
							</p>
						</Sheet.Header>

						<Sheet.Body className="flex flex-col gap-4">
							<div className="flex items-center gap-2">
								<Button size="sm" variant="secondary" onPress={() => fileRef.current?.click()}>
									<Icon name="file-arrow-up" size={16} />
									<Trans>Upload .csv</Trans>
								</Button>
								<Button size="sm" variant="ghost" onPress={() => setText(SAMPLE)}>
									<Trans>Use sample</Trans>
								</Button>
								<input
									ref={fileRef}
									type="file"
									accept=".csv,text/csv"
									className="hidden"
									onChange={(event) =>
										void event.target.files?.[0]
											?.text()
											.then((value) => {
												setOverrides({});
												setText(value);
											})
											.catch(() =>
												toast.add({
													type: "error",
													description: t`Couldn't read that file. Choose a .csv file and try again.`,
												}),
											)
									}
								/>
							</div>

							<div className="grid gap-1.5">
								<Label htmlFor="import-csv-text">
									<Trans>CSV data</Trans>
								</Label>
								<TextArea
									fullWidth
									id="import-csv-text"
									value={text}
									rows={6}
									placeholder="Company,Role,Stage,…"
									className="font-mono text-xs"
									onChange={(event) => {
										setOverrides({});
										setText(event.target.value);
									}}
								/>
							</div>

							{result && headers.length > 0 && (
								<section aria-labelledby="import-columns" className="grid gap-2">
									<h3 id="import-columns" className="text-sm font-semibold">
										<Trans>Columns</Trans>
									</h3>
									<ul className="grid gap-1.5">
										{headers.map((header, index) => (
											<li
												key={`${header}-${index}`}
												className="grid grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)] items-center gap-2 text-sm"
											>
												<span className="truncate font-mono text-xs">{header || t`(no header)`}</span>
												<Icon name="arrow-right" size={16} className="text-muted" />
												<NativeSelect
													aria-label={t`Column ${header} goes to`}
													value={mapping[index] ?? ""}
													onChange={(event) =>
														setOverrides((current) => ({
															...current,
															[index]: (event.target.value || null) as CsvField | null,
														}))
													}
												>
													<option value="">{t`Leave out`}</option>
													{CSV_FIELDS.map((field) => (
														<option key={field} value={field}>
															{fieldLabel(field)}
														</option>
													))}
												</NativeSelect>
											</li>
										))}
									</ul>

									<div className="grid gap-1 rounded-xl border border-separator p-3 text-sm">
										{result.invalidValues.length > 0 && (
											<div role="alert" className="grid gap-1 text-warning-soft-foreground">
												<p>
													<Trans>Fix these values in the CSV, or leave their columns out, before importing.</Trans>
												</p>
												<ul className="list-disc ps-4">
													{result.invalidValues.map(({ row, field, value }) => (
														<li key={`${row}:${field}`}>
															<Trans>
																Row {row}, {fieldLabel(field)}: “{value}” is invalid.
															</Trans>
														</li>
													))}
												</ul>
											</div>
										)}
										<p className="flex items-center gap-1.5 font-medium">
											<Icon name="check-circle" size={18} className="text-accent-soft-foreground" />
											<Plural
												value={importable.length}
												one="# application ready to import"
												other="# applications ready to import"
											/>
										</p>
										{result.skipped > 0 && (
											<p className="text-xs text-muted">
												<Plural
													value={result.skipped}
													one="# row has no company or role and will be skipped."
													other="# rows have no company or role and will be skipped."
												/>{" "}
												<button
													type="button"
													className="font-medium underline underline-offset-2"
													onClick={downloadSkipped}
												>
													<Trans>Download them</Trans>
												</button>
											</p>
										)}
										{result.contactsSkipped > 0 && (
											<p className="text-xs text-muted">
												<Plural
													value={result.contactsSkipped}
													one="# contact has an invalid email or no name; its application still imports."
													other="# contacts have an invalid email or no name; their applications still import."
												/>
											</p>
										)}
										{overflow > 0 && (
											<p className="text-xs text-warning-soft-foreground">
												<Trans>
													Only the first {MAX_IMPORT} rows import at once, leaving out {overflow}. Split the file to
													import the rest.
												</Trans>
											</p>
										)}
									</div>
								</section>
							)}
						</Sheet.Body>

						<Sheet.Footer>
							<Button variant="secondary" onPress={() => onOpenChange(false)}>
								<Trans>Cancel</Trans>
							</Button>
							<Button
								isDisabled={
									importable.length === 0 || (result?.invalidValues.length ?? 0) > 0 || importMutation.isPending
								}
								onPress={() => {
									if (!result?.invalidValues.length) importMutation.mutate({ items: importable });
								}}
							>
								<Plural value={importable.length} one="Import # application" other="Import # applications" />
							</Button>
						</Sheet.Footer>
					</Sheet.Dialog>
				</Sheet.Content>
			</Sheet.Backdrop>
		</Sheet>
	);
}
