import { Avatar, Card } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useQuery } from "@tanstack/react-query";
import { Container, SectionHeading, SectionTitle } from "./ui";
import { orpc } from "@/libs/orpc/client";

// The statistics service caches the totals for six hours.
const statisticsStaleTime = 6 * 60 * 60 * 1000;
// A fresh install has a handful of users; a total that small reads as a joke, so it isn't shown.
const smallestTotalShown = 100;

// Placeholder quotes for the pilot: replace them with real, attributed ones before launch.
const getQuotes = () => [
	{
		name: "Sari Anggraini",
		role: t`Finance Analyst`,
		quote: t`A recruiter asked for a Word file at the last minute. I downloaded one in the same design and sent it right away.`,
	},
	{
		name: "Dimas Prasetyo",
		role: t`Fresh graduate, Informatics`,
		quote: t`My internships and campus projects finally read like real experience. The ATS check showed me what to fix.`,
	},
	{
		name: "Ayu Lestari",
		role: t`HR Generalist`,
		quote: t`I keep one master resume and a version for every company. The tracker tells me where each one went.`,
	},
	{
		name: "Bayu Santoso",
		role: t`Backend Engineer`,
		quote: t`The English and Indonesian versions share one design, so switching languages took minutes, not an afternoon.`,
	},
	{
		name: "Nadia Putri",
		role: t`Product Designer`,
		quote: t`Sending a link instead of a PDF means recruiters always see the latest version.`,
	},
	{
		name: "Fajar Hidayat",
		role: t`Sales Executive`,
		quote: t`Practicing answers from my own stories made the second interview feel like a conversation.`,
	},
];

const initials = (name: string) =>
	name
		.split(" ")
		.map((word) => word[0])
		.join("")
		.slice(0, 2);

/** The live community totals, shown once they are big enough to mean something. */
function Totals() {
	const { i18n } = useLingui();
	const { data } = useQuery(orpc.statistics.getTotals.queryOptions({ staleTime: statisticsStaleTime }));
	const rows = [
		{ label: t`People using Rezumi`, value: data?.users },
		{ label: t`Resumes created`, value: data?.resumes },
	].filter((row): row is { label: string; value: number } => row.value != null && row.value >= smallestTotalShown);
	if (rows.length === 0) return null;

	return (
		<dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6">
			{rows.map((row) => (
				<div key={row.label} className="flex flex-col-reverse gap-1">
					<dt className="text-sm text-muted">{row.label}</dt>
					<dd className="text-4xl font-semibold tracking-tight tabular-nums">
						{i18n.number(row.value, { notation: "compact", maximumFractionDigits: 1 })}
					</dd>
				</div>
			))}
		</dl>
	);
}

/** 03 Testimonials: what people say, in three columns that flow like a wall of notes. */
export function Testimonials() {
	return (
		<section
			id="testimonials"
			aria-labelledby="testimonials-title"
			className="scroll-mt-20 bg-surface-secondary py-20 sm:py-28"
		>
			<Container>
				<SectionHeading section="testimonials" id="testimonials-title" />
				<SectionTitle>{t`People reaching the interview with Rezumi.`}</SectionTitle>
				<Totals />

				<ul className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3">
					{getQuotes().map((item) => (
						<li key={item.name} className="mb-4 break-inside-avoid">
							<Card className="p-6">
								<figure className="flex flex-col gap-4">
									<blockquote className="text-base text-pretty">
										<p>“{item.quote}”</p>
									</blockquote>
									<figcaption className="flex items-center gap-3">
										<Avatar size="sm" color="accent" variant="soft">
											<Avatar.Fallback>{initials(item.name)}</Avatar.Fallback>
										</Avatar>
										<span className="flex flex-col">
											<span className="text-sm font-semibold">{item.name}</span>
											<span className="text-xs text-muted">{item.role}</span>
										</span>
									</figcaption>
								</figure>
							</Card>
						</li>
					))}
				</ul>
			</Container>
		</section>
	);
}
