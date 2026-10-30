import { Card } from "@heroui/react";
import { Outlet } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";

export function AuthLayout() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-8">
			<Card className="gap-y-6 p-6 sm:p-8">
				<BrandIcon className="size-16 self-center [view-transition-name:auth-brand]" />

				<Outlet />
			</Card>
		</main>
	);
}
