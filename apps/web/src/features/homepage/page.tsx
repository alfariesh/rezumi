import { t } from "@lingui/core/macro";
import { Closing } from "./closing";
import { Faq } from "./faq";
import { Features } from "./features";
import { LandingFooter } from "./footer";
import { Hero } from "./hero";
import { Introduction } from "./introduction";
import { PortfolioShowcase } from "./portfolio";
import { Pricing } from "./pricing";
import { SectionNav } from "./section-nav";
import { Templates } from "./templates";
import { Testimonials } from "./testimonials";

/**
 * The public landing page, built from HeroUI surfaces and tokens: a hero with an example resume on the accent panel,
 * a short introduction, then numbered sections under a sticky bar (features as bento grids, templates, testimonials,
 * pricing, questions) and a closing call to action. The server prerenders it (prerender.tsx), so every word is in the
 * first response.
 */
type HomepageProps = { billingEnabled?: boolean; portfolioEnabled?: boolean };

export function Homepage({ billingEnabled = false, portfolioEnabled = false }: HomepageProps) {
	return (
		<div id="top" className="relative isolate overflow-x-clip bg-background text-foreground">
			<a
				href="#main"
				className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-overlay focus:ring-2 focus:ring-accent"
			>
				{t`Skip to content`}
			</a>
			<main id="main">
				<Hero />
				<Introduction />
				<SectionNav />
				<Features />
				<Templates />
				{portfolioEnabled && <PortfolioShowcase billingEnabled={billingEnabled} />}
				<Testimonials />
				<Pricing billingEnabled={billingEnabled} portfolioEnabled={portfolioEnabled} />
				<Faq />
				<Closing />
			</main>
			<LandingFooter />
		</div>
	);
}
