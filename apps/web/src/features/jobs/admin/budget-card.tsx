import type { JobCostReport } from "./costs";
import { Button, Input, Label, TextField } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@rezumi/ui/components/toast";
import { formatUsd, typedUsd } from "./costs";
import { AdminCard, MiniStat } from "@/features/billing/admin/parts";
import { ReasonDialog } from "@/features/billing/admin/reason-dialog";
import { client, orpc } from "@/libs/orpc/client";

type BudgetCardProps = { budget: JobCostReport["budget"]; spentMicro: number };

/**
 * The providers' daily budget, changed here without a deploy (`budget.ts` on the server). Every change asks why and goes
 * to the audit log; it reaches every Worker within a minute.
 */
export function BudgetCard({ budget, spentMicro }: BudgetCardProps) {
	const queryClient = useQueryClient();
	const [dialog, setDialog] = useState<"set" | "reset" | null>(null);
	const [amount, setAmount] = useState("");
	const typed = typedUsd(amount);
	const maxUsd = budget.maxMicro / 1_000_000;
	const amountOk = typed !== null && typed <= maxUsd;
	const fromSetting = budget.source === "setting";

	const close = () => {
		setDialog(null);
		setAmount("");
	};
	const done = (message: string) => {
		toast.add({ type: "success", description: message });
		void queryClient.invalidateQueries({ queryKey: orpc.jobs.admin.key() });
	};

	return (
		<AdminCard
			icon="scales"
			title={<Trans>Daily budget</Trans>}
			description={
				<Trans>
					What the job providers may cost in a UTC day. Past it, people get saved results only until midnight UTC. A
					change applies within a minute, without a deploy.
				</Trans>
			}
			action={
				<div className="flex items-center gap-2">
					{fromSetting && (
						<Button size="sm" variant="ghost" onPress={() => setDialog("reset")}>
							<Trans>Use server default</Trans>
						</Button>
					)}
					<Button size="sm" variant="tertiary" onPress={() => setDialog("set")}>
						<Trans>Change</Trans>
					</Button>
				</div>
			}
		>
			<div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
				<MiniStat
					value={formatUsd(budget.budgetMicro)}
					label={fromSetting ? t`A day, set here` : t`A day, the server default`}
				/>
				<MiniStat value={formatUsd(spentMicro)} label={t`Spent today`} />
				<MiniStat value={formatUsd(budget.defaultMicro)} label={t`Server default`} />
			</div>
			{fromSetting && budget.updatedAt && (
				<p className="mt-3 text-body-sm text-muted">
					{budget.updatedBy ? (
						<Trans>
							Set by {budget.updatedBy} on {i18n.date(budget.updatedAt, { dateStyle: "medium", timeStyle: "short" })}: “
							{budget.reason}”
						</Trans>
					) : (
						<Trans>
							Set on {i18n.date(budget.updatedAt, { dateStyle: "medium", timeStyle: "short" })}: “{budget.reason}”
						</Trans>
					)}
				</p>
			)}

			<ReasonDialog
				isOpen={dialog === "set"}
				onOpenChange={(open) => !open && close()}
				title={<Trans>Change the daily budget</Trans>}
				description={
					<Trans>
						$0 stops paid searches: people get saved results only. The most this can be set to is{" "}
						{formatUsd(budget.maxMicro)} a day.
					</Trans>
				}
				canSubmit={amountOk}
				submitLabel={<Trans>Set budget</Trans>}
				onSubmit={async (reason) => {
					await client.jobs.admin.setBudget({ usd: typed ?? 0, reason });
					done(t`Daily budget set.`);
				}}
			>
				<TextField fullWidth value={amount} onChange={setAmount} className="gap-1.5">
					<Label>{t`US dollars a day (0–${maxUsd})`}</Label>
					<Input variant="secondary" inputMode="decimal" placeholder={String(budget.budgetMicro / 1_000_000)} />
				</TextField>
			</ReasonDialog>

			<ReasonDialog
				isOpen={dialog === "reset"}
				onOpenChange={(open) => !open && close()}
				title={<Trans>Use the server default</Trans>}
				description={
					<Trans>
						The budget set here is removed; the server default of {formatUsd(budget.defaultMicro)} a day applies again.
					</Trans>
				}
				submitLabel={<Trans>Use default</Trans>}
				onSubmit={async (reason) => {
					await client.jobs.admin.setBudget({ usd: null, reason });
					done(t`The server default applies again.`);
				}}
			/>
		</AdminCard>
	);
}
