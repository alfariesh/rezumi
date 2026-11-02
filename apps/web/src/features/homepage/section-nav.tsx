import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useRef, useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { cn } from "@rezumi/utils/style";
import { CtaLink, getLandingSections, landingSectionIds } from "./ui";

/**
 * The sticky bar under the introduction: one numbered link per section, the one being read marked. On phones the brand and call to action sit
 * above a horizontally scrolling row that follows the active section.
 */
export function SectionNav() {
	const { i18n } = useLingui();
	const sections = getLandingSections();
	const ref = useRef<HTMLDivElement>(null);
	const navRef = useRef<HTMLElement>(null);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);

	useEffect(() => {
		const bar = ref.current;
		if (!bar) return;
		const root = bar.closest<HTMLElement>("#top");
		let frame = 0;
		const update = () => {
			frame = 0;
			// At the bottom of the page the last section is current, however short it is.
			if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
				setActiveIndex(landingSectionIds.length - 1);
				return;
			}
			// Activate the section entering the reading area, including anchor scroll offsets.
			const readingLine = Math.max(bar.getBoundingClientRect().bottom, window.innerHeight * 0.3);
			let next: number | null = null;
			landingSectionIds.forEach((id, index) => {
				const element = document.getElementById(id);
				if (element && element.getBoundingClientRect().top <= readingLine) next = index;
			});
			setActiveIndex(next);
		};

		const scheduleUpdate = () => {
			if (!frame) frame = window.requestAnimationFrame(update);
		};
		const updateSize = () => {
			root?.style.setProperty("--landing-nav-height", `${bar.getBoundingClientRect().height}px`);
			scheduleUpdate();
		};
		const observer = new ResizeObserver(updateSize);
		observer.observe(bar);
		observer.observe(document.body);
		updateSize();
		window.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("resize", updateSize);
		return () => {
			observer.disconnect();
			window.cancelAnimationFrame(frame);
			root?.style.removeProperty("--landing-nav-height");
			window.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", updateSize);
		};
	}, []);

	useEffect(() => {
		const nav = navRef.current;
		if (!nav) return;
		const centerActiveLink = () => {
			const active = nav.querySelector<HTMLElement>('[aria-current="location"]');
			if (!active || nav.scrollWidth <= nav.clientWidth) return;
			const navBounds = nav.getBoundingClientRect();
			const activeBounds = active.getBoundingClientRect();
			nav.scrollTo({
				left: nav.scrollLeft + activeBounds.left - navBounds.left - (nav.clientWidth - activeBounds.width) / 2,
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
			});
		};
		centerActiveLink();
		const observer = new ResizeObserver(centerActiveLink);
		observer.observe(nav);
		return () => observer.disconnect();
	}, [activeIndex, i18n.locale]);

	return (
		<div
			ref={ref}
			className="sticky top-0 z-40 border-b border-separator bg-background/85 backdrop-blur-lg supports-[not(backdrop-filter:blur(0))]:bg-background"
		>
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 pt-3 lg:flex-nowrap lg:px-8 lg:pt-0">
				<a href="#top" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label={t`Rezumi, back to top`}>
					<BrandIcon variant="icon" className="size-6 lg:size-8" alt="" />
					<span className="text-base font-semibold tracking-tight lg:text-lg">Rezumi</span>
				</a>
				<nav
					ref={navRef}
					aria-label={t`Sections`}
					className="order-last w-full min-w-0 [scrollbar-width:none] overflow-x-auto lg:order-none lg:w-auto lg:flex-1"
				>
					<ol className="mx-auto flex w-max text-xs font-medium sm:text-sm lg:text-base">
						{sections.map((section, index) => {
							const active = index === activeIndex;
							return (
								<li key={section.id} className="flex shrink-0">
									<a
										href={`#${section.id}`}
										aria-current={active ? "location" : undefined}
										className={cn(
											"-mb-px flex items-center justify-center gap-2 border-b-2 px-3 py-3 whitespace-nowrap lg:flex-col lg:gap-1 lg:px-5 lg:py-5",
											active ? "border-accent text-accent" : "border-transparent text-foreground hover:bg-default",
										)}
									>
										<span
											aria-hidden="true"
											className={cn("font-mono text-xs tabular-nums", active ? "text-accent" : "text-muted")}
										>
											{String(index + 1).padStart(2, "0")}
										</span>
										{section.title}
									</a>
								</li>
							);
						})}
					</ol>
				</nav>
				<CtaLink size="sm" className="shrink-0 lg:hidden" />
				<CtaLink size="md" className="hidden shrink-0 lg:inline-flex" />
			</div>
		</div>
	);
}
