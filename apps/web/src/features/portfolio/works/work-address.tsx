import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import { buttonVariants, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { isListedWork } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { usePortfolioPageUrl } from "../card/use-page-url";
import { usePortfolioOwner } from "../editor/context";
import {
	editPortfolio,
	lastSavedData,
	usePortfolioData,
	usePortfolioEditorStore,
	usePortfolioRecord,
} from "../editor/store";
import { useDraftText } from "../metrics/use-draft-text";
import { isPortfolioLive } from "../status";
import { changeWorkSlug, workSlugProblem } from "./works";
import { CopyLinkButton } from "@/features/resume/share/copy-link-button";

/** What can be typed into an address: lowercase letters, digits and dashes; spaces become dashes as they're typed. */
const asSlugInput = (text: string) =>
	text
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/[^\da-z-]/g, "")
		.slice(0, PORTFOLIO_LIMITS.text.slug);

type WorkAddressProps = { work: PortfolioWork };

/**
 * A work's page address (Phase 13 3.1): `<portfolio>/work/<slug>`. It follows the title until it's changed here;
 * either way the old address keeps working (the server forwards it). Copy, and Open page once the portfolio is live.
 */
export function WorkAddress({ work }: WorkAddressProps) {
	const id = useId();
	const data = usePortfolioData();
	const record = usePortfolioRecord();
	const { username } = usePortfolioOwner();
	const base = `${usePortfolioPageUrl(username)}/work/`;
	// Undo, redo, or a new title put another address in the data: the field shows that one.
	const [text, setText] = useDraftText(work.slug);
	const [touched, setTouched] = useState(false);
	const problem = workSlugProblem(data, work.id, text);
	const url = `${base}${work.slug}`;
	const listed = isListedWork(work) && !data.sections.hidden.includes("work");

	const change = (value: string) => {
		const slug = asSlugInput(value);
		setText(slug);
		// Checked against the data as it is now, not as this render saw it.
		const now = usePortfolioEditorStore.getState().portfolio?.data ?? data;
		if (workSlugProblem(now, work.id, slug)) return;
		editPortfolio(
			(draft) => {
				const target = draft.works.items.find((entry) => entry.id === work.id);
				if (target) changeWorkSlug(draft, target as PortfolioWork, slug, lastSavedData());
			},
			{ key: `works.${work.id}.slug` },
		);
	};

	return (
		<div className="grid gap-1.5">
			<TextField
				fullWidth
				value={text}
				isInvalid={touched && problem !== null}
				onChange={change}
				onBlur={() => {
					setTouched(true);
					// Left half-typed: the field goes back to the address the work has.
					if (problem) setText(work.slug);
				}}
				className="gap-1.5"
			>
				<Label>
					<Trans>Page address</Trans>
				</Label>
				<InputGroup variant="secondary" fullWidth>
					<InputGroup.Prefix className="max-w-[55%] shrink">
						<span dir="ltr" className="truncate font-mono text-xs text-muted" title={base}>
							{base.replace(/^https?:\/\//, "")}
						</span>
					</InputGroup.Prefix>
					<InputGroup.Input
						dir="ltr"
						spellCheck={false}
						autoCapitalize="none"
						className="font-mono text-sm"
						aria-describedby={`${id}-help`}
					/>
					<InputGroup.Suffix className="pe-1">
						<CopyLinkButton url={url} />
					</InputGroup.Suffix>
				</InputGroup>
				<FieldError>
					{problem === "taken"
						? t`Another work uses this address.`
						: t`Use lowercase letters, digits and single dashes.`}
				</FieldError>
			</TextField>
			<p id={`${id}-help`} className="px-1 text-body-xs text-muted">
				{listed ? (
					<Trans>Changing it keeps the old address working: it forwards to the new one.</Trans>
				) : (
					<Trans>This work has no page while it's hidden, has no title, or the Work section is hidden.</Trans>
				)}
			</p>
			{isPortfolioLive(record) && listed && (
				<a
					href={url}
					target="_blank"
					rel="noopener"
					className={buttonVariants({ variant: "secondary", size: "sm", className: "w-fit" })}
				>
					<Icon name="arrow-square-out" size={16} />
					<Trans>Open page</Trans>
				</a>
			)}
		</div>
	);
}
