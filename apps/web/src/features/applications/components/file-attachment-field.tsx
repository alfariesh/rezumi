import { t } from "@lingui/core/macro";
import { useRef } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";

export type FileAttachment = { url: string; name: string };

type Props = {
	// A saved attachment, a locally picked file, or nothing.
	value: FileAttachment | File | null;
	onChange: (value: File | null) => void;
	// Copy for the empty-state button, e.g. "Attach a cover letter (PDF)".
	attachLabel: string;
	disabled?: boolean;
};

/** The PDF picked in a file input, or null with an error toast when it isn't one. Clears the input either way. */
export function pickPdf(event: React.ChangeEvent<HTMLInputElement>): File | null {
	const file = event.target.files?.[0];
	event.target.value = "";
	if (!file) return null;
	if (file.type !== "application/pdf") {
		toast.add({ type: "error", description: t`Choose a PDF file.` });
		return null;
	}
	return file;
}

// Picking/removing changes only the parent's draft; the application save owns storage.
export function FileAttachmentField({ value, onChange, attachLabel, disabled }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);

	const onSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = pickPdf(event);
		if (file) onChange(file);
	};

	return (
		<>
			{value ? (
				<div className="flex items-center gap-3 rounded-xl border border-separator p-2.5">
					<span className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent-soft-foreground">
						<Icon name="file-pdf" size={16} />
					</span>
					{value instanceof File ? (
						<span className="min-w-0 flex-1 truncate text-sm">{value.name}</span>
					) : (
						<a
							href={value.url}
							target="_blank"
							rel="noreferrer"
							className="min-w-0 flex-1 truncate text-sm hover:underline"
						>
							{value.name}
						</a>
					)}
					<button
						type="button"
						title={t`Remove file`}
						disabled={disabled}
						className="text-muted hover:text-danger-soft-foreground disabled:opacity-40"
						onClick={() => onChange(null)}
					>
						<Icon name="x" size={16} />
					</button>
				</div>
			) : (
				<button
					type="button"
					disabled={disabled}
					onClick={() => inputRef.current?.click()}
					className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border p-2.5 text-sm text-muted transition-[background-color,opacity] hover:bg-default/50 disabled:opacity-60"
				>
					<Icon name="upload-simple" size={16} />
					{attachLabel}
				</button>
			)}
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf"
				className="hidden"
				disabled={disabled}
				onChange={onSelect}
			/>
		</>
	);
}
