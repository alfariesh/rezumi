import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { portfolioThemeLineup } from "@rezumi/schema/portfolio/themes";
import { Icon } from "@rezumi/ui/components/icon";
import { Container, SectionTitle } from "./ui";
import { themePicture } from "@/features/portfolio/themes";

type PortfolioShowcaseProps = {
	/** Plans apply to accounts: each theme shows its plan. Without plans every theme is open, so none is labelled. */
	billingEnabled?: boolean;
};

/** The portfolio, between Templates and Testimonials once portfolios are open: what it is and every theme with its plan. */
export function PortfolioShowcase({ billingEnabled = true }: PortfolioShowcaseProps) {
	const { i18n } = useLingui();
	const included = [
		t`Case studies with pictures, video, PDFs and results in numbers`,
		t`A contact form, and how many people visited`,
		t`Your career details stay in step with your resume`,
	];

	return (
		<section
			id="portfolio"
			aria-labelledby="portfolio-title"
			className="scroll-mt-[calc(var(--landing-nav-height,5rem)+1rem)] border-t border-separator py-20 sm:py-28"
		>
			<Container>
				<h2 id="portfolio-title" className="text-sm font-semibold text-accent">{t`Portfolio`}</h2>
				<SectionTitle className="mt-2">{t`Show the work behind your resume.`}</SectionTitle>
				<p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
					{t`Publish a one-page website at rezumi.app/your-name. Start from a resume, add your work, and choose a theme that suits your field.`}
				</p>

				<ul className="mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
					{included.map((item) => (
						<li key={item} className="flex gap-2 text-sm">
							<Icon name="check-circle" size={18} className="mt-0.5 shrink-0 text-accent" />
							<span>{item}</span>
						</li>
					))}
				</ul>

				<ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
					{portfolioThemeLineup.map((theme) => (
						<li key={theme.id}>
							<img
								src={themePicture(theme.id, i18n.locale)}
								alt={t`${theme.name} portfolio theme preview`}
								width={600}
								height={375}
								loading="lazy"
								decoding="async"
								className="aspect-[600/375] w-full rounded-lg bg-surface-secondary object-cover shadow-surface"
							/>
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
		</section>
	);
}
