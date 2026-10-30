import { buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { templateLayouts, templateSchema } from "@rezumi/schema/templates";
import { templates } from "@/dialogs/resume/template/data";

export function TemplateGallery() {
	const { i18n } = useLingui();
	const count = i18n.number(templateSchema.options.length);

	return (
		<main id="main-content" className="min-h-svh bg-background px-5 pt-28 pb-16 text-foreground sm:px-8">
			<div className="mx-auto max-w-6xl">
				<div className="max-w-3xl">
					<h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-6xl">
						{t`${count} free resume templates. Find your fit.`}
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
						{t`Compare real resume layouts before you sign up. Every template is free to customize, with PDF and Word downloads and no watermark.`}
					</p>
					<div className="mt-6 flex flex-wrap items-center gap-4">
						<Link to="/auth/register" className={buttonVariants()}>
							{t`Build your resume`}
						</Link>
						<a
							href="https://docs.rezumi.app/guides/choosing-a-template"
							className="text-link underline underline-offset-4"
						>
							{t`How to choose a template`}
						</a>
					</div>
					<p className="mt-3 text-sm text-muted">
						{t`Create a free account, then choose your template in Design. Switch layouts anytime without rewriting your content.`}
					</p>
				</div>

				<div className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
					{templateSchema.options.map((id, index) => {
						const template = templates[id];
						const name = template.name;
						const layout = templateLayouts[id];
						return (
							<article key={id} id={id} className="scroll-mt-24">
								<a
									href={`/templates/pdf/${id}.pdf`}
									aria-label={t`Preview ${name} sample PDF`}
									className="block rounded-3xl bg-default p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
								>
									<img
										src={`/templates/thumb/${id}.webp`}
										srcSet={`/templates/thumb/${id}-small.webp 300w, /templates/thumb/${id}.webp 596w`}
										sizes="298px"
										alt={t`${name} resume template preview`}
										width={298}
										height={420}
										// The first row is on the first screen, and the first preview is its largest paint.
										loading={index < 3 ? "eager" : "lazy"}
										fetchPriority={index === 0 ? "high" : "auto"}
										decoding="async"
										className="mx-auto aspect-[298/420] w-full max-w-74.5 rounded-sm bg-white object-contain shadow-surface"
									/>
								</a>
								<h2 className="mt-5 text-2xl font-semibold">{name}</h2>
								<p className="mt-1 text-sm font-medium text-accent-soft-foreground">
									{layout.columns === 1 ? t`One column` : t`Two columns`}
								</p>
								<p className="mt-3 leading-relaxed text-muted">{i18n._(template.description)}</p>
								<a
									href={`/templates/pdf/${id}.pdf`}
									download={`${name}-resume-example.pdf`}
									className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-link underline underline-offset-4"
									aria-label={t`Download ${name} sample PDF`}
								>
									{t`Download sample PDF`}
								</a>
							</article>
						);
					})}
				</div>

				<section aria-labelledby="layout-advice" className="my-10 border-y border-separator py-6">
					<h2 id="layout-advice" className="text-2xl font-semibold">{t`One column or two?`}</h2>
					<p className="mt-3 max-w-3xl leading-relaxed text-muted">
						{t`One-column templates give hiring software a simple top-to-bottom reading order. Two-column templates put supporting details in a sidebar and leave more room for visual hierarchy. Choose for your content, then check the exported PDF.`}
					</p>
					<Link to="/ats-checker" className="mt-3 inline-block text-link underline underline-offset-4">
						{t`Check your resume’s ATS readability`}
					</Link>
					<p className="mt-2 text-sm text-muted">{t`Readability does not guarantee an interview or a particular ATS result.`}</p>
				</section>

				<section className="mt-16 border-t border-separator pt-8" aria-labelledby="make-it-yours">
					<h2
						id="make-it-yours"
						className="text-3xl font-semibold tracking-tight"
					>{t`Make it yours, then take it with you.`}</h2>
					<p className="mt-3 max-w-2xl leading-relaxed text-muted">{t`Adjust fonts, colors, spacing and sections in the resume builder. Export your finished resume to PDF or Word, or share a link. The PDFs above are examples to help you compare designs.`}</p>
					<Link to="/auth/register" className={buttonVariants({ className: "mt-5" })}>
						{t`Build your resume`}
					</Link>
				</section>
			</div>
		</main>
	);
}
