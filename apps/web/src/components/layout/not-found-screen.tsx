import { buttonVariants, Alert } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";

export function NotFoundScreen() {
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
