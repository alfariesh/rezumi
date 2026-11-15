import type { PortfolioTheme } from "@rezumi/schema/portfolio/themes";
import type { ReactNode } from "react";
import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useState } from "react";
import { portfolioThemeLineup } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { BentoCard } from "./bento-card";
import { ThemePreview } from "./theme-preview";
import { Container, SectionHeading, SectionTitle } from "./ui";
import { themePicture } from "@/features/portfolio/themes";

type MiniBrowserProps = { address: string; className?: string; children: ReactNode };

/** A browser window in miniature: three dots, the address, then the page. The page is a website, so it stays light. */
function MiniBrowser({ address, className, children }: MiniBrowserProps) {
	return (
		<div className={cn("light overflow-hidden rounded-xl bg-paper text-foreground shadow-page", className)}>
			<div className="flex items-center gap-2 border-b border-separator bg-surface-secondary px-3 py-2">
				<span className="flex gap-1">
					<span className="size-1.5 rounded-full bg-default" />
					<span className="size-1.5 rounded-full bg-default" />
					<span className="size-1.5 rounded-full bg-default" />
				</span>
				<span className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[10px] text-muted">
					<Icon name="lock" size={10} className="shrink-0" />
					<span className="truncate">{address}</span>
				</span>
			</div>
			{children}
		</div>
	);
}

/** The resume page on the left, the website it becomes on the right, one arrow between them. */
function FromResumeGraphic() {
	const lines = ["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3", "w-11/12"];
	return (
		<div className="absolute inset-0 flex items-start justify-center gap-4 px-6 pt-10 sm:gap-6">
			<div className="light aspect-page w-1/3 max-w-40 shrink-0 rounded-md bg-paper p-3 text-foreground shadow-page">
				<div className="h-2 w-2/3 rounded-full bg-foreground/80" />
				<div className="mt-1 h-1.5 w-1/3 rounded-full bg-accent/60" />
				<div className="mt-3 flex flex-col gap-1.5">
					{lines.map((width, index) => (
						<div key={index} className={cn("h-1 rounded-full", width, index === 2 ? "bg-accent/50" : "bg-default")} />
					))}
				</div>
			</div>

			<span className="mt-16 grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground shadow-surface">
				<Icon name="arrow-right" size={16} />
			</span>

			<MiniBrowser address="rezumi.app/alex" className="w-1/2 max-w-72 shrink-0">
				<div className="p-4">
					<span className="grid size-8 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
						AM
					</span>
					<p className="mt-2 text-base font-semibold tracking-tight">Alex Morgan</p>
					<p className="text-[10px] text-muted">{t`Product Designer · Jakarta`}</p>
					<div className="mt-3 grid grid-cols-2 gap-2">
						<div className="aspect-[4/3] rounded-md bg-linear-to-br from-accent/30 to-accent/5" />
						<div className="aspect-[4/3] rounded-md bg-linear-to-br from-violet-400/30 to-violet-400/5" />
					</div>
				</div>
			</MiniBrowser>
		</div>
	);
}

/** A case study card with its result as a metric widget, before and after. */
function WorkGraphic() {
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-3 px-8">
			<div className="rounded-2xl bg-surface-secondary p-4">
				<p className="text-xs text-muted">{t`Case study · Lumen Labs`}</p>
				<p className="mt-1 font-medium">{t`Checkout redesign`}</p>
				<p className="mt-4 flex items-baseline gap-2">
					<span className="text-4xl font-semibold tracking-tight text-success tabular-nums">+18%</span>
					<span className="text-sm text-muted">{t`conversion`}</span>
				</p>
				<div className="mt-3 flex flex-col gap-1.5 text-[10px] text-muted">
					<div className="flex items-center gap-2">
						<span className="w-10 shrink-0">{t`Before`}</span>
						<span className="h-2 w-[55%] rounded-full bg-default" />
					</div>
					<div className="flex items-center gap-2">
						<span className="w-10 shrink-0">{t`After`}</span>
						<span className="h-2 w-[72%] rounded-full bg-success" />
					</div>
				</div>
			</div>
		</div>
	);
}

/** The address, this week's visitors as a small bar chart and the messages from the contact form. */
function AddressGraphic() {
	const week = ["h-[30%]", "h-[45%]", "h-[35%]", "h-[60%]", "h-[50%]", "h-[85%]", "h-[70%]"];
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-3 px-8">
			<div className="flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2.5 text-sm">
				<Icon name="globe" size={16} className="text-accent" />
				<span className="truncate">rezumi.app/alex</span>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="rounded-2xl bg-surface-secondary p-4">
					<p className="text-xs text-muted">{t`Visitors`}</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">342</p>
					<div className="mt-2 flex h-6 items-end gap-0.5">
						{week.map((height, index) => (
							<span key={index} className={cn("flex-1 rounded-sm bg-accent/60", height)} />
						))}
					</div>
				</div>
				<div className="rounded-2xl bg-surface-secondary p-4">
					<p className="text-xs text-muted">{t`Messages`}</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">3</p>
					<p className="mt-2 flex items-center gap-1 text-xs text-muted">
						<Icon name="envelope-simple" size={14} />
						{t`Contact form`}
					</p>
				</div>
			</div>
		</div>
	);
}

/** A work page at its own address, with the portfolio closed behind a password. */
function PrivateGraphic() {
	return (
		<div className="absolute inset-0 flex items-start justify-center px-8 pt-10">
			<MiniBrowser address="rezumi.app/alex/work/northwind-app" className="w-full max-w-md">
				<div className="relative p-5">
					<div aria-hidden="true" className="flex flex-col gap-2 blur-[3px]">
						<div className="h-3 w-1/2 rounded-full bg-foreground/70" />
						<div className="aspect-[3/1] rounded-lg bg-linear-to-br from-accent/30 to-accent/5" />
						<div className="h-1.5 w-full rounded-full bg-default" />
						<div className="h-1.5 w-4/5 rounded-full bg-default" />
					</div>
					<div className="absolute inset-0 grid place-items-center">
						<div className="flex w-56 flex-col items-center gap-2 rounded-2xl bg-overlay p-4 text-center shadow-overlay">
							<span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
								<Icon name="lock" size={16} />
							</span>
							<p className="text-xs font-medium">{t`This portfolio is private`}</p>
							<div className="flex w-full gap-1.5">
								<span className="flex-1 rounded-lg bg-surface-secondary px-2 py-1 text-start font-mono text-xs tracking-widest">
									••••••
								</span>
								<span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
									{t`Open`}
								</span>
							</div>
						</div>
					</div>
				</div>
			</MiniBrowser>
		</div>
	);
}

type PortfolioShowcaseProps = {
	/** Plans apply to accounts: each theme shows its plan. Without plans every theme is open, so none is labelled. */
	billingEnabled?: boolean;
};

/**
 * 01 Portfolio, the page's first section once portfolios are open: what the website does as a bento grid (the same
 * tiles as Features), then every theme with its plan and a sample to scroll through.
 */
export function PortfolioShowcase({ billingEnabled = true }: PortfolioShowcaseProps) {
	const { i18n } = useLingui();
	const total = i18n.number(portfolioThemeLineup.length);
	const [previewing, setPreviewing] = useState<PortfolioTheme | null>(null);

	return (
		<section
			id="portfolio"
			aria-labelledby="portfolio-title"
			className="scroll-mt-[calc(var(--landing-nav-height,5rem)+1rem)] pt-20 sm:pt-28"
		>
			<Container>
				<SectionHeading section="portfolio" id="portfolio-title" />
				<SectionTitle>{t`Turn your resume into a website.`}</SectionTitle>
				<p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
					{t`Publish a one-page portfolio at rezumi.app/your-name. It starts from your resume, so you only add the work behind it.`}
				</p>

				<div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6">
					<BentoCard
						eyebrow={t`Start from your resume`}
						title={t`Your resume, published as a website`}
						description={t`Experience, education and skills come from your profile and stay in step when you edit them.`}
						graphic={<FromResumeGraphic />}
						fade={["bottom"]}
						className="max-lg:rounded-t-[2rem] lg:col-span-4 lg:rounded-ss-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Show the work`}
						title={t`Case studies with results`}
						description={t`Add pictures, video, PDFs and the numbers that changed.`}
						graphic={<WorkGraphic />}
						className="lg:col-span-2 lg:rounded-se-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Get found`}
						title={t`Visitors and messages`}
						description={t`See how many people visited, and read what they sent through your contact form.`}
						graphic={<AddressGraphic />}
						className="lg:col-span-2 lg:rounded-es-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Share it your way`}
						title={t`A page for every project, a password when you need one`}
						description={t`Send a link straight to one case study, or lock the whole portfolio while it isn't for everyone.`}
						graphic={<PrivateGraphic />}
						fade={["bottom"]}
						className="max-lg:rounded-b-[2rem] lg:col-span-4 lg:rounded-ee-[2rem]"
					/>
				</div>

				<h3 className="mt-20 text-2xl font-semibold tracking-tight sm:mt-28">{t`${total} themes for every field`}</h3>
				<p className="mt-2 max-w-2xl text-pretty text-muted">
					{t`Open any theme to scroll through a whole sample page. Switch themes at any time; your content stays the same.`}
				</p>
				<ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
					{portfolioThemeLineup.map((theme) => (
						<li key={theme.id}>
							<button
								type="button"
								onClick={() => setPreviewing(theme.id)}
								aria-label={t`Preview the ${theme.name} theme`}
								className="group relative block w-full cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
							>
								<img
									src={themePicture(theme.id, i18n.locale)}
									alt={t`${theme.name} portfolio theme preview`}
									width={600}
									height={375}
									loading="lazy"
									decoding="async"
									className="aspect-[600/375] w-full rounded-lg bg-surface-secondary object-cover shadow-surface"
								/>
								<span
									aria-hidden="true"
									className="absolute inset-0 grid place-items-center rounded-lg bg-foreground/35 opacity-0 transition-opacity duration-quick group-hover:opacity-100 group-focus-visible:opacity-100"
								>
									<span className="inline-flex items-center gap-1.5 rounded-full bg-overlay px-4 py-2 text-sm font-medium text-foreground shadow-overlay">
										<Icon name="eye" size={16} />
										{t`Preview`}
									</span>
								</span>
							</button>
							<div className="mt-3 flex items-center justify-between gap-2">
								<p className="font-medium">{theme.name}</p>
								{billingEnabled && (
									<Chip size="sm" variant="soft" color={theme.plan === "free" ? "success" : "accent"}>
										{theme.plan === "free" ? t`Free` : "Plus"}
									</Chip>
								)}
							</div>
						</li>
					))}
				</ul>

				<a
					href="/docs/guides/creating-a-portfolio"
					className="mt-10 inline-flex items-center gap-1.5 font-medium text-accent hover:underline hover:underline-offset-4"
				>
					{t`See how a portfolio works`}
					<Icon name="arrow-right" size={16} />
				</a>
			</Container>

			<ThemePreview theme={previewing} onThemeChange={setPreviewing} billingEnabled={billingEnabled} />
		</section>
	);
}
