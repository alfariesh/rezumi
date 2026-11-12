import type { SectionBodyStyle } from "../../shared/section-body";
import type { PortfolioViewEntry, PortfolioViewSection, PortfolioViewWork } from "../../view";
import type { ReactNode } from "react";
import { themeVariant } from "@rezumi/schema/portfolio/themes";
import { useRender } from "../../shared/context";
import { effectTarget, HeroHeadline, HeroName } from "../../shared/hero-text";
import { introLocation, IntroChips, OpenToWork, useIntroBackground } from "../../shared/intro";
import { MetricGroup, WorkMetric } from "../../shared/metric";
import { Buttons, ExtraSection, linkAttributes, Picture, Prose, Section, vars } from "../../shared/parts";
import { isResumeSection } from "../../shared/resume";
import { SectionBody } from "../../shared/section-body";
import { EXTRA_KINDS, groupSections } from "../../shared/sections";
import { Navigation, PageShell } from "../../shared/shell";
import { languageColor, shortHash, terminalUser } from "./data";

const GLYPHS = {
	// A repository: a book with a bookmark, drawn here (24 × 24 strokes).
	repo: (
		<>
			<path d="M5 19.5V5a2 2 0 0 1 2-2h12v14H7a2 2 0 0 0-2 2.5Z" />
			<path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H9M12 17v5l1.5-1.2L15 22v-5" />
		</>
	),
	code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" />,
} as const;

type GlyphProps = { name: keyof typeof GLYPHS };

/** Sintaks' own decorative icons; whatever they sit next to says the same in words. */
function Glyph({ name }: GlyphProps) {
	return (
		<svg
			className="sk-glyph"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{GLYPHS[name]}
		</svg>
	);
}

type WindowBarProps = { title: string };

/** A terminal window's title bar: three dots and the window's name, decoration only. */
function WindowBar({ title }: WindowBarProps) {
	return (
		<div className="sk-win__bar" aria-hidden="true">
			<i />
			<i />
			<i />
			<span dir="ltr">{title}</span>
		</div>
	);
}

type PromptProps = { command?: string; caret?: boolean };

/** A shell prompt line (`$ whoami`), decoration around the real text the page reads out. */
function Prompt({ command, caret }: PromptProps) {
	return (
		<p className="sk-cmd" aria-hidden="true">
			<span dir="ltr">
				<span className="sk-ps1">$</span>
				{command && ` ${command}`}
				{caret && <i className="sk-caret" />}
			</span>
		</p>
	);
}

function Hero() {
	const { view, messages } = useRender();
	const { hero } = view;
	const variant = themeVariant("sintaks", "hero", view.design.variants.hero);
	// The big name is the terminal alone; the other intros put the photo in a window beside it.
	const photo = variant === "big-name" ? null : hero.picture;
	const background = useIntroBackground();
	const user = terminalUser(view.basics.name);
	const headline = Boolean(view.basics.headline) || effectTarget(view) === "headline";
	return (
		<>
			<section
				className="sk-hero"
				aria-label={messages.intro}
				data-variant={photo ? variant : "big-name"}
				{...background}
			>
				<div className="sk-win sk-term">
					<WindowBar title={`${user}@portfolio: ~`} />
					<div className="sk-term__body">
						<Prompt command="whoami" />
						<HeroName className="sk-name" />
						{headline && <Prompt command="cat role.txt" />}
						<HeroHeadline className="sk-headline" />
						{hero.greeting && <p className="sk-greeting">{hero.greeting}</p>}
						<IntroChips location={introLocation(view)} availability={hero.availability} />
						<OpenToWork />
						<Buttons links={hero.buttons} />
						<Prompt caret />
					</div>
				</div>
				{photo && (
					<div className="sk-win sk-photo">
						<WindowBar title="avatar.jpg" />
						<Picture image={photo} className="sk-photo__img" eager sizes="(min-width: 761px) 320px, 200px" />
					</div>
				)}
			</section>
			{hero.highlights.length > 0 && (
				<MetricGroup metrics={hero.highlights} variant="kpi" className="sk-stats" compact />
			)}
		</>
	);
}

type LanguagesProps = { tags: readonly string[] };

/** A work's tags as a repository's languages: a dot of the tag's own colour (decoration) and its name. */
function Languages({ tags }: LanguagesProps) {
	if (!tags.length) return null;
	return (
		<ul className="sk-langs">
			{tags.map((tag) => (
				<li key={tag}>
					<i aria-hidden="true" style={vars({ "--sk-dot": languageColor(tag) })} />
					{tag}
				</li>
			))}
		</ul>
	);
}

type RepoListProps = { works: readonly PortfolioViewWork[] };

/**
 * Works as repositories. The title is the card's link to the work's page, stretched over the card; the work's main
 * link (its code, usually) is a second link above it, so the two are never nested.
 */
function RepoList({ works }: RepoListProps) {
	const { view } = useRender();
	const variant = themeVariant("sintaks", "work", view.design.variants.work);
	return (
		<ul className="sk-repos" data-variant={variant}>
			{works.map((work) => (
				<li key={work.id} className="sk-repo" data-image={Boolean(work.cover)}>
					{work.cover && (
						<span className="pf-cover sk-repo__cover">
							<Picture
								image={work.cover}
								decorative
								sizes={
									variant === "list"
										? "220px"
										: variant === "grid-3"
											? "(min-width: 961px) 360px, 100vw"
											: "(min-width: 761px) 540px, 100vw"
								}
							/>
						</span>
					)}
					<div className="sk-repo__body">
						<h3 className="sk-repo__title">
							<a className="sk-repo__link" href={work.href}>
								<Glyph name="repo" />
								<span>{work.title}</span>
							</a>
						</h3>
						{(work.role || work.date) && (
							<p className="sk-repo__meta">{[work.role, work.date].filter(Boolean).join(" · ")}</p>
						)}
						{work.summary && <p className="sk-repo__summary">{work.summary}</p>}
						{work.highlight && <WorkMetric metric={work.highlight} />}
						{(work.tags.length > 0 || work.primaryLink) && (
							<div className="sk-repo__foot">
								<Languages tags={work.tags} />
								{work.primaryLink && (
									<a
										className="sk-repo__code"
										data-pf-event="link"
										{...linkAttributes(work.primaryLink.href, work.primaryLink)}
									>
										<Glyph name="code" />
										{work.primaryLink.label}
									</a>
								)}
							</div>
						)}
					</div>
				</li>
			))}
		</ul>
	);
}

type CommitProps = { entry: PortfolioViewEntry; head?: boolean };

/** One resume entry as a commit: a short hash (decoration), what and where, when, then its text and a job's roles. */
function Commit({ entry, head = false }: CommitProps) {
	const where = entry.url ? <a {...linkAttributes(entry.url)}>{entry.subtitle || entry.url}</a> : entry.subtitle;
	return (
		<li className="sk-commit">
			<div className="sk-commit__head">
				<span className="sk-hash" aria-hidden="true">
					{shortHash(entry.id)}
				</span>
				{head && (
					<span className="sk-ref" aria-hidden="true">
						HEAD
					</span>
				)}
				<span className="sk-commit__title">
					{entry.title}
					{where && <span className="sk-commit__org"> @ {where}</span>}
				</span>
				{entry.when && <span className="sk-commit__when">{entry.when}</span>}
			</div>
			{entry.description && <Prose html={entry.description} className="sk-commit__body" />}
			{entry.roles.length > 0 && (
				<ul className="sk-commit__roles">
					{entry.roles.map((role) => (
						<li key={role.id} className="sk-commit sk-commit--role">
							<div className="sk-commit__head">
								<span className="sk-hash" aria-hidden="true">
									{shortHash(role.id)}
								</span>
								<span className="sk-commit__title">{role.title}</span>
								{role.when && <span className="sk-commit__when">{role.when}</span>}
							</div>
							{role.description && <Prose html={role.description} className="sk-commit__body" />}
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

type CommitLogProps = { entries: readonly PortfolioViewEntry[]; variant: string; ordered: boolean };

/** Experience, education, volunteering and projects as `git log`: a graph (timeline) or one line each (compact). */
function CommitLog({ entries, variant, ordered }: CommitLogProps) {
	const Tag = ordered ? "ol" : "ul";
	const shown = entries.filter((entry) => entry.title || entry.description);
	return (
		<Tag className="sk-log" data-variant={variant}>
			{shown.map((entry, index) => (
				<Commit key={entry.id} entry={entry} head={ordered && index === 0} />
			))}
		</Tag>
	);
}

type TechStackProps = { entries: readonly PortfolioViewEntry[] };

/**
 * Skills as one tech stack: every keyword (a skill without keywords by its own name), once each, with the same
 * colour dot its tag has on the repositories. The Groups variant keeps the shared groups with their names.
 */
function TechStack({ entries }: TechStackProps) {
	const chips = [
		...new Set(entries.flatMap((skill) => (skill.keywords.length ? skill.keywords : skill.title ? [skill.title] : []))),
	];
	if (!chips.length) return null;
	return (
		<ul className="pf-tags sk-stack" data-variant="chips">
			{chips.map((chip) => (
				<li key={chip}>
					<i aria-hidden="true" style={vars({ "--sk-dot": languageColor(chip) })} />
					{chip}
				</li>
			))}
		</ul>
	);
}

/** Resume sections drawn as a commit log. */
const LOG_KINDS = new Set(["experience", "education", "volunteer", "projects"]);

const SECTION_STYLE: SectionBodyStyle = {
	theme: "sintaks",
	prefix: "sk",
	work: (works) => <RepoList works={works} />,
	wrapContact: (body) => (
		<div className="sk-win sk-term sk-term--contact">
			<WindowBar title="contact.sh" />
			<div className="sk-term__body">
				<Prompt command="./contact.sh" />
				{body}
			</div>
		</div>
	),
};

type SintaksSectionBodyProps = { section: PortfolioViewSection };

/** A section's content: career sections as a commit log, everything else through the shared body. */
function SintaksSectionBody({ section }: SintaksSectionBodyProps): ReactNode {
	const { view } = useRender();
	if (isResumeSection(section)) {
		const kind = section.kind === "resume" ? section.type : section.kind;
		const { variants } = view.design;
		if (kind === "skills" && themeVariant("sintaks", "skills", variants.skills) === "chips")
			return <TechStack entries={section.entries} />;
		if (LOG_KINDS.has(kind)) {
			const variant = kind === "education" ? variants.education : kind === "projects" ? "compact" : variants.experience;
			return <CommitLog entries={section.entries} variant={variant} ordered={kind === "experience"} />;
		}
	}
	return <SectionBody section={section} style={SECTION_STYLE} />;
}

type SintaksPageProps = { year: number; creditUrl: string };

/**
 * Sintaks, for developers, data people and IT: the intro as a terminal window, works as repositories, the career as a
 * `git log`, skills as a tech stack, and Contact as a second terminal. Short lists that follow each other share a row
 * of panels; every section keeps its own anchor and heading.
 */
export function SintaksPage({ year, creditUrl }: SintaksPageProps) {
	const { view } = useRender();
	return (
		<PageShell
			theme="sintaks"
			navigation={
				<Navigation
					className="pf-wrap sk-top"
					brandClassName="sk-brand"
					brandMark={
						<span className="sk-mark" aria-hidden="true" dir="ltr">
							&gt;_
						</span>
					}
				/>
			}
			mainClassName="sk-main"
			year={year}
			creditUrl={creditUrl}
		>
			<Hero />
			{groupSections(view.sections).map((group) => {
				const first = group[0] as PortfolioViewSection;
				if (group.length > 1 && EXTRA_KINDS.has(first.kind))
					return (
						<div key={first.key} className="sk-extras">
							{group.map((section) => (
								<ExtraSection key={section.key} section={section} className="pf-section pf-extra sk-extra">
									<SintaksSectionBody section={section} />
								</ExtraSection>
							))}
						</div>
					);
				return (
					<Section key={first.key} section={first} className={`pf-section sk-section sk-section--${first.kind}`}>
						<SintaksSectionBody section={first} />
					</Section>
				);
			})}
		</PageShell>
	);
}
