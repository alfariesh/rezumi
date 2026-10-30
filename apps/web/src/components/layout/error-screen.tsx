import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button, buttonVariants, Alert } from "@heroui/react";
import { Trans } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";

export function ErrorScreen({ reset }: ErrorComponentProps) {
	return (
		<div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-4">
			<BrandIcon variant="logo" className="size-12" />

			<Alert status="default">
				<Alert.Indicator>
					<Icon name="warning" size={16} />
				</Alert.Indicator>
				<Alert.Content>
					<Alert.Title>
						<Trans>This page didn't load</Trans>
					</Alert.Title>
					<Alert.Description>
						<Trans>An unexpected error stopped this page from loading. Try again, or go to the dashboard.</Trans>
					</Alert.Description>
				</Alert.Content>
			</Alert>

			<div className="flex items-center gap-x-2">
				<Button onPress={() => reset()}>
					<Icon name="arrow-clockwise" size={16} />
					<Trans>Try again</Trans>
				</Button>

				<Link to="/dashboard" className={buttonVariants({ variant: "secondary" })}>
					<Icon name="house" size={16} />
					<Trans>Go to dashboard</Trans>
				</Link>
			</div>
		</div>
	);
}
