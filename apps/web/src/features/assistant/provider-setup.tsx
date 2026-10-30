import type { AIProvider } from "@rezumi/ai/types";
import type { IconName } from "@rezumi/ui/components/icon";
import { Accordion, Alert, Button, Description, Input, Label, Spinner, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";

type Choice = { provider: AIProvider; label: string; model: string; icon: IconName; needsBaseURL?: boolean };

// Provider names are brands and stay untranslated.
const CHOICES: Choice[] = [
	{ provider: "openai", label: "OpenAI", model: "gpt-4.1", icon: "sparkle" },
	{ provider: "anthropic", label: "Anthropic", model: "claude-3-5-sonnet-latest", icon: "brain" },
	{ provider: "openai-compatible", label: "OpenAI-compatible", model: "", icon: "code", needsBaseURL: true },
];

/**
 * D1: connecting a provider in place. The key is stored encrypted and tested at once; the assistant is ready as soon
 * as the test passes. Settings keep every other provider and option.
 */
export function ProviderSetup() {
	const [open, setOpen] = useState<AIProvider | null>(null);

	return (
		<div className="grid gap-5 p-4">
			<div className="grid gap-1">
				<h3 className="text-base font-semibold">
					<Trans>Connect an AI provider</Trans>
				</h3>
				<p className="text-sm text-muted">
					<Trans>The assistant uses your own key. Nothing is sent anywhere until you connect one.</Trans>
				</p>
			</div>

			<Accordion
				expandedKeys={open ? [open] : []}
				onExpandedChange={(keys) => {
					const [key] = keys;
					setOpen(CHOICES.find((choice) => choice.provider === key)?.provider ?? null);
				}}
			>
				{CHOICES.map((choice) => (
					<Accordion.Item key={choice.provider} id={choice.provider}>
						<Accordion.Heading>
							<Accordion.Trigger className="gap-3 py-3">
								<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-default text-muted">
									<Icon name={choice.icon} size={20} />
								</span>
								<span className="grid min-w-0 flex-1 text-start">
									<span className="truncate text-sm font-medium">
										{choice.provider === "openai-compatible" ? <Trans>Other · OpenAI-compatible</Trans> : choice.label}
									</span>
									<span className="truncate text-xs font-normal text-muted">
										{choice.model || <Trans>Your own endpoint</Trans>}
									</span>
								</span>
								<Accordion.Indicator />
							</Accordion.Trigger>
						</Accordion.Heading>
						<Accordion.Panel>
							{/* Closed sections keep no form, so each provider's fields exist only while it is open. */}
							<Accordion.Body>{open === choice.provider && <ConnectForm choice={choice} />}</Accordion.Body>
						</Accordion.Panel>
					</Accordion.Item>
				))}
			</Accordion>

			<p className="text-xs text-muted">
				<Trans>
					More providers and options are in{" "}
					<Link to="/dashboard/settings/ai" className="text-link underline-offset-4 hover:underline">
						Settings
					</Link>
					. The rest of the app works fully without AI.
				</Trans>
			</p>
		</div>
	);
}

function ConnectForm({ choice }: { choice: Choice }) {
	const queryClient = useQueryClient();
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState(choice.model);
	const [baseURL, setBaseURL] = useState("");
	const [failure, setFailure] = useState<string | null>(null);

	const connect = useMutation({
		mutationFn: async () => {
			const created = await client.aiProviders.create({
				label: choice.label,
				provider: choice.provider,
				model: model.trim(),
				apiKey: apiKey.trim(),
				...(baseURL.trim() ? { baseURL: baseURL.trim() } : {}),
			});
			return client.aiProviders.test({ id: created.id });
		},
		onSuccess: async (tested) => {
			await queryClient.invalidateQueries({ queryKey: orpc.aiProviders.list.key() });
			setFailure(
				tested.testStatus === "success"
					? null
					: (tested.testError ?? t`The provider didn't answer. Check the key and the model.`),
			);
		},
		onError: (error) =>
			setFailure(getOrpcErrorMessage(error, { fallback: t`Couldn't connect. Check the key and try again.` })),
	});

	const ready = apiKey.trim() && model.trim() && (!choice.needsBaseURL || baseURL.trim());

	return (
		<form
			className="grid gap-4 pt-1"
			onSubmit={(event) => {
				event.preventDefault();
				if (ready) connect.mutate();
			}}
		>
			{choice.needsBaseURL && (
				<TextField fullWidth value={baseURL} onChange={setBaseURL}>
					<Label>
						<Trans>Base URL</Trans>
					</Label>
					<Input variant="secondary" placeholder="https://…/v1" />
				</TextField>
			)}
			<TextField fullWidth value={apiKey} onChange={setApiKey}>
				<Label>
					<Trans>API key</Trans>
				</Label>
				<Input variant="secondary" type="password" autoComplete="off" />
				<Description>
					<Trans>Stored encrypted and tested right away.</Trans>
				</Description>
			</TextField>
			<TextField fullWidth value={model} onChange={setModel}>
				<Label>
					<Trans>Model</Trans>
				</Label>
				<Input variant="secondary" />
			</TextField>
			{failure && (
				<Alert status="danger">
					<Alert.Indicator>
						<Icon name="warning-circle" />
					</Alert.Indicator>
					<Alert.Content>
						<Alert.Description>{failure}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			<Button type="submit" fullWidth isDisabled={!ready} isPending={connect.isPending}>
				{connect.isPending && <Spinner size="sm" color="current" aria-hidden />}
				{connect.isPending ? <Trans>Testing the connection…</Trans> : <Trans>Connect</Trans>}
			</Button>
		</form>
	);
}
