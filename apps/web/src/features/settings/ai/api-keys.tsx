import type { DataGridColumn } from "@heroui-pro/react";
import { DataGrid, EmptyState, NativeSelect, Segment } from "@heroui-pro/react";
import { Alert, Button, Input, InputGroup, Label, Modal, Skeleton, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { Icon } from "@rezumi/ui/components/icon";
import { Swap } from "@rezumi/ui/components/swap";
import { toast } from "@rezumi/ui/components/toast";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { SettingsSection } from "../section";
import { authClient } from "@/libs/auth/client";
import { getReadableErrorMessage } from "@/libs/error-message";
import { ENTER_CLASS } from "@/libs/motion";
import { client } from "@/libs/orpc/client";

const KEYS = ["auth", "api-keys"];
const DAY = 24 * 60 * 60;

type ApiKey = {
	id: string;
	name: string | null;
	start: string | null;
	createdAt: Date;
	lastRequest: Date | null;
	expiresAt: Date | null;
};

const shortDate = (date: Date) =>
	date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function ApiKeysSection() {
	const queryClient = useQueryClient();
	const phone = useBreakpoint() === "mobile";
	const [creating, setCreating] = useState(false);
	const { data: keys = [], isLoading } = useQuery({
		queryKey: KEYS,
		queryFn: () => authClient.apiKey.list(),
		// A revoked key is turned off at once and deleted when its Undo toast goes; it's never listed.
		select: ({ data }) =>
			(data?.apiKeys ?? [])
				.filter((key) => key.enabled && (!key.expiresAt || key.expiresAt.getTime() > Date.now()))
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) as ApiKey[],
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: KEYS });

	const revoke = async (key: ApiKey) => {
		const { error } = await authClient.apiKey.update({ keyId: key.id, enabled: false });
		if (error) {
			toast.add({ type: "error", description: getReadableErrorMessage(error, t`Couldn't revoke the key. Try again.`) });
			return;
		}
		await refresh();

		let undone = false;
		const name = key.name || key.start;
		toast.add({
			description: name
				? t`Revoked “${name}”. Apps using it stop working now.`
				: t`Key revoked. Apps using it stop working now.`,
			actionProps: {
				children: t`Undo`,
				onClick: async () => {
					undone = true;
					await authClient.apiKey.update({ keyId: key.id, enabled: true });
					await refresh();
				},
			},
			onClose: () => {
				if (!undone) void authClient.apiKey.delete({ keyId: key.id });
			},
		});
	};

	const keyName = (key: ApiKey) => key.name || <span className="font-mono text-muted">{key.start}…</span>;
	const lastUsed = (key: ApiKey) => (key.lastRequest ? shortDate(key.lastRequest) : t`Never`);
	const expires = (key: ApiKey) => (key.expiresAt ? shortDate(key.expiresAt) : t`Never`);

	// Widths sit on the header cells: DataGrid applies column `width` only to resizable columns.
	const columns: DataGridColumn<ApiKey>[] = [
		{
			id: "name",
			header: t`Name`,
			isRowHeader: true,
			cell: (key) => {
				const created = shortDate(key.createdAt);
				const used = lastUsed(key);
				const expiry = expires(key);
				return (
					<span className="grid min-w-0 gap-0.5">
						<span className="truncate font-medium">{keyName(key)}</span>
						{phone && (
							<span className="text-xs text-muted">
								{t`Created ${created}`} · {t`Last used ${used}`} · {t`Expires ${expiry}`}
							</span>
						)}
					</span>
				);
			},
		},
		...(phone
			? []
			: [
					{
						id: "created",
						header: t`Created`,
						headerClassName: "w-32",
						cellClassName: "whitespace-nowrap text-muted",
						cell: (key: ApiKey) => shortDate(key.createdAt),
					} satisfies DataGridColumn<ApiKey>,
					{
						id: "lastUsed",
						header: t`Last used`,
						headerClassName: "w-32",
						cellClassName: "whitespace-nowrap text-muted",
						cell: lastUsed,
					} satisfies DataGridColumn<ApiKey>,
					{
						id: "expires",
						header: t`Expires`,
						headerClassName: "w-32",
						cellClassName: "whitespace-nowrap text-muted",
						cell: expires,
					} satisfies DataGridColumn<ApiKey>,
				]),
		{
			id: "revoke",
			header: <span className="sr-only">{t`Actions`}</span>,
			headerClassName: "w-24",
			align: "end",
			cell: (key) => {
				const label = key.name || key.start || t`unnamed key`;
				return (
					<Button size="sm" variant="danger-soft" aria-label={t`Revoke ${label}`} onPress={() => void revoke(key)}>
						<Trans>Revoke</Trans>
					</Button>
				);
			},
		},
	];

	return (
		<SettingsSection
			id="api-keys"
			title={<Trans>API keys</Trans>}
			description={
				<Trans>For scripts, extensions and MCP clients. Keys act as you and can read and edit your documents.</Trans>
			}
			action={
				<Button size="sm" variant="secondary" onPress={() => setCreating(true)}>
					<Icon name="plus" size={18} />
					<Trans>New key</Trans>
				</Button>
			}
		>
			{isLoading ? (
				<Skeleton className="h-14 rounded-xl" />
			) : keys.length === 0 ? (
				<EmptyState size="sm" className="rounded-xl border border-dashed border-border">
					<EmptyState.Header>
						<EmptyState.Media variant="icon">
							<Icon name="key" size={20} />
						</EmptyState.Media>
						<EmptyState.Title>
							<Trans>No keys yet.</Trans>
						</EmptyState.Title>
					</EmptyState.Header>
				</EmptyState>
			) : (
				<DataGrid
					aria-label={t`API keys`}
					variant="secondary"
					className="w-full text-sm [&_td]:border-separator-tertiary/25"
					contentClassName="table-fixed"
					columns={columns}
					data={keys}
					getRowId={(key) => key.id}
				/>
			)}

			<NewKeyDialog open={creating} onOpenChange={setCreating} onCreated={() => void refresh()} />
		</SettingsSection>
	);
}

type Expiry = { label: () => string; seconds: number | null };

const EXPIRIES: Expiry[] = [
	{ label: () => t`30 days`, seconds: 30 * DAY },
	{ label: () => t`90 days`, seconds: 90 * DAY },
	{ label: () => t`Never`, seconds: null },
];

type NewKeyDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void };

/** Name and expiry, then the key, shown once with Copy. */
function NewKeyDialog({ open, onOpenChange, onCreated }: NewKeyDialogProps) {
	const id = useId();
	const descriptionId = useId();
	const [name, setName] = useState("");
	const [expiry, setExpiry] = useState(0);
	const [access, setAccess] = useState<"read" | "full">("full");
	const [key, setKey] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [copied, setCopied] = useState(false);
	const [, copy] = useCopyToClipboard();

	// Everything clears once the dialog has faded out, so the key doesn't turn back into the form while it does.
	const reset = () => {
		setName("");
		setExpiry(0);
		setAccess("full");
		setKey(null);
		setFailure(null);
		setCopied(false);
	};

	const create = async () => {
		setCreating(true);
		setFailure(null);
		try {
			const data = await client.auth.createApiKey({
				name: name.trim(),
				expiresIn: EXPIRIES[expiry]?.seconds ?? null,
				access,
			});
			setKey(data.key);
			onCreated();
		} catch (error) {
			setFailure(getReadableErrorMessage(error, t`Couldn't create the key. Try again.`));
		} finally {
			setCreating(false);
		}
	};

	return (
		<Modal.Backdrop
			isOpen={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setTimeout(reset, 300);
			}}
		>
			<Modal.Container size="md">
				<Modal.Dialog aria-describedby={descriptionId}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							<Trans>New API key</Trans>
						</Modal.Heading>
						<p id={descriptionId} className={cn("text-sm text-muted", key && "sr-only")}>
							<Trans>Keys act as you and can read and edit your documents.</Trans>
						</p>
					</Modal.Header>
					<Modal.Body>
						{key ? (
							<div className={cn(ENTER_CLASS, "grid gap-3")}>
								<Alert status="warning" role="status">
									<Alert.Indicator>
										<Icon name="key" />
									</Alert.Indicator>
									<Alert.Content>
										<Alert.Description>
											<Trans>Copy it now. For your security, it won't be shown again.</Trans>
										</Alert.Description>
									</Alert.Content>
								</Alert>
								<TextField fullWidth isReadOnly value={key} aria-label={t`API key`}>
									<InputGroup variant="secondary" fullWidth>
										<InputGroup.Input spellCheck={false} className="truncate font-mono text-sm" />
										<InputGroup.Suffix className="pe-1">
											<Button
												size="sm"
												variant="secondary"
												onPress={async () => {
													await copy(key);
													setCopied(true);
													setTimeout(() => setCopied(false), 2000);
												}}
											>
												<Swap
													swapped={copied}
													from={
														<>
															<Icon name="copy" size={16} />
															<Trans>Copy</Trans>
														</>
													}
													to={
														<>
															<Icon name="check" size={16} />
															<Trans>Copied</Trans>
														</>
													}
												/>
											</Button>
										</InputGroup.Suffix>
									</InputGroup>
								</TextField>
								<Modal.Footer className="p-0">
									<Button onPress={() => onOpenChange(false)}>
										<Trans>Done</Trans>
									</Button>
								</Modal.Footer>
							</div>
						) : (
							<form
								className="grid gap-4"
								onSubmit={(event) => {
									event.preventDefault();
									if (name.trim()) void create();
								}}
							>
								<TextField fullWidth value={name} onChange={setName} className="gap-1.5">
									<Label>
										<Trans>What's it for?</Trans>
									</Label>
									<Input variant="secondary" maxLength={64} placeholder={t`Claude Desktop`} />
								</TextField>
								<div className="grid gap-1.5">
									<Label htmlFor={`${id}-access`}>
										<Trans>Access</Trans>
									</Label>
									<NativeSelect variant="secondary" fullWidth>
										<NativeSelect.Trigger
											id={`${id}-access`}
											value={access}
											onChange={(event) => setAccess(event.target.value === "read" ? "read" : "full")}
											className="pointer-coarse:min-h-11"
										>
											<option value="read">{t`Read only`}</option>
											<option value="full">{t`Read, write and delete`}</option>
											<NativeSelect.Indicator />
										</NativeSelect.Trigger>
									</NativeSelect>
								</div>
								<div className="grid gap-1.5">
									<span id={`${id}-expiry`} className="text-sm font-medium">
										<Trans>Expires</Trans>
									</span>
									<Segment
										aria-labelledby={`${id}-expiry`}
										selectedKey={String(expiry)}
										className="w-full"
										onSelectionChange={(key) => setExpiry(Number(key))}
									>
										{EXPIRIES.map((option, index) => (
											<Segment.Item key={index} id={String(index)} className="flex-1">
												{option.label()}
											</Segment.Item>
										))}
									</Segment>
								</div>
								{failure && (
									<p role="alert" className="text-sm text-danger">
										{failure}
									</p>
								)}
								<Modal.Footer className="p-0">
									<Button variant="secondary" onPress={() => onOpenChange(false)}>
										<Trans>Cancel</Trans>
									</Button>
									<Button type="submit" isDisabled={!name.trim() || creating} isPending={creating}>
										{creating && <Spinner size="sm" color="current" aria-hidden />}
										<Trans>Create key</Trans>
									</Button>
								</Modal.Footer>
							</form>
						)}
					</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
