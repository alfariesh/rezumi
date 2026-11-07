import type { PortfolioViewEntry, PortfolioViewSection } from "../view";
import { useRender } from "./context";
import { Prose } from "./parts";
import { linkAttributes } from "./primitives";

type CvListProps = {
	entries: readonly PortfolioViewEntry[];
	/** Experience is a numbered list: its order means something. */
	ordered?: boolean;
	variant?: string;
};

/** Experience, education, volunteering and projects: role, place, period, description, and a job's roles. */
function CvList({ entries, ordered, variant }: CvListProps) {
	const Tag = ordered ? "ol" : "ul";
	return (
		<Tag className="pf-cvlist" data-variant={variant}>
			{entries.map((entry) => {
				if (!entry.title && !entry.description) return null;
				return (
					<li key={entry.id} className="pf-cvitem">
						<div className="pf-cvitem__head">
							<span className="pf-cvitem__role">{entry.title}</span>
							{entry.when && <span className="pf-cvitem__when">{entry.when}</span>}
						</div>
						{(entry.subtitle || entry.url) && (
							<span className="pf-cvitem__org">
								{entry.url ? <a {...linkAttributes(entry.url)}>{entry.subtitle || entry.url}</a> : entry.subtitle}
							</span>
						)}
						{entry.description && <Prose html={entry.description} />}
						{entry.roles.length > 0 && (
							<ul className="pf-cvitem__roles">
								{entry.roles.map((role) => (
									<li key={role.id} className="pf-cvitem">
										<div className="pf-cvitem__head">
											<span className="pf-cvitem__role">{role.title}</span>
											{role.when && <span className="pf-cvitem__when">{role.when}</span>}
										</div>
										{role.description && <Prose html={role.description} />}
									</li>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</Tag>
	);
}

type EntriesProps = { entries: readonly PortfolioViewEntry[] };

/** Short lists (languages, certificates, awards, publications, interests, profiles): a bold line and a muted one. */
function ExtraList({ entries }: EntriesProps) {
	return (
		<ul className="pf-extralist">
			{entries.map((entry) => {
				if (!entry.title) return null;
				const detail = [entry.subtitle, entry.when, entry.keywords.join(", ")].filter(Boolean).join(" · ");
				return (
					<li key={entry.id}>
						<b>{entry.url ? <a {...linkAttributes(entry.url)}>{entry.title}</a> : entry.title}</b>
						{detail && <span>{detail}</span>}
					</li>
				);
			})}
		</ul>
	);
}

type SkillsProps = EntriesProps & { variant: string };

/** Skills as groups (a skill with its keywords) or as one row of chips. */
function Skills({ entries, variant }: SkillsProps) {
	const skills = entries.filter((skill) => skill.title || skill.keywords.length);
	if (variant === "chips" || skills.every((skill) => !skill.keywords.length)) {
		return (
			<ul className="pf-tags" data-variant="chips">
				{skills.map((skill) => (
					<li key={skill.id}>{skill.title || skill.keywords.join(", ")}</li>
				))}
			</ul>
		);
	}
	return (
		<div className="pf-skillgroups" data-variant="groups">
			{skills.map((skill) => (
				<div key={skill.id} className="pf-skillgroup">
					{skill.title && <b>{skill.title}</b>}
					{skill.keywords.length > 0 && (
						<ul className="pf-tags">
							{skill.keywords.map((keyword) => (
								<li key={keyword}>{keyword}</li>
							))}
						</ul>
					)}
				</div>
			))}
		</div>
	);
}

/** A section whose items come from the resume: a standard one, or one of the resume's own custom sections. */
type ResumeSection = Extract<PortfolioViewSection, { entries: readonly PortfolioViewEntry[] }>;

export function isResumeSection(section: PortfolioViewSection): section is ResumeSection {
	return "entries" in section;
}

type ResumeSectionBodyProps = {
	section: ResumeSection;
	/** A wrapper the theme puts around a short list (Prima's columns, Kanvas' list block). */
	listClassName?: string;
};

/**
 * The items of a section read from the resume, drawn by what they are: experience, education and volunteering as CV
 * lists, skills as groups or chips, a summary as text, short lists as a bold line and a muted one. One of the resume's
 * own custom sections draws exactly like the standard section of its type, keywords and all, in the page's variants.
 */
export function ResumeSectionBody({ section, listClassName }: ResumeSectionBodyProps) {
	const { variants } = useRender().view.design;
	const kind = section.kind === "resume" ? section.type : section.kind;
	const { entries } = section;
	switch (kind) {
		case "experience":
		case "education":
			return <CvList entries={entries} ordered={kind === "experience"} variant={variants[kind]} />;
		case "volunteer":
			return <CvList entries={entries} variant={variants.experience} />;
		case "projects":
			return <CvList entries={entries} />;
		case "skills":
			return <Skills entries={entries} variant={variants.skills} />;
		case "summary":
			return entries.map((entry) => <Prose key={entry.id} html={entry.description} />);
		default: {
			const list = <ExtraList entries={entries} />;
			return listClassName ? <div className={listClassName}>{list}</div> : list;
		}
	}
}
