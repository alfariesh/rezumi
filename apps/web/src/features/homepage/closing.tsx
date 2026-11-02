import { t } from "@lingui/core/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { Container, CtaLink } from "./ui";

/** The closing call to action: one more invitation on the accent panel, and the Android app beside it. */
export function Closing() {
	return (
		<section aria-labelledby="closing-title" className="pb-20 sm:pb-28">
			<Container>
				<div className="relative overflow-hidden rounded-[2rem] bg-accent px-6 py-16 text-accent-foreground sm:rounded-[3rem] sm:px-16 sm:py-20">
					<div className="relative max-w-2xl">
						<h2 id="closing-title" className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
							{t`Your next resume is a few minutes away.`}
						</h2>
						<p className="mt-4 text-lg text-pretty text-accent-foreground/80">
							{t`Start from scratch or import the one you have. The free plan is yours for as long as you need it.`}
						</p>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<CtaLink variant="secondary" />
							<a
								href="https://play.google.com/store/apps/details?id=app.rezumi"
								className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-medium text-accent-foreground hover:bg-accent-foreground/10"
							>
								<Icon name="google-play-logo" size={20} />
								{t`Get it on Google Play`}
							</a>
						</div>
					</div>
				</div>
			</Container>
		</section>
	);
}
