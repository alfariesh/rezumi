import type { RouterOutput } from "@/libs/orpc/client";
import { Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { CvDomainCard } from "./cv-domain-card";
import { DnsRecordsDialog } from "./dns-records-dialog";
import { toastError } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

type CustomDomainFieldProps = {
	/** Suggest a `.cv` domain from OlaCV while none is connected (`FLAG_OLACV_SUGGESTION`). */
	suggest: boolean;
};

/** Connects the account's own domain: the domain, the DNS records to add in a dialog, a check, and the result. */
export function CustomDomainField({ suggest }: CustomDomainFieldProps) {
	const queryClient = useQueryClient();
	const { data: domain, isPending: loading } = useQuery(orpc.customDomain.get.queryOptions());
	const { data: suggestion } = useQuery({
		...orpc.customDomain.suggestion.queryOptions(),
		enabled: suggest && !loading && !domain,
		staleTime: 15 * 60_000,
	});
	const [hostname, setHostname] = useState("");
	const [recordsOpen, setRecordsOpen] = useState(false);
	const refresh = (next: RouterOutput["customDomain"]["get"]) =>
		queryClient.setQueryData(orpc.customDomain.get.queryKey(), next);
	const set = useMutation({
		...orpc.customDomain.set.mutationOptions(),
		onSuccess: (next) => {
			refresh(next);
			if (!next.verified) setRecordsOpen(true);
		},
	});
	const verify = useMutation({ ...orpc.customDomain.verify.mutationOptions(), onSuccess: refresh });
	const remove = useMutation({ ...orpc.customDomain.remove.mutationOptions(), onSuccess: () => refresh(null) });
	const onError = (error: unknown) =>
		toastError(error, t`Couldn't update sharing. Try again.`, { allowServerMessage: true });

	const check = () =>
		verify.mutate(undefined, {
			onError,
			onSuccess: (next) => {
				if (next.verified) setRecordsOpen(false);
				toast.add(
					next.verified
						? { description: t`Domain connected` }
						: { type: "error", description: t`The records aren't visible yet. Check again later.` },
				);
			},
		});

	if (loading) return null;

	if (!domain)
		return (
			<>
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						set.mutate({ hostname }, { onError });
					}}
				>
					<TextField variant="secondary" value={hostname} onChange={setHostname} className="min-w-0 flex-1 gap-1.5">
						<Label>
							<Trans>Your domain</Trans>
						</Label>
						<Input
							variant="secondary"
							fullWidth
							placeholder="resume.example.com"
							spellCheck={false}
							autoCapitalize="none"
							dir="ltr"
							className="font-mono text-[13px]"
						/>
					</TextField>
					<Button type="submit" variant="secondary" isPending={set.isPending} isDisabled={!hostname.trim()}>
						{set.isPending && <Spinner size="sm" color="current" aria-hidden />}
						<Trans>Connect</Trans>
					</Button>
				</form>
				{suggest && suggestion && (
					<CvDomainCard
						suggestion={suggestion}
						connecting={set.isPending}
						onConnect={() => set.mutate({ hostname: suggestion.domain }, { onError })}
					/>
				)}
			</>
		);

	return (
		<div className="fields-on-card grid gap-3 rounded-xl bg-surface-secondary p-4">
			<div className="flex items-center gap-2">
				<Icon
					name={domain.verified ? "check-circle" : "warning-circle"}
					size={18}
					className={domain.verified ? "text-success" : "text-warning"}
				/>
				<span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium" dir="ltr">
					{domain.hostname}
				</span>
				<Button
					variant="danger-soft"
					size="sm"
					isPending={remove.isPending}
					onPress={() => remove.mutate(undefined, { onError })}
				>
					{remove.isPending && <Spinner size="sm" color="current" aria-hidden />}
					<Trans>Remove</Trans>
				</Button>
			</div>
			{domain.verified ? (
				<p className="text-xs text-muted">
					<Trans>Connected. Your domain opens your primary resume.</Trans>
				</p>
			) : (
				<>
					<p className="text-xs text-muted">
						<Trans>Not connected yet. Add its DNS records where you manage the domain, then check.</Trans>
					</p>
					<div className="flex flex-wrap gap-2">
						<Button variant="secondary" size="sm" onPress={() => setRecordsOpen(true)}>
							<Trans>Show DNS records</Trans>
						</Button>
						<Button variant="ghost" size="sm" isPending={verify.isPending} onPress={check}>
							{verify.isPending && <Spinner size="sm" color="current" aria-hidden />}
							<Trans>Check DNS</Trans>
						</Button>
					</div>
				</>
			)}
			<DnsRecordsDialog
				domain={domain}
				open={recordsOpen}
				onOpenChange={setRecordsOpen}
				checking={verify.isPending}
				onCheck={check}
			/>
		</div>
	);
}
