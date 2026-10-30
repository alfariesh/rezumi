import { Alert, Button, Spinner } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@rezumi/utils/style";
import { isOAuthRedirect } from "../redirect";
import { authClient } from "@/libs/auth/client";
import { ENTER_CLASS } from "@/libs/motion";

type OAuthConsentPageProps = {
	oauthQuery: string;
	email: string;
};

/** Resolves with an error message, or null when Better Auth's redirect plugin takes over. */
async function requestConsent(accept: boolean, oauthQuery: string) {
	const failure = t`Couldn't complete this connection. Restart the connection from your client and try again.`;
	try {
		// This is the only point that grants access: an explicit button press.
		// Better Auth validates the signed request, session, and request origin.
		const { data, error } = await authClient.oauth2.consent({ accept, oauth_query: oauthQuery });
		if (error || !isOAuthRedirect(data)) return failure;
		// Better Auth's redirect plugin follows a successful provider response.
		return null;
	} catch {
		return failure;
	}
}

function redirectDestination(redirectUri: string | null) {
	if (!redirectUri) return null;
	try {
		const url = new URL(redirectUri);
		// Native apps return through their own scheme, which has no host.
		return url.host || url.protocol.replace(/:$/, "");
	} catch {
		return null;
	}
}

export function OAuthConsentPage({ oauthQuery, email }: OAuthConsentPageProps) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();
	const query = new URLSearchParams(oauthQuery);
	const clientId = query.get("client_id") ?? "";
	const scopes = new Set(query.get("scope")?.split(" ") ?? []);
	const validRequest = !!clientId && query.has("sig");
	// Anyone can register a client under any name, so show where the grant actually goes.
	const destination = redirectDestination(query.get("redirect_uri"));
	const {
		data: client,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["oauth-client", clientId, oauthQuery],
		enabled: validRequest,
		retry: false,
		queryFn: async () => {
			const { data, error } = await authClient.oauth2.publicClient({ query: { client_id: clientId } });
			if (error || !data)
				throw new Error(
					t`This connection request is invalid or has expired. Start the connection again from your client.`,
				);
			return data;
		},
	});

	async function submit(accept: boolean) {
		if (pending || !client || !validRequest) return;
		setPending(true);
		setError(undefined);
		const failure = await requestConsent(accept, oauthQuery);
		if (failure) {
			setError(failure);
			setPending(false);
		}
	}

	return (
		<>
			<div className="space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">
					<Trans>Connect an application</Trans>
				</h1>
				<p className="text-sm wrap-anywhere text-muted">
					<Trans>Signed in as {email}</Trans>
				</p>
			</div>
			{!validRequest || isError ? (
				<Alert key="invalid" status="danger" role="alert" className={cn(ENTER_CLASS, "bg-surface-secondary")}>
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>
							<Trans>
								This connection request is invalid or has expired. Start the connection again from your client.
							</Trans>
						</Alert.Title>
					</Alert.Content>
				</Alert>
			) : isPending ? (
				<p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
					<Spinner size="sm" color="current" aria-hidden />
					<Trans>Loading connection request...</Trans>
				</p>
			) : client ? (
				<div className={cn(ENTER_CLASS, "space-y-4")}>
					<div className="space-y-1 rounded-2xl bg-surface-secondary p-4 wrap-anywhere">
						<p className="font-medium">{client.client_name || clientId}</p>
						<p className="text-xs text-muted">
							<Trans>Client ID</Trans>: {clientId}
						</p>
						{destination && (
							<p className="text-xs text-muted">
								<Trans>Access is sent to</Trans>: <span className="font-medium text-foreground">{destination}</span>
							</p>
						)}
					</div>
					<p className="text-sm">
						<Trans>Only allow applications you trust. This application will be able to:</Trans>
					</p>
					<ul className="list-disc space-y-2 pl-5 text-sm">
						{["api:read", "api:write", "api:delete"].some((scope) => scopes.has(scope)) ? (
							<>
								{scopes.has("api:read") && (
									<li>
										<Trans>
											Read your whole account, including a full data export: your profile and email, documents, job
											applications, career data and coaching conversations.
										</Trans>
									</li>
								)}
								{scopes.has("api:write") && (
									<li>
										<Trans>
											Create and change your documents and job applications, seeing each one it changes in full, and
											change your profile and username.
										</Trans>
									</li>
								)}
								{scopes.has("api:delete") && (
									<li>
										<Trans>Delete your documents and account data.</Trans>
									</li>
								)}
							</>
						) : (
							<li>
								<Trans>
									Access your account through the API, including reading, changing and deleting your documents and job
									applications.
								</Trans>
							</li>
						)}
						{scopes.has("profile") && (
							<li>
								<Trans>Read your profile information.</Trans>
							</li>
						)}
						{scopes.has("email") && (
							<li>
								<Trans>Read your email address.</Trans>
							</li>
						)}
						{scopes.has("offline_access") && (
							<li>
								<Trans>Keep access when you are not using the application.</Trans>
							</li>
						)}
					</ul>
					{error && (
						<Alert status="danger" role="alert" className={cn(ENTER_CLASS, "bg-surface-secondary")}>
							<Alert.Indicator />
							<Alert.Content>
								<Alert.Title>{error}</Alert.Title>
							</Alert.Content>
						</Alert>
					)}
					<div className="flex gap-2">
						<Button className="flex-1" variant="secondary" isDisabled={pending} onPress={() => void submit(false)}>
							<Trans>Deny access</Trans>
						</Button>
						<Button className="flex-1" isDisabled={pending} onPress={() => void submit(true)}>
							<Trans>Allow access</Trans>
						</Button>
					</div>
				</div>
			) : null}
		</>
	);
}
