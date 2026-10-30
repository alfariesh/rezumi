import { Button, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { toast } from "@rezumi/ui/components/toast";
import { cn } from "@rezumi/utils/style";

const COPIED_MS = 1600;

type CopyTextProps = { value: string; className?: string };

/** Text that copies itself when clicked. The tooltip offers the copy, then confirms it, on touch screens too. */
export function CopyText({ value, className }: CopyTextProps) {
	const [hovered, setHovered] = useState(false);
	const [copied, setCopied] = useState(false);
	const [, copyToClipboard] = useCopyToClipboard();
	const timer = useRef<number>(undefined);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const copy = async () => {
		if (!(await copyToClipboard(value))) {
			toast.add({ type: "error", description: t`Couldn't copy to the clipboard. Try again.` });
			return;
		}
		setCopied(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
	};

	return (
		<Tooltip isOpen={hovered || copied} onOpenChange={setHovered}>
			<Button
				variant="ghost"
				size="sm"
				aria-label={t`Copy ${value}`}
				onPress={() => void copy()}
				className={cn("-mx-1 h-auto min-h-0 px-1 py-0 text-start font-normal break-all whitespace-normal", className)}
			>
				{value}
			</Button>
			<Tooltip.Content>{copied ? t`Copied` : t`Copy`}</Tooltip.Content>
			<span className="sr-only" aria-live="polite">
				{copied ? t`Copied` : ""}
			</span>
		</Tooltip>
	);
}
