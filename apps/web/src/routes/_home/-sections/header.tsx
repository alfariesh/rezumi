import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { ArrowRightIcon, TranslateIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
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
			className="fixed inset-x-0 top-0 z-50 animate-in border-b border-transparent bg-bg/80 backdrop-blur-lg ease-out-strong animation-duration-300 [transition:translate_250ms_var(--ease-out-strong)] fade-in data-[hidden=true]:-translate-y-full"
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
								<TranslateIcon />
							</button>
						}
					/>

					<ThemeToggleButton />

					<div className="hidden items-center gap-x-4 sm:flex">
						<GithubStarsButton />

						<Link to="/dashboard" aria-label={t`Go to dashboard`} className={buttonVariants({ isIconOnly: true })}>
							<ArrowRightIcon aria-hidden="true" />
						</Link>
					</div>
				</div>
			</nav>
		</header>
	);
}
