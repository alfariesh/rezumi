import { buttonVariants, Alert } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link, useRouteContext } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";

/** Guests lose their work when the session ends, so the app says so and offers a way to keep it. */
export function GuestBanner() {
	const { session } = useRouteContext({ strict: false });
	if (!session?.user.isAnonymous) return null;

	return (
		<div className="px-4 pt-4">
			<Alert status="warning">
				<Alert.Indicator>
					<Icon name="warning-circle" />
				</Alert.Indicator>
				<Alert.Content>
					<Alert.Title>
						<Trans>You're using a guest account</Trans>
					</Alert.Title>
					<Alert.Description>
						<p>
							<Trans>
								Your work is lost when you sign out or the session ends. Create an account or sign in to keep your
								resumes, cover letters and applications.
							</Trans>
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							<Link to="/auth/register" className={buttonVariants({ variant: "secondary", size: "sm" })}>
								<Trans>Create account</Trans>
							</Link>
							<Link to="/auth/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
								<Trans>Sign in</Trans>
							</Link>
						</div>
					</Alert.Description>
				</Alert.Content>
			</Alert>
		</div>
	);
}
