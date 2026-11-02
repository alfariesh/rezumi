import { t } from "@lingui/core/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/** A floating note pinned to the page: what Rezumi did to the line or the document it points at. */
type CalloutProps = {
	icon: "seal-check" | "sparkle" | "link-simple-horizontal";
	title: string;
	detail: string;
	className?: string;
};

function Callout({ icon, title, detail, className }: CalloutProps) {
	return (
		<div
			className={cn(
				"absolute z-10 flex items-center gap-3 rounded-2xl bg-overlay py-2.5 ps-2.5 pe-4 text-start shadow-overlay",
				className,
			)}
		>
			<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
				<Icon name={icon} size={18} />
			</span>
			<span className="flex flex-col">
				<span className="text-sm font-semibold text-foreground">{title}</span>
				<span className="text-xs text-muted">{detail}</span>
			</span>
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
		<div className={cn("pointer-events-none absolute z-20 flex flex-col items-start", className)}>
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

/**
 * The hero's resume: a real-looking page in place of a product shot, with the three things Rezumi does to it called
 * out (the ATS check, a line tailored to the posting, the shared link). The page is paper, so it stays light in the
 * dark theme. Decorative: the headline beside it says the same in words.
 */
export function HeroResume() {
	const experience = [
		{
			role: t`Senior Product Designer`,
			company: "Lumen Labs",
			dates: t`2022 – Present`,
			bullets: [
				{ text: t`Led the redesign of checkout, lifting conversion by 18% in two quarters.`, tailored: true },
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
		<div aria-hidden="true" className="relative mx-auto w-full max-w-[22rem] select-none lg:max-w-none">
			<div className="light overflow-hidden rounded-lg bg-paper p-5 text-foreground shadow-page sm:aspect-page sm:p-7">
				<p className="text-xl font-semibold tracking-tight">Alex Morgan</p>
				<p className="mt-0.5 text-sm text-accent">{t`Product Designer · Jakarta`}</p>
				<p className="mt-1.5 font-mono text-[10px] text-muted">alex@morgan.design · +62 812 0000 0000</p>

				<p className="mt-5 text-[10px] font-semibold tracking-wide text-muted">{t`Summary`}</p>
				<p className="mt-1 text-[11px] leading-relaxed">
					{t`Product designer with seven years of experience turning complex flows into simple, measurable products.`}
				</p>

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
											"rounded-md text-[11px] leading-relaxed",
											bullet.tailored && "-mx-1.5 bg-accent-soft px-1.5 py-0.5 text-accent-soft-foreground",
										)}
									>
										{bullet.text}
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

			<CollaborationPointer label={t`You`} className="start-[14%] top-[22%] text-accent" />
			<CollaborationPointer label="Rezumi Agent" className="start-[48%] top-[43%] text-violet-500" />
			<CollaborationPointer label="BYOK Agent" className="start-[24%] top-[72%] text-emerald-600" />

			<Callout
				icon="seal-check"
				title={t`ATS readable`}
				detail={t`94 of 100 checks passed`}
				className="-end-3 -top-10 sm:-end-10 sm:top-10"
			/>
			<Callout
				icon="sparkle"
				title={t`Tailored to the posting`}
				detail={t`Lead Designer, Northwind`}
				className="-start-10 top-[46%] max-sm:hidden"
			/>
			<Callout
				icon="link-simple-horizontal"
				title={t`Shared at your link`}
				detail={t`Opened 12 times this week`}
				className="-end-8 bottom-8 max-sm:hidden"
			/>
		</div>
	);
}
