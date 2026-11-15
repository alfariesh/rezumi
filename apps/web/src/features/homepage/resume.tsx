import type { RefObject } from "react";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

type CalloutIcon =
	| "seal-check"
	| "sparkle"
	| "link-simple-horizontal"
	| "globe"
	| "arrows-clockwise"
	| "envelope-simple";
type CalloutNote = { icon: CalloutIcon; title: string; detail: string };

/**
 * A floating note pinned to the page: what Rezumi did to the line or the document it points at. With a second note,
 * the two share the spot and cross-fade as the page turns into the website.
 */
type CalloutProps = {
	note: CalloutNote;
	/** What the note says while the website shows, when there is one. */
	websiteNote?: CalloutNote | false;
	onWebsite: boolean;
	className?: string;
};

function Callout({ note: resumeNote, websiteNote, onWebsite, className }: CalloutProps) {
	const notes = websiteNote ? [resumeNote, websiteNote] : [resumeNote];
	const showing = websiteNote && onWebsite ? 1 : 0;
	return (
		<div className={cn("absolute z-10 grid rounded-2xl bg-overlay text-start shadow-overlay", className)}>
			{notes.map((note, index) => (
				<div
					key={note.title}
					className={cn(
						"flex items-center gap-3 py-2.5 ps-2.5 pe-4 transition-opacity duration-emphasized ease-in-out-strong [grid-area:1/1]",
						index !== showing && "opacity-0",
					)}
				>
					<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
						<Icon name={note.icon} size={18} />
					</span>
					<span className="flex flex-col">
						<span className="text-sm font-semibold whitespace-nowrap text-foreground">{note.title}</span>
						<span className="text-xs whitespace-nowrap text-muted">{note.detail}</span>
					</span>
				</div>
			))}
		</div>
	);
}

type CollaborationPointerProps = {
	label: string;
	className: string;
};

/** Decorative collaborators editing the example resume together. */
function CollaborationPointer({ label, className }: CollaborationPointerProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute z-20 flex flex-col items-start transition-[inset-inline-start,top] duration-700 ease-in-out-strong motion-reduce:transition-none",
				className,
			)}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width={24}
				height={24}
				fill="none"
				className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
			>
				<path
					d="M3.76115 2.27842L3.94963 2.33506L20.9565 8.87607C22.0473 9.29561 22.0122 10.8509 20.9037 11.2208L13.644 13.6397L11.225 20.8995C10.8551 22.008 9.29983 22.043 8.88029 20.9522L2.33928 3.94541C1.976 3.00083 2.82362 2.07159 3.76115 2.27842Z"
					fill="currentColor"
					stroke="white"
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			</svg>
			<span className="ms-5 -mt-1 rounded-lg rounded-tl-none bg-current px-2 pt-0.5 pb-1">
				<span className="block text-[9px] leading-tight font-medium whitespace-nowrap text-white sm:text-[10px]">
					{label}
				</span>
			</span>
		</div>
	);
}

type Phase = "resume" | "portfolio";

/**
 * The hero's loop once portfolios are open: the website holds, turns into the resume behind it while the agent
 * rewrites the tailored line, then becomes the website again. It runs only while the hero is on screen and never under reduced motion, where the
 * resume stays still. `typed` is how much of the tailored line is written; `null` is all of it, as prerendered.
 */
function useHeroLoop(enabled: boolean, ref: RefObject<HTMLDivElement | null>, lineLength: number) {
	// The website shows first, as prerendered: the portfolio leads the page, and the resume it comes from follows.
	const [phase, setPhase] = useState<Phase>(enabled ? "portfolio" : "resume");
	const [typed, setTyped] = useState<number | null>(null);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!enabled || !element) return;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
		let visible = false;
		const update = () => setRunning(visible && !reduced.matches && document.visibilityState === "visible");
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry?.isIntersecting ?? false;
			update();
		});
		observer.observe(element);
		reduced.addEventListener("change", update);
		document.addEventListener("visibilitychange", update);
		return () => {
			observer.disconnect();
			reduced.removeEventListener("change", update);
			document.removeEventListener("visibilitychange", update);
		};
	}, [enabled, ref]);

	useEffect(() => {
		if (!running) return;
		let timer: number;
		if (phase === "portfolio") {
			timer = window.setTimeout(() => {
				setPhase("resume");
				setTyped(0);
			}, 5200);
		} else if (typed !== null && typed < lineLength) {
			timer = window.setTimeout(() => setTyped(typed + 1), typed === 0 ? 700 : 28);
		} else {
			timer = window.setTimeout(() => setPhase("portfolio"), typed === null ? 3200 : 2400);
		}
		return () => window.clearTimeout(timer);
	}, [running, phase, typed, lineLength]);

	return { phase, typed };
}

type HeroPortfolioProps = {
	summary: string;
	experience: { role: string; company: string; dates: string }[];
	skills: string[];
};

/** The same person's portfolio website, drawn in the resume's spot: the address bar, the intro, two works, the career. */
function HeroPortfolio({ summary, experience, skills }: HeroPortfolioProps) {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-lg bg-paper text-foreground shadow-page">
			<div className="flex items-center gap-2 border-b border-separator bg-surface-secondary px-3 py-2">
				<span className="flex gap-1">
					<span className="size-2 rounded-full bg-default" />
					<span className="size-2 rounded-full bg-default" />
					<span className="size-2 rounded-full bg-default" />
				</span>
				<span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[10px] text-muted">
					<Icon name="lock" size={10} className="shrink-0" />
					<span className="truncate">rezumi.app/alex</span>
				</span>
			</div>

			<div className="flex flex-1 flex-col p-5 sm:p-7">
				<div className="flex items-center gap-3">
					<span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
						AM
					</span>
					<div>
						<p className="text-xl font-semibold tracking-tight">Alex Morgan</p>
						<p className="text-sm text-accent">{t`Product Designer · Jakarta`}</p>
					</div>
				</div>
				<p className="mt-3 text-[11px] leading-relaxed text-pretty">{summary}</p>
				<div className="mt-3 flex gap-1.5">
					<span className="rounded-md bg-accent px-2.5 py-1 text-[10px] font-medium text-accent-foreground">
						{t`Contact me`}
					</span>
					<span className="rounded-md px-2.5 py-1 text-[10px] font-medium ring-1 ring-separator ring-inset">
						{t`Download resume`}
					</span>
				</div>

				<p className="mt-5 text-[10px] font-semibold tracking-wide text-muted">{t`Selected work`}</p>
				<div className="mt-1.5 grid grid-cols-2 gap-2.5">
					<div>
						<div className="flex aspect-[4/3] items-end justify-center overflow-hidden rounded-md bg-linear-to-br from-accent/25 to-accent/5">
							<div className="h-4/5 w-2/5 rounded-t-lg bg-paper p-1.5 shadow-surface">
								<div className="h-1 w-2/3 rounded-full bg-foreground/60" />
								<div className="mt-1 h-1 w-full rounded-full bg-default" />
								<div className="mt-1 h-1 w-4/5 rounded-full bg-default" />
								<div className="mt-2 h-2 w-full rounded-sm bg-accent" />
							</div>
						</div>
						<p className="mt-1.5 text-[11px] font-semibold">{t`Checkout redesign`}</p>
						<p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-success">
							<Icon name="trend-up" size={12} />
							{t`+18% conversion`}
						</p>
					</div>
					<div>
						<div className="grid aspect-[4/3] grid-cols-3 content-center gap-1.5 rounded-md bg-linear-to-br from-violet-400/25 to-violet-400/5 p-3">
							{["bg-accent", "bg-violet-500", "bg-emerald-600", "bg-amber-400", "bg-foreground/70", "bg-default"].map(
								(swatch) => (
									<span key={swatch} className={cn("aspect-square rounded-full", swatch)} />
								),
							)}
						</div>
						<p className="mt-1.5 text-[11px] font-semibold">{t`Design system`}</p>
						<p className="mt-0.5 text-[10px] text-muted">{t`Used by six teams`}</p>
					</div>
				</div>

				<p className="mt-5 text-[10px] font-semibold tracking-wide text-muted">{t`Experience`}</p>
				<div className="mt-1 flex flex-col gap-1">
					{experience.map((item) => (
						<div key={item.company} className="flex items-baseline justify-between gap-2">
							<p className="text-[11px]">
								<span className="font-semibold">{item.role}</span> · {item.company}
							</p>
							<p className="shrink-0 text-[10px] text-muted tabular-nums">{item.dates}</p>
						</div>
					))}
				</div>

				<div className="mt-4 flex flex-wrap gap-1.5">
					{skills.map((skill) => (
						<span key={skill} className="rounded-md bg-surface-secondary px-2 py-0.5 text-[10px] font-medium">
							{skill}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

type HeroResumeProps = {
	/** Once portfolios are open, the resume turns into its portfolio website and back. */
	portfolioEnabled?: boolean;
};

/**
 * The hero's resume: a real-looking page in place of a product shot, with the three things Rezumi does to it called
 * out (the ATS check, a line tailored to the posting, the shared link) and three collaborators editing it. Once
 * portfolios are open it loops: the page becomes the same person's website, the pointers move onto it, and the notes
 * change to what the website does. The page is paper, so it stays light in the dark theme. Decorative: the headline
 * beside it says the same in words.
 */
export function HeroResume({ portfolioEnabled = false }: HeroResumeProps) {
	const ref = useRef<HTMLDivElement>(null);
	const tailoredLine = t`Led the redesign of checkout, lifting conversion by 18% in two quarters.`;
	const tailoredCharacters = Array.from(tailoredLine);
	const { phase, typed } = useHeroLoop(portfolioEnabled, ref, tailoredCharacters.length);
	const onWebsite = phase === "portfolio";
	const typing = typed !== null && typed < tailoredCharacters.length;

	const summary = t`Product designer with seven years of experience turning complex flows into simple, measurable products.`;
	const experience = [
		{
			role: t`Senior Product Designer`,
			company: "Lumen Labs",
			dates: t`2022 – Present`,
			bullets: [
				{ text: tailoredLine, tailored: true },
				{ text: t`Built the design system used by six product teams.`, tailored: false },
			],
		},
		{
			role: t`Product Designer`,
			company: "Parcel & Co.",
			dates: t`2019 – 2022`,
			bullets: [{ text: t`Shipped the courier app for iOS and Android to 40,000 drivers.`, tailored: false }],
		},
	];
	const skills = [t`Design systems`, t`Prototyping`, t`User research`, t`Figma`];

	return (
		<div ref={ref} aria-hidden="true" className="relative mx-auto w-full max-w-[22rem] select-none lg:max-w-none">
			<div className="light grid">
				<div
					className={cn(
						"overflow-hidden rounded-lg bg-paper p-5 text-foreground shadow-page transition-[opacity,scale,filter] duration-700 ease-in-out-strong [grid-area:1/1] sm:aspect-page sm:p-7",
						onWebsite && "scale-95 opacity-0 blur-sm",
					)}
				>
					<p className="text-xl font-semibold tracking-tight">Alex Morgan</p>
					<p className="mt-0.5 text-sm text-accent">{t`Product Designer · Jakarta`}</p>
					<p className="mt-1.5 font-mono text-[10px] text-muted">alex@morgan.design · +62 812 0000 0000</p>

					<p className="mt-5 text-[10px] font-semibold tracking-wide text-muted">{t`Summary`}</p>
					<p className="mt-1 text-[11px] leading-relaxed">{summary}</p>

					<p className="mt-4 text-[10px] font-semibold tracking-wide text-muted">{t`Experience`}</p>
					<div className="mt-1 flex flex-col gap-3">
						{experience.map((item) => (
							<div key={item.company}>
								<div className="flex items-baseline justify-between gap-2">
									<p className="text-[11px] font-semibold">
										{item.role} · {item.company}
									</p>
									<p className="shrink-0 text-[10px] text-muted tabular-nums">{item.dates}</p>
								</div>
								<ul className="mt-1 flex flex-col gap-1">
									{item.bullets.map((bullet) => (
										<li
											key={bullet.text}
											className={cn(
												"relative rounded-md text-[11px] leading-relaxed",
												bullet.tailored && "-mx-1.5 bg-accent-soft px-1.5 py-0.5 text-accent-soft-foreground",
											)}
										>
											<span className={cn(bullet.tailored && typing && "invisible")}>{bullet.text}</span>
											{bullet.tailored && typing && (
												<span className="absolute inset-0 px-1.5 py-0.5">
													{tailoredCharacters.slice(0, typed ?? 0).join("")}
													<span className="ms-px inline-block h-3 w-px translate-y-0.5 bg-violet-500" />
												</span>
											)}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>

					<p className="mt-4 text-[10px] font-semibold tracking-wide text-muted">{t`Skills`}</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{skills.map((skill) => (
							<span key={skill} className="rounded-md bg-surface-secondary px-2 py-0.5 text-[10px] font-medium">
								{skill}
							</span>
						))}
					</div>

					<p className="mt-4 text-[10px] font-semibold tracking-wide text-muted">{t`Education`}</p>
					<p className="mt-1 text-[11px]">{t`BA, Visual Communication Design · Nusantara Institute of Design`}</p>

					<p className="mt-4 text-[10px] font-semibold tracking-wide text-muted">{t`Languages`}</p>
					<p className="mt-1 text-[11px]">{t`Indonesian (native) · English (professional)`}</p>
				</div>

				{portfolioEnabled && (
					<div
						className={cn(
							"transition-[opacity,scale,clip-path] duration-700 ease-in-out-strong [grid-area:1/1]",
							onWebsite
								? "[clip-path:inset(0_0_0_0_round_0.5rem)]"
								: "scale-[1.03] opacity-0 [clip-path:inset(0_0_100%_0_round_0.5rem)]",
						)}
					>
						<HeroPortfolio summary={summary} experience={experience} skills={skills} />
					</div>
				)}
			</div>

			<CollaborationPointer
				label={t`You`}
				className={cn("text-accent", onWebsite ? "start-[58%] top-[3%]" : "start-[14%] top-[22%]")}
			/>
			<CollaborationPointer
				label="Rezumi Agent"
				className={cn("text-violet-500", onWebsite ? "start-[20%] top-[47%]" : "start-[48%] top-[43%]")}
			/>
			<CollaborationPointer
				label="BYOK Agent"
				className={cn("text-emerald-600", onWebsite ? "start-[66%] top-[76%]" : "start-[24%] top-[72%]")}
			/>

			<Callout
				note={{ icon: "seal-check", title: t`ATS readable`, detail: t`94 of 100 checks passed` }}
				websiteNote={portfolioEnabled && { icon: "globe", title: t`Published`, detail: "rezumi.app/alex" }}
				onWebsite={onWebsite}
				className="-end-3 -top-10 sm:-end-10 sm:top-10"
			/>
			<Callout
				note={{ icon: "sparkle", title: t`Tailored to the posting`, detail: t`Lead Designer, Northwind` }}
				websiteNote={
					portfolioEnabled && {
						icon: "arrows-clockwise",
						title: t`Synced from your resume`,
						detail: t`Experience and skills`,
					}
				}
				onWebsite={onWebsite}
				className="-start-10 top-[46%] max-sm:hidden"
			/>
			<Callout
				note={{ icon: "link-simple-horizontal", title: t`Shared at your link`, detail: t`Opened 12 times this week` }}
				websiteNote={
					portfolioEnabled && {
						icon: "envelope-simple",
						title: t`3 new messages`,
						detail: t`From your contact form`,
					}
				}
				onWebsite={onWebsite}
				className="-end-8 bottom-8 max-sm:hidden"
			/>
		</div>
	);
}
