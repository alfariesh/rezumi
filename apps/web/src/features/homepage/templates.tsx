import type { Template } from "@rezumi/schema/templates";
import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { templateLineup } from "@rezumi/schema/templates";
import { Icon } from "@rezumi/ui/components/icon";
import { freeTemplates } from "./plans";
import { Container, SectionHeading, SectionTitle } from "./ui";
import { templates } from "@/dialogs/resume/template/data";

// The free four first, then two of the layouts Plus adds.
const shown: Template[] = [...freeTemplates, "chikorita", "ditto"];

/** 02 Templates: the free ones beside a taste of the rest, each marked with the plan it comes with. */
export function Templates() {
	const { i18n } = useLingui();
	const total = i18n.number(templateLineup.length);
	const free = i18n.number(freeTemplates.length);

	return (
		<section
			id="templates"
			aria-labelledby="templates-title"
			className="scroll-mt-[calc(var(--landing-nav-height,5rem)+1rem)] py-20 sm:py-28"
		>
			<Container>
				<SectionHeading section="templates" id="templates-title" />
				<SectionTitle>{t`${total} templates. ${free} of them free.`}</SectionTitle>
				<p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
					{t`Every template exports a text-based PDF that applicant tracking systems can read. Start with the free ones and switch any time; your content stays the same.`}
				</p>

				<ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
					{shown.map((id) => {
						const name = templates[id].name;
						const isFree = freeTemplates.includes(id);
						return (
							<li key={id}>
								<img
									src={`/templates/thumb/${id}-small.webp`}
									alt={t`${name} resume template preview`}
									width={300}
									height={424}
									loading="lazy"
									decoding="async"
									className="aspect-[300/424] w-full rounded-lg bg-white object-contain shadow-surface"
								/>
								<div className="mt-3 flex items-center justify-between gap-2">
									<p className="font-medium">{name}</p>
									<Chip size="sm" variant="soft" color={isFree ? "success" : "accent"}>
										{isFree ? t`Free` : "Plus"}
									</Chip>
								</div>
							</li>
						);
					})}
				</ul>

				<Link
					to="/resume-templates"
					className="mt-10 inline-flex items-center gap-1.5 font-medium text-accent hover:underline hover:underline-offset-4"
				>
					{t`Browse all ${total} templates`}
					<Icon name="arrow-right" size={16} />
				</Link>
			</Container>
		</section>
	);
}
