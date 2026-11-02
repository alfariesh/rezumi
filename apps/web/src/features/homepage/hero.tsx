import type { SVGProps } from "react";
import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { HeroResume } from "./resume";
import { CtaLink } from "./ui";

type StarIconProps = SVGProps<SVGSVGElement>;

function StarIcon(props: StarIconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={24}
			height={24}
			className="text-accent"
			fill="none"
			aria-hidden="true"
			{...props}
		>
			<path
				d="M22.7476 9.90039C22.7475 10.3143 22.5924 10.7114 22.3159 11.0156C21.2835 12.1509 20.1756 13.4082 18.5396 14.8633C18.7963 16.0317 19.1947 18.0206 19.438 20.3438C19.5465 21.3797 18.7242 22.25 17.7085 22.25C17.6648 22.25 17.6118 22.2489 17.5522 22.2432L17.3579 22.209C16.919 22.0978 16.2148 21.7611 15.3062 21.2637C14.4501 20.795 13.3492 20.1463 11.9995 19.3135C10.6499 20.1463 9.54966 20.795 8.69385 21.2637C7.7853 21.7612 7.08102 22.0978 6.64209 22.209C6.50303 22.2442 6.37862 22.25 6.2915 22.25C5.27581 22.25 4.45354 21.3797 4.56201 20.3438C4.80518 18.0213 5.20274 16.0328 5.45947 14.8643C3.82346 13.4092 2.7165 12.1509 1.68408 11.0156C1.40763 10.7114 1.25252 10.3143 1.25244 9.90039C1.25244 9.17156 1.73546 8.50716 2.4751 8.32617C3.40907 8.09763 5.26407 7.7019 7.83447 7.41504C8.79903 5.34207 9.91815 3.44735 10.5845 2.47949C10.917 1.99643 11.4591 1.75012 11.9995 1.75C12.54 1.75 13.0819 1.99651 13.4146 2.47949C14.0809 3.44726 15.2 5.34214 16.1646 7.41504C18.7355 7.7019 20.5908 8.0976 21.5249 8.32617C22.2645 8.50716 22.7476 9.17156 22.7476 9.90039Z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** The page's one `h1`. */
const getHeadline = () => t`Turn your experience into a resume that gets interviews.`;

// Placeholder: replace with a real, attributed quote before launch.
function HeroTestimonial() {
	return (
		<figure className="relative mx-auto max-w-md text-center lg:mx-0 lg:text-start">
			<div className="flex justify-center gap-0.5 lg:justify-start" role="img" aria-label={t`Rated 5 out of 5`}>
				{Array.from({ length: 5 }, (_, index) => (
					<StarIcon key={index} />
				))}
			</div>
			<blockquote className="mt-2">
				<p className="text-xl font-medium text-pretty">
					{t`“I tailored my resume for three roles in one evening and had two interview calls that week.”`}
				</p>
			</blockquote>
			<figcaption className="mt-2 text-sm text-muted">
				<strong className="font-semibold text-accent">Rina Wulandari</strong>, {t`Marketing Associate`}
			</figcaption>
		</figure>
	);
}

/**
 * 00 Hero. The accent panel runs off the start edge of the page with the resume standing on it; beside it, a short
 * quote over the headline and the call to action. Everything paints from the prerendered HTML, with no scripts.
 */
export function Hero() {
	return (
		<section aria-labelledby="hero-title" className="overflow-hidden bg-surface-secondary lg:bg-transparent lg:px-5">
			<div className="mx-auto grid max-w-6xl grid-cols-1 grid-rows-[auto_1fr] gap-y-16 pt-16 md:pt-20 lg:grid-cols-12 lg:gap-y-20 lg:px-3 lg:pt-20 lg:pb-36 xl:py-32">
				<div className="relative flex items-end lg:col-span-5 lg:row-span-2">
					<div className="absolute start-0 end-1/2 -top-20 -bottom-12 z-10 rounded-ee-[4rem] bg-accent md:bottom-8 lg:-inset-y-32 lg:-start-[100vw] lg:end-full lg:-me-40" />
					<div className="relative z-10 mx-auto w-full px-6 pt-8 sm:w-auto sm:px-0 sm:pt-0 lg:w-full">
						<HeroResume />
					</div>
				</div>

				<div className="relative px-4 sm:px-6 lg:col-span-7 lg:ps-16 lg:pe-0 lg:pb-14 xl:ps-20">
					<div className="hidden lg:absolute lg:-start-[100vw] lg:-end-[100vw] lg:-top-32 lg:bottom-0 lg:block lg:bg-surface-secondary" />
					<HeroTestimonial />
				</div>

				<div className="bg-background pt-16 pb-16 lg:col-span-7 lg:bg-transparent lg:ps-16 lg:pt-0 lg:pb-0 xl:ps-20">
					<div className="mx-auto px-4 sm:px-6 md:max-w-2xl md:px-4 lg:px-0">
						<h1 id="hero-title" className="text-5xl font-bold tracking-tight text-balance sm:text-6xl">
							{getHeadline()}
						</h1>
						<p className="mt-4 text-xl text-pretty text-muted sm:text-2xl">
							{t`Write it once, check what applicant tracking systems read, tailor it to every posting and follow each application to the offer.`}
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<CtaLink />
							<a href="#pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
								{t`See pricing`}
							</a>
						</div>
						<p className="mt-4 text-sm text-muted">{t`Free plan, no card needed. PDF downloads without a watermark.`}</p>
					</div>
				</div>
			</div>
		</section>
	);
}
