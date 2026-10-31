import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { GithubStarsButton } from "@/components/input/github-stars-button";
import { LocaleCombobox } from "@/features/locale/combobox";
import { ThemeToggleButton } from "@/features/theme/toggle-button";

export function Header() {
	const [hidden, setHidden] = useState(false);
	const { scrollY } = useScroll();

	useMotionValueEvent(scrollY, "change", (current) => {
		setHidden(current > 32 && current > (scrollY.getPrevious() ?? 0));
	});

	return (
		<header
			data-hidden={hidden}
			className="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-background/80 backdrop-blur-lg [transition:translate_250ms_var(--ease-out-strong),opacity_300ms_var(--ease-out-strong)] data-[hidden=true]:-translate-y-full starting:opacity-0"
		>
			<nav aria-label={t`Main navigation`} className="container mx-auto flex items-center gap-x-4 p-3 lg:px-12">
				<Link to="/" className="transition-opacity hover:opacity-80" aria-label={t`Rezumi - Go to homepage`}>
					<BrandIcon className="size-10" />
				</Link>

				<div className="ml-auto flex items-center gap-x-2">
					<LocaleCombobox
						render={
							<button
								type="button"
								className={buttonVariants({ variant: "ghost", isIconOnly: true })}
								aria-label={t`Change language`}
							>
								<Icon name="translate" />
							</button>
						}
					/>

					<ThemeToggleButton />

					<div className="hidden items-center gap-x-4 sm:flex">
						<GithubStarsButton />

						<Link to="/dashboard" aria-label={t`Go to dashboard`} className={buttonVariants({ isIconOnly: true })}>
							<Icon name="arrow-right" />
						</Link>
					</div>
				</div>
			</nav>
		</header>
	);
}
