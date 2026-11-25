import type { PortfolioReveal } from "./save-problem";
import type { PortfolioCheckFinding } from "@rezumi/portfolio/checkup";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMemo } from "react";
import { checkPortfolio } from "@rezumi/portfolio/checkup";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { PanelGroup } from "./fields";
import { usePortfolioData } from "./store";
import { usePortfolioEditorUi } from "./ui";
import { useEditorView } from "./use-view";

/** How many works a finding names before the rest are counted. */
const NAMED_WORKS = 3;

type FindingText = { title: string; description: string };

/** A finding in the person's words: what is missing, and why it matters to a visitor. */
export function describeFinding({ id, count }: Pick<PortfolioCheckFinding, "id" | "count">): FindingText {
	switch (id) {
		case "name":
			return { title: t`Add your name`, description: t`Your page shows no name at the top.` };
		case "work-untitled":
			return {
				title: plural(count, { one: "# work has no title", other: "# works have no title" }),
				description: t`A work without a title isn't shown on your page.`,
			};
		case "whatsapp-number":
			return {
				title: t`WhatsApp is on without a number`,
				description: t`Add your number in Contact, or switch WhatsApp off.`,
			};
		case "contact":
			return {
				title: t`Visitors can't reach you`,
				description: t`Show the Contact section, or add an Email or WhatsApp button to your intro.`,
			};
		case "headline":
			return { title: t`Add a headline`, description: t`One line under your name that says what you do.` };
		case "intro-text":
			return {
				title: t`Introduce yourself`,
				description: t`Write a greeting or an About section, so visitors know who you are.`,
			};
		case "photo":
			return {
				title: t`Add a photo`,
				description: t`A face makes the page feel personal. Choose “No photo” if you'd rather not.`,
			};
		case "works":
			return { title: t`Add your first work`, description: t`Works are what most visitors come to see.` };
		case "work-cover":
			return {
				title: plural(count, { one: "# work has no cover", other: "# works have no cover" }),
				description: t`Its card on your page shows no picture.`,
			};
		case "work-summary":
			return {
				title: plural(count, { one: "# work has no summary", other: "# works have no summary" }),
				description: t`A sentence on the card tells visitors why to open it.`,
			};
		case "work-empty":
			return {
				title: plural(count, { one: "# work has nothing inside", other: "# works have nothing inside" }),
				description: t`Add text, pictures or numbers that tell its story.`,
			};
		case "image-alt":
			return {
				title: plural(count, { one: "# picture has no description", other: "# pictures have no description" }),
				description: t`Descriptions are read aloud by screen readers and help search engines.`,
			};
	}
}

/** Where a finding about the page as a whole is fixed. */
export function findingPlace(id: PortfolioCheckFinding["id"]): PortfolioReveal {
	switch (id) {
		case "whatsapp-number":
		case "contact":
			return { tab: "write", section: "contact" };
		case "works":
			return { tab: "work" };
		default:
			return { tab: "write" };
	}
}

/**
 * Publish's page check: what the page still lacks, read from the draft as a visitor would get it (`checkPortfolio`).
 * Each line opens the place to fix it. It advises only: nothing here blocks publishing.
 */
export function PageCheckGroup() {
	const data = usePortfolioData();
	const view = useEditorView();
	const findings = useMemo(() => checkPortfolio({ data, view }), [data, view]);
	const important = findings.filter((finding) => finding.level === "important");
	const suggestions = findings.filter((finding) => finding.level === "suggestion");
	const titles = useMemo(
		() => new Map(data.works.items.map((work) => [work.id, work.title.trim() || t`Untitled work`])),
		[data.works.items],
	);

	return (
		<PanelGroup icon="list-checks" title={<Trans>Page check</Trans>}>
			{findings.length === 0 ? (
				<p className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm">
					<Icon name="check-circle" size={18} className="shrink-0 text-success" />
					<Trans>Everything a visitor needs is here.</Trans>
				</p>
			) : (
				<div className="grid gap-4">
					{important.length > 0 && (
						<FindingList label={t`Fix before you share`} findings={important} titles={titles} tone="important" />
					)}
					{suggestions.length > 0 && (
						<FindingList label={t`Would make it stronger`} findings={suggestions} titles={titles} tone="suggestion" />
					)}
				</div>
			)}
		</PanelGroup>
	);
}

type FindingListProps = {
	label: string;
	findings: PortfolioCheckFinding[];
	titles: ReadonlyMap<string, string>;
	tone: PortfolioCheckFinding["level"];
};

function FindingList({ label, findings, titles, tone }: FindingListProps) {
	return (
		<div className="grid gap-1.5">
			<span className="px-1 text-xs text-muted">{label}</span>
			<ul className="grid gap-1.5">
				{findings.map((finding) => (
					<li key={finding.id}>
						<FindingRow finding={finding} titles={titles} tone={tone} />
					</li>
				))}
			</ul>
		</div>
	);
}

type FindingRowProps = Omit<FindingListProps, "label" | "findings"> & { finding: PortfolioCheckFinding };

const rowClass =
	"flex w-full items-start gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-start outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-focus";

function FindingRow({ finding, titles, tone }: FindingRowProps) {
	const { title, description } = describeFinding(finding);
	const reveal = usePortfolioEditorUi((state) => state.requestReveal);
	const icon = (
		<Icon
			name={tone === "important" ? "warning-circle" : "arrow-right"}
			size={18}
			className={cn("mt-0.5 shrink-0", tone === "important" ? "text-warning" : "text-muted")}
		/>
	);
	const text = (
		<span className="grid min-w-0 gap-0.5">
			<span className="text-sm font-medium">{title}</span>
			<span className="text-body-xs text-muted">{description}</span>
		</span>
	);

	// About the page as a whole: the row itself opens the place.
	if (finding.workIds.length === 0)
		return (
			<button
				type="button"
				className={cn(rowClass, "cursor-(--cursor-interactive) hover:bg-default")}
				onClick={() => reveal(findingPlace(finding.id))}
			>
				{icon}
				{text}
			</button>
		);

	// About works: each named work opens in Work.
	const named = finding.workIds.slice(0, NAMED_WORKS);
	const more = finding.workIds.length - named.length;
	return (
		<div className={rowClass}>
			{icon}
			<span className="grid min-w-0 gap-1.5">
				{text}
				<span className="flex flex-wrap items-center gap-1.5">
					{named.map((id) => (
						<button
							key={id}
							type="button"
							className="max-w-full cursor-(--cursor-interactive) truncate rounded-full bg-default px-2.5 py-1 text-xs font-medium outline-none hover:bg-default/70 focus-visible:ring-2 focus-visible:ring-focus"
							onClick={() => reveal({ tab: "work", workId: id })}
						>
							{titles.get(id) ?? t`Untitled work`}
						</button>
					))}
					{more > 0 && (
						<span className="text-xs text-muted">{plural(more, { one: "and # more", other: "and # more" })}</span>
					)}
				</span>
			</span>
		</div>
	);
}
