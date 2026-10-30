import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { toast } from "@rezumi/ui/components/toast";

const COPIED_MS = 2000;

type CopyLinkButtonProps = {
	url: string;
	disabled?: boolean;
	className?: string;
};

/** An icon button, usually an address field's trailing action, that copies `url` and shows a check for two seconds. */
export function CopyLinkButton({ url, disabled, className }: CopyLinkButtonProps) {
	const [copied, setCopied] = useState(false);
	const [, copyToClipboard] = useCopyToClipboard();
	const timer = useRef<number>(undefined);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	const copy = async () => {
		if (!(await copyToClipboard(url))) {
			toast.add({ type: "error", description: t`Couldn't copy to the clipboard. Try again.` });
			return;
		}
		setCopied(true);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
		toast.add({ description: t`Link copied` });
	};

	return (
		<IconButton
			icon={copied ? "check" : "copy"}
			label={copied ? t`Copied` : t`Copy link`}
			size="sm"
			className={className ?? ""}
			isDisabled={disabled ?? false}
			aria-live="polite"
			onPress={() => void copy()}
		/>
	);
}
