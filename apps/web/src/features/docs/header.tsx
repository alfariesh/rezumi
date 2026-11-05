import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { ThemeToggleButton } from "@/features/theme/toggle-button";

type DocsHeaderProps = {
	signedIn: boolean;
	onOpenMenu: () => void;
};

/** The docs' top bar: the brand, the docs' own home, the theme and the one next step, to the app. */
export function DocsHeader({ signedIn, onOpenMenu }: DocsHeaderProps) {
	return (
		<header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg">
			<div className="mx-auto flex h-16 max-w-360 items-center gap-2 px-4 sm:gap-3 sm:px-6">
				<IconButton icon="sidebar-simple" label={t`Open navigation`} onPress={onOpenMenu} className="-ms-2 lg:hidden" />

				<Link to="/" className="flex items-center gap-2.5" aria-label={t`Rezumi - Go to homepage`}>
					<BrandIcon variant="icon" alt="" className="size-8" />
					<span className="hidden text-lg font-semibold sm:inline">Rezumi</span>
				</Link>
				<span aria-hidden className="h-5 w-px bg-separator" />
				<Link to="/docs" className="text-sm font-medium text-muted hover:text-foreground">
					{t`Docs`}
				</Link>

				<div className="ms-auto flex items-center gap-2">
					<ThemeToggleButton />
					{signedIn ? (
						<Link to="/dashboard" className={buttonVariants({ size: "sm", variant: "secondary" })}>
							{t`Open dashboard`}
						</Link>
					) : (
						<Link to="/auth/register" className={buttonVariants({ size: "sm" })}>
							{t`Build your resume`}
						</Link>
					)}
				</div>
			</div>
		</header>
	);
}
