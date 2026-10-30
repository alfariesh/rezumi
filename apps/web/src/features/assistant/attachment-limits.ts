import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { toast } from "@rezumi/ui/components/toast";

// Per message. The server allows up to 25 MB a file (packages/api/src/features/agent/service.ts); the app asks for
// 5 MB. A thread's and an account's totals are checked there only: the client doesn't know them.
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

type UploadCheck = { accepted: File[]; problems: string[] };

/** Splits chosen files into those that can be uploaded and the reasons the rest can't. */
export function checkUploads(files: readonly File[], attached: number): UploadCheck {
	const accepted: File[] = [];
	const problems: string[] = [];
	let full = false;
	for (const file of files) {
		if (file.size === 0) problems.push(t`${file.name} is empty.`);
		else if (file.size > MAX_ATTACHMENT_BYTES)
			problems.push(
				t`${file.name} is larger than ${new Intl.NumberFormat(i18n.locale, { style: "unit", unit: "megabyte" }).format(MAX_ATTACHMENT_BYTES / (1024 * 1024))}.`,
			);
		else if (attached + accepted.length >= MAX_ATTACHMENTS_PER_MESSAGE) full = true;
		else accepted.push(file);
	}
	if (full) problems.push(t`A message takes up to ${MAX_ATTACHMENTS_PER_MESSAGE} files.`);
	return { accepted, problems };
}

/** The files that can be uploaded; a toast says why the others can't. */
export function acceptUploads(files: readonly File[], attached: number) {
	const { accepted, problems } = checkUploads(files, attached);
	if (problems.length > 0) toast.add({ type: "error", description: problems.slice(0, 2).join(" ") });
	return accepted;
}
