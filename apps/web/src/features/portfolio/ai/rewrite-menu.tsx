import type { PortfolioAiField, PortfolioAiRewrite } from "@rezumi/schema/portfolio/ai";
import type { IconName } from "@rezumi/ui/components/icon";
import { Button, Popover } from "@heroui/react";
import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { htmlToText } from "@rezumi/portfolio/text";
import { Icon } from "@rezumi/ui/components/icon";
import { languageName, pageLocaleOf, useSourceResume } from "../editor/context";
import { usePortfolioData } from "../editor/store";
import { portfolioAiErrorMessage } from "../errors";
import { useRequestSignals } from "../images/use-request-signals";
import { toastAiChange } from "./apply";
import { aiSourceFields, useAiSource } from "@/features/billing/ai-source";
import { AiSourceMenu } from "@/features/billing/ai-source-menu";
import { client } from "@/libs/orpc/client";

type RewriteRequest = { instruction: PortfolioAiRewrite; text: string };

type AiRewriteMenuProps = {
	field: PortfolioAiField;
	/** What's in the field now: HTML for a rich field, plain text otherwise. */
	value: string;
	/** Puts new text in the field. */
	onResult: (text: string) => void;
};

/**
 * The small AI button on a long field: shorter, more professional, or in the page's language. The answer goes straight
 * into the field, as one edit Undo takes back. Closing the menu while it works cancels it, and its credit comes back.
 */
export function AiRewriteMenu({ field, value, onResult }: AiRewriteMenuProps) {
	const ai = useAiSource();
	const data = usePortfolioData();
	const resume = useSourceResume();
	const [open, setOpen] = useState(false);
	const [changed, setChanged] = useState<string | null>(null);
	const signals = useRequestSignals();
	const latest = useRef(value);
	useEffect(() => {
		latest.current = value;
	}, [value]);

	const rewrite = useMutation({
		mutationFn: (request: RewriteRequest) =>
			client.portfolio.ai.rewrite({ field, ...request, ...aiSourceFields(ai) }, { signal: signals.next() }),
	});

	if (!ai.source) return null;

	// Just the language: "Indonesian", not "Indonesian (Indonesia)".
	const language = languageName(pageLocaleOf(data, resume.data).split("-")[0] ?? "", i18n.locale);
	const empty = !htmlToText(value);
	const options: { instruction: PortfolioAiRewrite; icon: IconName; label: string }[] = [
		{ instruction: "shorter", icon: "arrows-in-line-vertical", label: t`Make it shorter` },
		{ instruction: "professional", icon: "briefcase", label: t`More professional` },
		{ instruction: "translate", icon: "translate", label: t`Translate to ${language}` },
	];

	const reset = () => {
		rewrite.reset();
		setChanged(null);
	};

	const put = (text: string) => {
		onResult(text);
		reset();
		setOpen(false);
		toastAiChange(t`Rewritten.`);
	};

	const run = (instruction: PortfolioAiRewrite) => {
		const text = value;
		setChanged(null);
		rewrite.mutate(
			{ instruction, text },
			{
				onSuccess: (result) => {
					if (latest.current === text) put(result.text);
					else setChanged(result.text);
				},
			},
		);
	};

	return (
		<Popover
			isOpen={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) return;
				signals.cancel();
				reset();
			}}
		>
			<Button
				size="sm"
				variant="ghost"
				aria-label={t`Rewrite with AI`}
				isDisabled={empty}
				className="h-7 min-h-0 gap-1 px-1.5 text-xs font-medium text-muted"
			>
				<Icon name="sparkle" size={14} />
				<Trans>AI</Trans>
			</Button>
			<Popover.Content placement="bottom end" className="w-72 max-w-[calc(100vw-2rem)]">
				<Popover.Dialog aria-label={t`Rewrite with AI`} className="grid gap-1 p-1.5">
					<span className="flex items-center justify-between gap-2 ps-2 pb-1 text-xs font-semibold text-muted">
						<Trans>Rewrite</Trans>
						<AiSourceMenu action="portfolio-rewrite" className="-my-1" />
					</span>
					{rewrite.isPending ? (
						<p role="status" className="flex items-center gap-2 p-2 text-sm text-muted">
							<Icon name="sparkle" size={16} className="animate-pulse motion-reduce:animate-none" />
							<Trans>Rewriting…</Trans>
						</p>
					) : changed !== null ? (
						<div className="grid gap-2 p-2">
							<p role="alert" className="text-xs text-danger">
								<Trans>The text changed since you asked, so it wasn't replaced.</Trans>
							</p>
							<div className="flex gap-1.5">
								<Button size="sm" onPress={() => put(changed)}>
									<Trans>Replace anyway</Trans>
								</Button>
								<Button
									size="sm"
									variant="secondary"
									onPress={() => {
										reset();
										setOpen(false);
									}}
								>
									<Trans>Keep mine</Trans>
								</Button>
							</div>
						</div>
					) : (
						options.map((option) => (
							<Button
								key={option.instruction}
								variant="ghost"
								fullWidth
								className="justify-start font-normal"
								onPress={() => run(option.instruction)}
							>
								<Icon name={option.icon} size={18} className="text-muted" />
								{option.label}
							</Button>
						))
					)}
					{rewrite.error && (
						<p role="alert" className="px-2 pb-1 text-xs text-danger">
							{portfolioAiErrorMessage(rewrite.error, t`Couldn't rewrite this. Nothing changed. Try again.`)}
						</p>
					)}
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
