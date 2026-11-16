import { buttonVariants, Alert } from "@heroui/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";

/** The router's not-found view. Like ErrorScreen, it may render outside the root component's I18nProvider. */
export function NotFoundScreen() {
	return (
		<I18nProvider i18n={i18n}>
			<NotFoundContent />
		</I18nProvider>
	);
}

function NotFoundContent() {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<BrandIcon variant="logo" className="size-12" />

			<Alert status="default">
				<Alert.Indicator>
					<Icon name="warning" size={16} />
				</Alert.Indicator>
				<Alert.Content>
					<Alert.Title>
						<Trans>Page not found</Trans>
					</Alert.Title>
					<Alert.Description>
						<Trans>The page you're looking for may have been moved or no longer exists.</Trans>
					</Alert.Description>
				</Alert.Content>
			</Alert>

			<div className="flex items-center gap-x-2">
				<Link to="/dashboard" className={buttonVariants()}>
					<Icon name="magnifying-glass" size={16} />
					<Trans>Go to dashboard</Trans>
				</Link>

				<Link to="/" className={buttonVariants({ variant: "secondary" })}>
					<Icon name="house" size={16} />
					<Trans>Go home</Trans>
				</Link>
			</div>
		</div>
	);
}
