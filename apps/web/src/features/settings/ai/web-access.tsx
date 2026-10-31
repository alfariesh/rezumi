import { Segment } from "@heroui-pro/react";
import { Alert, Button, Chip, Description, Input, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { useHasUsableAiProvider } from "../integrations/hooks/use-has-usable-ai-provider";
import { SettingsSection } from "../section";
import { RowIcon, RowSeparator } from "@/components/layout/icon-row";
import { AiProviderLoadState } from "@/features/settings/integrations/ai-provider-load-state";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

const PROVIDERS = { firecrawl: "Firecrawl", tavily: "Tavily", exa: "Exa" } as const;
const PROVIDER_SITES = { firecrawl: "firecrawl.dev", tavily: "tavily.com", exa: "exa.ai" } as const;
type Provider = keyof typeof PROVIDERS;

function testFailureMessage(error: string | undefined) {
	if (error === "auth") return t`The service rejected the API key. Check the key and save it again.`;
	if (error === "quota")
		return t`The service's quota is used up. Check your plan with the service, or try again later.`;
	if (error === "timeout") return t`The service didn't respond in time. Try again.`;
	if (error === "rate-limit") return t`Too many requests. Try again later.`;
	return t`The service is unavailable or doesn't support this. Try again later.`;
}

export function WebAccessSection() {
	const id = useId();
	const queryClient = useQueryClient();
	const [apiKey, setApiKey] = useState("");
	const [provider, setProvider] = useState<Provider>("firecrawl");
	const [editing, setEditing] = useState(false);
	const providerState = useHasUsableAiProvider();
	const { hasUsableProvider } = providerState;
	const { data: status, error, isLoading, refetch } = useQuery(orpc.webAccess.status.queryOptions());
	const refresh = () => {
		setApiKey("");
		setEditing(false);
		test.reset();
		void queryClient.invalidateQueries({ queryKey: orpc.webAccess.status.key() });
	};
	const save = useMutation(orpc.webAccess.save.mutationOptions({ onSuccess: refresh }));
	const remove = useMutation(orpc.webAccess.delete.mutationOptions({ onSuccess: refresh }));
	const test = useMutation(orpc.webAccess.test.mutationOptions());
	const pending = save.isPending || remove.isPending || test.isPending;
	const failure = error || save.error || remove.error || test.error;
	const connectedProvider = status?.provider ? PROVIDERS[status.provider] : null;
	// Older servers leave `searxng` out.
	const serverSearch = status?.searxng === true;
	const openEditor = () => {
		setProvider(status?.provider ?? "firecrawl");
		setApiKey("");
		save.reset();
		remove.reset();
		test.reset();
		setEditing(true);
	};

	return (
		<SettingsSection
			id="web-access"
			title={<Trans>Web access</Trans>}
			description={<Trans>Read the job links you save. Saving and preparing jobs works without a connection.</Trans>}
			footer={
				<div className="flex items-start gap-2 text-xs leading-5 text-muted">
					<Icon name="sparkle" size={16} className="mt-0.5 shrink-0" />
					<div>
						<span className="font-medium text-foreground">
							<Trans>Assistant.</Trans>
						</span>{" "}
						{providerState.isUnavailable ? (
							<AiProviderLoadState state={providerState} />
						) : !hasUsableProvider ? (
							<Trans>
								Connect an AI provider above to use the assistant. Saving and preparing jobs doesn't need one.
							</Trans>
						) : serverSearch && connectedProvider ? (
							<Trans>
								Searches with your server's search and reads pages with {connectedProvider}, whichever AI provider you
								use.
							</Trans>
						) : serverSearch ? (
							<Trans>
								Searches with your server's search and reads links with the built-in reader, whichever AI provider you
								use.
							</Trans>
						) : connectedProvider ? (
							<Trans>Searches and reads pages with {connectedProvider}, whichever AI provider you use.</Trans>
						) : (
							<Trans>
								Uses your AI provider's own web search where supported, and reads links with the built-in reader.
							</Trans>
						)}
					</div>
				</div>
			}
		>
			<div className="flex items-start gap-3">
				<RowIcon>
					<Icon name="file-text" size={20} />
				</RowIcon>
				<div className="grid flex-1 gap-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-sm font-medium">
							<Trans>Built-in reader</Trans>
						</h3>
						<Chip size="sm" variant="soft" color="success" className="gap-1">
							<Icon name="check" size={14} />
							<Chip.Label>
								<Trans>Active</Trans>
							</Chip.Label>
						</Chip>
					</div>
					<p className="text-sm leading-5 text-muted">
						{connectedProvider ? (
							<Trans>Used when {connectedProvider} can't read a page. No account needed.</Trans>
						) : (
							<Trans>Reads supported public job pages. No account needed.</Trans>
						)}
					</p>
				</div>
			</div>

			<RowSeparator />

			<div className="grid gap-4">
				<div className="flex items-start gap-3">
					<RowIcon>
						<Icon name="magnifying-glass" size={20} />
					</RowIcon>
					<div className="grid flex-1 gap-1.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-sm font-medium">
								<Trans>Search and enhanced reading</Trans>
							</h3>
							{status && (
								<Chip size="sm" variant="soft" color={status.configured ? "success" : "default"}>
									{status.managed ? (
										<Trans>Managed by server</Trans>
									) : status.configured ? (
										<Trans>Connection saved</Trans>
									) : (
										<Trans>Optional</Trans>
									)}
								</Chip>
							)}
						</div>
						<p className="max-w-[58ch] text-sm leading-5 text-muted">
							{serverSearch ? (
								<Trans>
									Your server provides search for Applications and the assistant. Connect a service to read pages the
									built-in reader can't.
								</Trans>
							) : (
								<Trans>
									Search from Applications and the assistant, and read pages the built-in reader can't. One service
									covers both.
								</Trans>
							)}
						</p>
					</div>
				</div>

				{failure && (
					<Alert status="danger">
						<Alert.Indicator>
							<Icon name="warning-circle" />
						</Alert.Indicator>
						<Alert.Content>
							<Alert.Description>
								{getOrpcErrorMessage(failure, { fallback: t`Couldn't load or save web access settings. Try again.` })}
							</Alert.Description>
						</Alert.Content>
					</Alert>
				)}
				{isLoading ? (
					<p role="status" className="flex min-h-10 items-center gap-2 text-sm text-muted">
						<Spinner size="sm" color="current" aria-hidden />
						<Trans>Loading connection…</Trans>
					</p>
				) : !status ? (
					<Button variant="secondary" className="w-fit" onPress={() => void refetch()}>
						<Trans>Try again</Trans>
					</Button>
				) : (
					<>
						{status.managed && (
							<Alert status="accent">
								<Alert.Indicator>
									<Icon name="info" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Title>
										<Trans>Provided by your server: {connectedProvider}.</Trans>
									</Alert.Title>
									<Alert.Description className="grid gap-2">
										<span>
											<Trans>
												Search and reading are set up for everyone here. Ask your administrator about changes.
											</Trans>
										</span>
										<Button
											variant="secondary"
											size="sm"
											className="w-fit"
											isDisabled={pending}
											isPending={test.isPending}
											onPress={() => test.mutate()}
										>
											{test.isPending && <Spinner size="sm" color="current" aria-hidden />}
											<Trans>Test connection</Trans>
										</Button>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
						{status.configured && !status.managed && !editing && (
							<div className="flex flex-wrap items-center gap-3">
								<RowIcon className="text-sm font-semibold text-muted">{connectedProvider?.slice(0, 1)}</RowIcon>
								<div className="grid flex-1 gap-0.5">
									<p className="text-sm font-medium">{connectedProvider}</p>
									<p className="flex items-center gap-1 text-xs text-muted">
										<Icon name="lock" size={13} />
										<Trans>Key stored encrypted</Trans>
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-1 max-sm:basis-full max-sm:ps-row-indent">
									<Button
										variant="secondary"
										size="sm"
										isDisabled={pending}
										isPending={test.isPending}
										onPress={() => test.mutate()}
									>
										{test.isPending && <Spinner size="sm" color="current" aria-hidden />}
										<Trans>Test connection</Trans>
									</Button>
									{status.canSave && (
										<>
											<Button variant="ghost" size="sm" isDisabled={pending} onPress={openEditor}>
												<Trans>Change connection</Trans>
											</Button>
											<Button
												variant="danger-soft"
												size="sm"
												isDisabled={pending}
												isPending={remove.isPending}
												onPress={() => remove.mutate()}
											>
												{remove.isPending && <Spinner size="sm" color="current" aria-hidden />}
												<Trans>Remove connection</Trans>
											</Button>
										</>
									)}
								</div>
							</div>
						)}
						{serverSearch && !status.configured && (
							<Button
								variant="secondary"
								size="sm"
								className="ms-row-indent w-fit"
								isDisabled={pending}
								isPending={test.isPending}
								onPress={() => test.mutate()}
							>
								{test.isPending && <Spinner size="sm" color="current" aria-hidden />}
								<Trans>Test search</Trans>
							</Button>
						)}
						{test.isPending && (
							<p role="status" className="text-sm text-muted">
								{!serverSearch ? (
									<Trans>Testing search and reading with {connectedProvider}…</Trans>
								) : connectedProvider ? (
									<Trans>Testing your server's search, and reading with {connectedProvider}…</Trans>
								) : (
									<Trans>Testing your server's search…</Trans>
								)}
							</p>
						)}
						{test.data && (
							<div role="status" className="grid gap-2 text-sm leading-5">
								{[
									{ result: test.data.search, label: test.data.search.success ? t`Search works` : t`Search failed` },
									// Without a connection only the built-in reader reads, and the test doesn't cover it.
									...(connectedProvider
										? [
												{
													result: test.data.read,
													label: test.data.read.success ? t`Reading works` : t`Enhanced reading failed`,
												},
											]
										: []),
								].map(({ result, label }, index) => (
									<p
										key={index}
										className={cn(
											"flex items-start gap-2",
											result.success ? "text-success-soft-foreground" : "text-warning-soft-foreground",
										)}
									>
										<Icon name={result.success ? "check-circle" : "info"} size={16} className="mt-0.5 shrink-0" />
										<span>
											<span className="font-medium">{label}.</span>
											{!result.success && <> {testFailureMessage(result.error)}</>}
										</span>
									</p>
								))}
								{connectedProvider && !test.data.read.success && (
									<p className="text-muted">
										<Trans>The built-in reader remains active.</Trans>
									</p>
								)}
								<p className="text-xs text-muted">
									{!serverSearch ? (
										<Trans>Tested with {connectedProvider}. Only this service was tested.</Trans>
									) : connectedProvider ? (
										<Trans>Search was tested with your server's search, and reading with {connectedProvider}.</Trans>
									) : (
										<Trans>Search was tested with your server's search. Links are read with the built-in reader.</Trans>
									)}
								</p>
							</div>
						)}
						{!status.managed && !status.canSave && (
							<Alert status="accent">
								<Alert.Indicator>
									<Icon name="info" />
								</Alert.Indicator>
								<Alert.Content>
									<Alert.Description>
										<Trans>
											Ask your server administrator to enable credential encryption or configure a shared web
											connection.
										</Trans>
									</Alert.Description>
								</Alert.Content>
							</Alert>
						)}
						{status.canSave && !status.configured && !editing && (
							<Button variant="secondary" className="ms-row-indent w-fit" onPress={openEditor}>
								<Icon name="link-simple-horizontal" size={18} />
								<Trans>Connect a service</Trans>
							</Button>
						)}
						{status.canSave && editing && (
							<form
								className="grid gap-4"
								onSubmit={(event) => {
									event.preventDefault();
									if (!pending && apiKey.trim()) save.mutate({ provider, apiKey });
								}}
							>
								<div className="grid gap-1.5">
									<span id={`${id}-provider`} className="text-sm font-medium">
										<Trans>Provider</Trans>
									</span>
									<Segment
										aria-labelledby={`${id}-provider`}
										selectedKey={provider}
										isDisabled={pending}
										className="w-fit max-w-full"
										onSelectionChange={(key) => {
											setProvider(String(key) as Provider);
											setApiKey("");
											save.reset();
										}}
									>
										{Object.entries(PROVIDERS).map(([value, label]) => (
											<Segment.Item key={value} id={value} className="flex-auto max-sm:px-2">
												{label}
											</Segment.Item>
										))}
									</Segment>
								</div>
								<TextField
									fullWidth
									autoFocus
									isRequired
									type="password"
									value={apiKey}
									isDisabled={pending}
									autoComplete="off"
									onChange={setApiKey}
									className="gap-1.5"
								>
									<Label>
										<Trans>API key</Trans>
									</Label>
									<Input
										variant="secondary"
										placeholder={t`Paste your key`}
										maxLength={2_000}
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
									/>
									<Description>
										<Trans>
											Get a key at{" "}
											<a
												href={`https://${PROVIDER_SITES[provider]}`}
												target="_blank"
												rel="noopener noreferrer"
												className="text-accent underline underline-offset-2"
											>
												{PROVIDER_SITES[provider]}
											</a>
											. It's stored encrypted and used only for your requests.
										</Trans>
									</Description>
								</TextField>
								<div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-3">
									<p className="max-w-[34ch] text-xs leading-5 text-muted">
										<Trans>Save first, then test search and reading. No test runs automatically.</Trans>
									</p>
									<div className="ms-auto flex gap-1">
										<Button
											variant="ghost"
											isDisabled={pending}
											onPress={() => {
												setEditing(false);
												setApiKey("");
												save.reset();
											}}
										>
											<Trans>Cancel</Trans>
										</Button>
										<Button type="submit" isDisabled={pending || !apiKey.trim()} isPending={save.isPending}>
											{save.isPending && <Spinner size="sm" color="current" aria-hidden />}
											<Trans>Save connection</Trans>
										</Button>
									</div>
								</div>
							</form>
						)}
					</>
				)}
			</div>
		</SettingsSection>
	);
}
