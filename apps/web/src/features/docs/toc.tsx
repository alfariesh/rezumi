import type { DocsTocEntry } from "./types";
import { Disclosure } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useEffect, useId, useState } from "react";
import { cn } from "@rezumi/utils/style";

/** How far below the top of the window a heading counts as read: the sticky header plus a line. */
const READ_LINE = 112;

/**
 * The section being read: the last heading that has passed under the header. At the end of the page, where the last
 * short sections can never reach the top, the last one.
 */
function useActiveHeading(entries: DocsTocEntry[]) {
	const [active, setActive] = useState(entries[0]?.id);

	useEffect(() => {
		if (entries.length === 0) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			let current = entries[0]?.id;
			for (const entry of entries) {
				const element = document.getElementById(entry.id);
				if (!element) continue;
				if (element.getBoundingClientRect().top > READ_LINE) break;
				current = entry.id;
			}
			const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			setActive(atEnd && window.scrollY > 0 ? entries.at(-1)?.id : current);
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};
		schedule();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [entries]);

	return active;
}

type TocListProps = { entries: DocsTocEntry[]; active?: string | undefined; onNavigate?: () => void };

function TocList({ entries, active, onNavigate }: TocListProps) {
	return (
		<ul className="border-s border-separator">
			{entries.map((entry) => {
				const current = entry.id === active;
				return (
					<li key={entry.id}>
						<a
							href={`#${entry.id}`}
							aria-current={current ? "location" : undefined}
							onClick={onNavigate}
							className={cn(
								"-ms-px block border-s-2 border-transparent py-1 ps-3 text-sm text-pretty text-muted transition-colors hover:text-foreground",
								entry.depth === 3 && "ps-6",
								current && "border-accent font-medium text-foreground",
							)}
						>
							{entry.title}
						</a>
					</li>
				);
			})}
		</ul>
	);
}

type DocsTocProps = { entries: DocsTocEntry[] };

/** The page's sections beside it, following the reader down the page. */
export function DocsToc({ entries }: DocsTocProps) {
	const titleId = useId();
	const active = useActiveHeading(entries);
	if (entries.length === 0) return null;
	return (
		<nav aria-labelledby={titleId}>
			<p id={titleId} className="mb-3 text-xs font-semibold text-muted">
				{t`On this page`}
			</p>
			<TocList entries={entries} active={active} />
		</nav>
	);
}

/** The same list, folded above the page where there is no room beside it. */
export function DocsTocDisclosure({ entries }: DocsTocProps) {
	const [open, setOpen] = useState(false);
	if (entries.length === 0) return null;
	return (
		<Disclosure isExpanded={open} onExpandedChange={setOpen} className="rounded-xl bg-surface shadow-surface xl:hidden">
			<Disclosure.Heading>
				<Disclosure.Trigger className="flex h-11 w-full cursor-(--cursor-interactive) items-center justify-between gap-2 rounded-xl px-4 text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus">
					{t`On this page`}
					<Disclosure.Indicator className="text-muted" />
				</Disclosure.Trigger>
			</Disclosure.Heading>
			<Disclosure.Content>
				<Disclosure.Body className="px-4 pb-4">
					<nav aria-label={t`On this page`}>
						<TocList entries={entries} onNavigate={() => setOpen(false)} />
					</nav>
				</Disclosure.Body>
			</Disclosure.Content>
		</Disclosure>
	);
}
