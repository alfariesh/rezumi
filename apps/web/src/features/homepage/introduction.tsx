import { t } from "@lingui/core/macro";
import { Container } from "./ui";

type IntroductionProps = { portfolioEnabled?: boolean };

/**
 * Why Rezumi goes past the PDF, in two lines. What it does in detail is the sections' job, so nothing here repeats them.
 */
export function Introduction({ portfolioEnabled = false }: IntroductionProps) {
	return (
		<section id="introduction" aria-label={t`Introduction`} className="pt-20 pb-16 sm:pb-20 md:pt-28 lg:py-28">
			<Container className="max-w-3xl text-lg text-muted lg:max-w-3xl">
				<p className="text-3xl font-semibold tracking-tight text-pretty text-foreground sm:text-4xl">
					{portfolioEnabled
						? t`Rezumi turns your career into a portfolio website and a resume, then keeps your whole job search in one place.`
						: t`Rezumi keeps your whole job search in one place: the resume, the letters, every application and the interviews that follow.`}
				</p>
				<p className="mt-6 text-pretty">
					{t`Most resume builders stop at the PDF. The work doesn’t: each posting wants a slightly different story, recruiters reply, and interviews need preparing. So Rezumi keeps going with you.`}
				</p>
			</Container>
		</section>
	);
}
