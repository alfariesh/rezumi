import { Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { BentoCard } from "./bento-card";
import { Container, SectionHeading, SectionTitle } from "./ui";

/** A resume page in miniature: bars for lines, one of them marked as the line being edited. */
function MiniPage({ className }: { className?: string }) {
	const widths = ["w-1/2", "w-full", "w-11/12", "w-4/5", "w-full", "w-2/3", "w-11/12", "w-3/4"];
	return (
		<div className={cn("light aspect-page rounded-md bg-paper p-4 shadow-page", className)}>
			<div className="h-2.5 w-2/3 rounded-full bg-foreground/80" />
			<div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-accent/60" />
			<div className="mt-4 flex flex-col gap-1.5">
				{widths.map((width, index) => (
					<div key={index} className={cn("h-1.5 rounded-full", width, index === 3 ? "bg-accent/50" : "bg-default")} />
				))}
			</div>
		</div>
	);
}

function WriteGraphic() {
	return (
		<div className="absolute inset-0 flex items-start justify-center gap-6 px-8 pt-10">
			<div className="flex w-1/2 max-w-64 flex-col gap-3 text-sm">
				<div>
					<p className="text-xs text-muted">{t`Position`}</p>
					<p className="mt-1 rounded-xl bg-surface-secondary px-3 py-2">{t`Senior Product Designer`}</p>
				</div>
				<div>
					<p className="text-xs text-muted">{t`Company`}</p>
					<p className="mt-1 rounded-xl bg-surface-secondary px-3 py-2">Lumen Labs</p>
				</div>
				<div>
					<p className="text-xs text-muted">{t`Highlight`}</p>
					<p className="mt-1 rounded-xl bg-surface-secondary px-3 py-2 ring-2 ring-accent">
						{t`Led the checkout redesign`}
						<span className="ms-0.5 inline-block h-4 w-px translate-y-0.5 bg-accent motion-safe:animate-pulse" />
					</p>
				</div>
			</div>
			<MiniPage className="w-2/5 max-w-44 translate-y-2" />
		</div>
	);
}

function DesignGraphic() {
	const fan = [
		{ id: "azurill", className: "-rotate-8 -translate-x-[70%] group-hover:-translate-x-[85%]" },
		{ id: "bronzor", className: "rotate-8 translate-x-[70%] group-hover:translate-x-[85%]" },
		{ id: "onyx", className: "z-10 -translate-y-2" },
	];
	return (
		<div className="absolute inset-0 flex items-start justify-center pt-10">
			{fan.map(({ id, className }) => (
				<img
					key={id}
					src={`/templates/thumb/${id}-small.webp`}
					alt=""
					width={300}
					height={424}
					loading="lazy"
					decoding="async"
					className={cn(
						"absolute w-36 rounded-md bg-white shadow-page transition-transform duration-emphasized ease-enter",
						className,
					)}
				/>
			))}
		</div>
	);
}

function CheckGraphic() {
	const checks = [
		{ label: t`Text in reading order`, passed: true },
		{ label: t`Contact details found`, passed: true },
		{ label: t`Standard section headings`, passed: true },
		{ label: t`Two bullets run over two lines`, passed: false },
	];
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-5 px-8">
			<p className="flex items-baseline gap-1">
				<span className="text-6xl font-semibold tracking-tight tabular-nums">94</span>
				<span className="text-lg text-muted tabular-nums">/100</span>
			</p>
			<ul className="flex flex-col gap-2.5 text-sm">
				{checks.map((check) => (
					<li key={check.label} className="flex items-center gap-2.5">
						<Icon
							name={check.passed ? "check-circle" : "warning-circle"}
							size={18}
							className={check.passed ? "text-success" : "text-warning"}
						/>
						{check.label}
					</li>
				))}
			</ul>
		</div>
	);
}

function TailorGraphic() {
	const matched = [t`Design systems`, t`Prototyping`, t`Stakeholders`];
	const missing = [t`A/B testing`, t`Accessibility`];
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-4 px-8">
			<div>
				<p className="text-xs text-muted">{t`Job posting`}</p>
				<p className="mt-1 font-medium">{t`Lead Designer · Northwind`}</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{matched.map((keyword) => (
					<Chip key={keyword} color="success" variant="soft">
						<Icon name="check" size={14} />
						<Chip.Label>{keyword}</Chip.Label>
					</Chip>
				))}
				{missing.map((keyword) => (
					<Chip key={keyword}>{keyword}</Chip>
				))}
			</div>
			<p className="text-sm text-muted">{t`3 of 5 keywords on your resume`}</p>
		</div>
	);
}

function ShareGraphic() {
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-4 px-8">
			<div className="flex items-center gap-2 rounded-full bg-surface-secondary px-4 py-2.5 text-sm">
				<Icon name="lock" size={16} className="text-muted" />
				<span className="truncate">rezumi.app/alex/product-designer</span>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="rounded-2xl bg-surface-secondary p-4">
					<p className="text-xs text-muted">{t`Views`}</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">128</p>
				</div>
				<div className="rounded-2xl bg-surface-secondary p-4">
					<p className="text-xs text-muted">{t`Downloads`}</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums">14</p>
				</div>
			</div>
		</div>
	);
}

function TrackerGraphic() {
	const columns = [
		{ label: t`Saved`, dot: "bg-stage-saved", cards: [["Kopi Kita", t`Brand Designer`]] },
		{
			label: t`Applied`,
			dot: "bg-stage-applied",
			cards: [
				["Northwind", t`Lead Designer`],
				["Arunika", t`UX Designer`],
			],
		},
		{ label: t`Interview`, dot: "bg-stage-interview", cards: [["Sagara Digital", t`Product Designer`]] },
		{ label: t`Offer`, dot: "bg-stage-offer", cards: [["Lumen Labs", t`Design Lead`]] },
	];
	return (
		<div className="absolute inset-0 grid grid-cols-4 gap-3 px-8 pt-10">
			{columns.map((column) => (
				<div key={column.label} className="flex min-w-0 flex-col gap-2">
					<p className="flex items-center gap-1.5 text-xs font-medium text-muted">
						<span className={cn("size-2 shrink-0 rounded-full", column.dot)} />
						<span className="truncate">{column.label}</span>
					</p>
					{column.cards.map(([company, role]) => (
						<div key={company} className="rounded-xl bg-surface-secondary p-3">
							<p className="truncate text-sm font-medium">{company}</p>
							<p className="truncate text-xs text-muted">{role}</p>
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function LetterGraphic() {
	return (
		<div className="absolute inset-0 flex justify-center pt-10">
			<div className="light w-56 rounded-md bg-paper p-5 text-foreground shadow-page">
				<p className="text-xs font-medium">{t`Dear hiring team,`}</p>
				<div className="mt-3 flex flex-col gap-1.5">
					{["w-full", "w-11/12", "w-full", "w-3/4", "w-full", "w-5/6"].map((width, index) => (
						<div key={index} className={cn("h-1.5 rounded-full bg-default", width)} />
					))}
				</div>
			</div>
		</div>
	);
}

function InterviewGraphic() {
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-3 px-8">
			<div className="rounded-2xl bg-surface-secondary p-4">
				<p className="text-xs text-muted">{t`Practice question`}</p>
				<p className="mt-1 text-sm font-medium text-pretty">{t`Tell me about a time you led a redesign.`}</p>
			</div>
			<div className="flex items-center gap-2">
				<Chip color="accent" variant="soft">
					<Icon name="microphone" size={14} />
					<Chip.Label className="tabular-nums">01:24</Chip.Label>
				</Chip>
				<Chip color="success" variant="soft">
					{t`Clear structure`}
				</Chip>
			</div>
		</div>
	);
}

function AssistantGraphic() {
	return (
		<div className="absolute inset-0 flex flex-col justify-center gap-3 px-8 text-sm">
			<p className="max-w-[80%] self-end rounded-2xl rounded-ee-md bg-accent px-4 py-2.5 text-accent-foreground">
				{t`Tailor my resume to the Northwind posting.`}
			</p>
			<div className="flex max-w-[85%] flex-col items-start gap-2 self-start rounded-2xl rounded-es-md bg-surface-secondary px-4 py-3">
				<p className="text-pretty">
					{t`Done. I rewrote 6 bullets around design systems and prototyping and kept your numbers. Review the changes before you save.`}
				</p>
				<Chip size="sm">{t`5 credits`}</Chip>
			</div>
		</div>
	);
}

/**
 * 01 Features, as two bento grids: the resume itself on the light grid, then the rest of the job search on a dark band.
 * Each tile's drawing is made of the same HeroUI surfaces as the app, so it follows the theme.
 */
export function Features() {
	return (
		<section id="features" aria-labelledby="features-title" className="scroll-mt-20 pt-20 sm:pt-28">
			<Container>
				<SectionHeading section="features" id="features-title" />
				<SectionTitle>{t`Everything you need to reach the interview.`}</SectionTitle>
				<p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
					{t`From the first line to the shared link, every step of the resume lives in one editor.`}
				</p>

				<div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6">
					<BentoCard
						eyebrow={t`Write`}
						title={t`A live page beside every edit`}
						description={t`Type in the form and watch the page update. Undo anything, and pick up on any device.`}
						graphic={<WriteGraphic />}
						fade={["bottom"]}
						className="max-lg:rounded-t-[2rem] lg:col-span-3 lg:rounded-ss-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Design`}
						title={t`Switch templates without rewriting`}
						description={t`Your words stay put while the layout, fonts and colors change around them.`}
						graphic={<DesignGraphic />}
						fade={["bottom"]}
						className="lg:col-span-3 lg:rounded-se-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Check`}
						title={t`See what ATS software reads`}
						description={t`The checker shows the text a parser extracts and what to fix first.`}
						graphic={<CheckGraphic />}
						className="lg:col-span-2 lg:rounded-es-[2rem]"
					/>
					<BentoCard
						eyebrow={t`Tailor`}
						title={t`Match every posting`}
						description={t`Compare your resume with the job's keywords, then make a version just for it.`}
						graphic={<TailorGraphic />}
						className="lg:col-span-2"
					/>
					<BentoCard
						eyebrow={t`Share`}
						title={t`Send a link, not an attachment`}
						description={t`One address that always shows your latest version, public or behind a password.`}
						graphic={<ShareGraphic />}
						className="max-lg:rounded-b-[2rem] lg:col-span-2 lg:rounded-ee-[2rem]"
					/>
				</div>
			</Container>

			<div className="dark mt-20 bg-background py-20 text-foreground sm:mt-28 sm:py-28">
				<Container>
					<p className="text-sm font-semibold text-accent">{t`Beyond the resume`}</p>
					<p className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
						{t`Follow every application all the way to the offer.`}
					</p>

					<div className="mt-10 grid grid-cols-1 gap-4 sm:mt-16 lg:grid-cols-6">
						<BentoCard
							eyebrow={t`Track`}
							title={t`Every application on one board`}
							description={t`Move each job from saved to offer, with notes, dates and the resume you sent.`}
							graphic={<TrackerGraphic />}
							fade={["bottom"]}
							className="max-lg:rounded-t-[2rem] lg:col-span-4 lg:rounded-ss-[2rem]"
						/>
						<BentoCard
							eyebrow={t`Write letters`}
							title={t`Cover letters that match`}
							description={t`Letters share your resume's design and live beside the job they are for.`}
							graphic={<LetterGraphic />}
							className="lg:col-span-2 lg:rounded-se-[2rem]"
						/>
						<BentoCard
							eyebrow={t`Prepare`}
							title={t`Walk in ready`}
							description={t`Practice answers from stories you wrote once, then debrief after each round.`}
							graphic={<InterviewGraphic />}
							className="lg:col-span-2 lg:rounded-es-[2rem]"
						/>
						<BentoCard
							eyebrow={t`Assistant`}
							title={t`AI that works on your real documents`}
							description={t`Ask for a tailored version, a cover letter or interview practice. Pro AI includes the credits; any plan can use your own key.`}
							graphic={<AssistantGraphic />}
							className="max-lg:rounded-b-[2rem] lg:col-span-4 lg:rounded-ee-[2rem]"
						/>
					</div>
				</Container>
			</div>
		</section>
	);
}
