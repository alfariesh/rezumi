import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { Container } from "./ui";

/** Why Rezumi goes past the PDF: the job search it carries on with, as a short list. */
export function Introduction() {
	const points = [
		t`Write it once, then tailor a version for every posting`,
		t`See exactly what applicant tracking systems read`,
		t`Share a live link that is always the latest version`,
		t`Follow every application from saved to offer`,
		t`Prepare for interviews from stories you wrote once`,
	];

	return (
		<section id="introduction" aria-label={t`Introduction`} className="pt-20 pb-16 sm:pb-20 md:pt-28 lg:py-28">
			<Container className="max-w-3xl text-lg text-muted lg:max-w-3xl">
				<p className="text-3xl font-semibold tracking-tight text-pretty text-foreground sm:text-4xl">
					{t`Rezumi keeps your whole job search in one place: the resume, the letters, every application and the interviews that follow.`}
				</p>
				<p className="mt-6 text-pretty">
					{t`Most resume builders stop at the PDF. The work doesn’t: each posting wants a slightly different story, recruiters reply, and interviews need preparing. So Rezumi keeps going with you.`}
				</p>
				<ul className="mt-8 flex flex-col gap-4">
					{points.map((point) => (
						<li key={point} className="flex items-start gap-3 text-foreground">
							<Icon name="check-circle" size={24} className="shrink-0 text-accent" />
							<span>{point}</span>
						</li>
					))}
				</ul>
				<p className="mt-10">
					<Link
						to="/auth/register"
						className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline hover:underline-offset-4"
					>
						{t`Start with the free plan`}
						<Icon name="arrow-right" size={16} />
					</Link>
				</p>
			</Container>
		</section>
	);
}
