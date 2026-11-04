import type { CareerField } from "@rezumi/schema/templates";
import { buttonVariants, Tag, TagGroup, Typography } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { careerFields, templateCareerFields, templateLayouts, templateLineup } from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { careerFieldNames, templates } from "@/dialogs/resume/template/data";
import { freeTemplates } from "@/features/homepage/plans";

export function TemplateGallery() {
	const { i18n } = useLingui();
	const count = i18n.number(templateLineup.length);
	const freeCount = i18n.number(freeTemplates.length);
	const [field, setField] = useState<CareerField | "all">("all");
	const shown = templateLineup.filter(
		(id) => field === "all" || (templateCareerFields[id] as readonly CareerField[]).includes(field),
	);

	return (
		<main id="main-content" className="min-h-svh bg-background px-5 pt-28 pb-16 text-foreground sm:px-8">
			<div className="mx-auto max-w-6xl">
				<div className="max-w-3xl">
					<Typography type="h1" className="text-balance sm:text-6xl">
						{t`${count} resume templates. Find your fit.`}
					</Typography>
					<p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
						{t`Preview every template before you sign up. The Free plan includes ${freeCount} templates and PDF downloads without a watermark. Plus and Pro AI unlock every template, plus Word and ODT downloads.`}
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
						{t`Create a free account, then choose a template included in your plan in Design. Switch layouts without rewriting your content.`}
					</p>
				</div>

				<TagGroup
					aria-label={t`Templates for a field of work`}
					selectionMode="single"
					disallowEmptySelection
					selectedKeys={[field]}
					onSelectionChange={(keys) => {
						const [key] = keys === "all" ? [] : [...keys];
						if (key) setField(key as CareerField | "all");
					}}
					className="mt-12"
				>
					<TagGroup.List className="flex-wrap">
						<Tag id="all">{t`All fields`}</Tag>
						{careerFields.map((id) => (
							<Tag key={id} id={id}>
								{i18n._(careerFieldNames[id])}
							</Tag>
						))}
					</TagGroup.List>
				</TagGroup>

				<div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
					{shown.map((id, index) => {
						const template = templates[id];
						const name = template.name;
						const layout = templateLayouts[id];
						const isFree = freeTemplates.includes(id);
						return (
							<article key={id} id={id} className="scroll-mt-24">
								{/* The sample's download shows over the bottom of the page on hover and focus, and always on touch. */}
								<div className="group relative">
									<a
										href={`/templates/pdf/${id}.pdf`}
										aria-label={t`Preview ${name} sample PDF`}
										className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
									>
										<img
											src={`/templates/thumb/${id}.webp`}
											srcSet={`/templates/thumb/${id}-small.webp 300w, /templates/thumb/${id}.webp 596w`}
											sizes="(min-width: 1024px) 363px, (min-width: 640px) 45vw, 90vw"
											alt={t`${name} resume template preview`}
											width={298}
											height={420}
											// The first row is on the first screen, and the first preview is its largest paint.
											loading={index < 3 ? "eager" : "lazy"}
											fetchPriority={index === 0 ? "high" : "auto"}
											decoding="async"
											className="aspect-[298/420] w-full rounded-lg bg-white object-contain shadow-surface"
										/>
									</a>
									<span
										aria-hidden="true"
										className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-lg bg-linear-to-t from-foreground/45 to-transparent opacity-0 transition-opacity duration-quick group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
									/>
									<a
										href={`/templates/pdf/${id}.pdf`}
										download={`${name}-resume-example.pdf`}
										aria-label={t`Download ${name} sample PDF`}
										className={buttonVariants({
											className:
												"absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 transition-opacity duration-quick group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100",
										})}
									>
										<Icon name="download-simple" size={16} />
										{t`Download sample PDF`}
									</a>
								</div>
								<Typography type="h2" className="mt-5 text-3xl">
									{name}
								</Typography>
								<p className="mt-1 text-sm font-medium text-accent-soft-foreground">
									{layout.columns === 1 ? t`One column` : t`Two columns`}
									<span aria-hidden="true"> · </span>
									{isFree ? t`Free` : t`Plus / Pro AI`}
								</p>
								<p className="mt-3 leading-relaxed text-muted">{i18n._(template.description)}</p>
							</article>
						);
					})}
				</div>

				<section aria-labelledby="layout-advice" className="my-10 border-y border-separator py-6">
					<Typography type="h2" id="layout-advice" className="text-3xl">{t`One column or two?`}</Typography>
					<p className="mt-3 max-w-3xl leading-relaxed text-muted">
						{t`One-column templates give hiring software a simple top-to-bottom reading order. Two-column templates put supporting details in a sidebar and leave more room for visual hierarchy. Choose for your content, then check the exported PDF.`}
					</p>
					<Link to="/ats-checker" className="mt-3 inline-block text-link underline underline-offset-4">
						{t`Check your resume’s ATS readability`}
					</Link>
					<p className="mt-2 text-sm text-muted">{t`Readability does not guarantee an interview or a particular ATS result.`}</p>
				</section>

				<section className="mt-16 border-t border-separator pt-8" aria-labelledby="make-it-yours">
					<Typography type="h2" id="make-it-yours">{t`Make it yours, then take it with you.`}</Typography>
					<p className="mt-3 max-w-2xl leading-relaxed text-muted">{t`Adjust fonts, colors, spacing and sections in the resume builder. Download a PDF without a watermark on every plan, or share a link. Word and ODT downloads are included with Plus and Pro AI. The PDFs above are examples to help you compare designs.`}</p>
					<Link to="/auth/register" className={buttonVariants({ className: "mt-5" })}>
						{t`Build your resume`}
					</Link>
				</section>
			</div>
		</main>
	);
}
