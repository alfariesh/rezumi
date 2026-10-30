import type { ReactNode } from "react";
import { Modal } from "@heroui/react";
import { useLingui } from "@lingui/react";
import { Plural, Trans } from "@lingui/react/macro";
import { publicResumeUrl } from "@rezumi/resume/sharing";
import { templates } from "@/dialogs/resume/template/data";
import { useCurrentResume } from "@/features/resume/builder/draft";
import { useEditorStore } from "@/features/resume/editor/store";
import { useShareOrigin } from "@/features/resume/share/use-share-origin";
import { authClient } from "@/libs/auth/client";
import { formatRelativeTime, localeMap, resolveLocale } from "@/libs/locale";

type RowProps = { label: ReactNode; children: ReactNode };

function Row({ label, children }: RowProps) {
	return (
		<div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-2">
			<dt className="text-muted">{label}</dt>
			<dd className="min-w-0 break-words text-foreground">{children}</dd>
		</div>
	);
}

/**
 * The document menu's Details: what this resume is, at a glance. When it was made and last edited, how it looks,
 * how long it runs, and whether anyone can see it.
 */
type DocumentDetailsProps = {
	/** The id of the description text, for the surrounding dialog's `aria-describedby`. */
	descriptionId: string;
};

export function DocumentDetails({ descriptionId }: DocumentDetailsProps) {
	const { i18n } = useLingui();
	const resume = useCurrentResume();
	const pageCount = useEditorStore((state) => state.rendered.pageCount);
	const { data: session } = authClient.useSession();
	const { template, page } = resume.data.metadata;
	const origin = useShareOrigin();
	const url = publicResumeUrl(origin, { username: session?.user.username ?? "", slug: resume.slug });

	return (
		<>
			<Modal.Header>
				<Modal.Heading className="break-words">{resume.name}</Modal.Heading>
				<p id={descriptionId} className="text-sm text-muted">
					<Trans>Resume details</Trans>
				</p>
			</Modal.Header>

			<Modal.Body>
				<dl className="text-sm leading-5">
					<Row label={<Trans>Created</Trans>}>
						<time dateTime={new Date(resume.createdAt).toISOString()}>
							{i18n.date(resume.createdAt, { dateStyle: "long" })}
						</time>
					</Row>
					<Row label={<Trans>Last edited</Trans>}>
						<time
							dateTime={new Date(resume.updatedAt).toISOString()}
							title={i18n.date(resume.updatedAt, { dateStyle: "long", timeStyle: "short" })}
						>
							{formatRelativeTime(resume.updatedAt, i18n.locale)}
						</time>
					</Row>
					<Row label={<Trans>Template</Trans>}>{templates[template].name}</Row>
					<Row label={<Trans>Language</Trans>}>{i18n._(localeMap[resolveLocale(page.locale)])}</Row>
					<Row label={<Trans>Length</Trans>}>
						{pageCount > 0 ? <Plural value={pageCount} one="# page" other="# pages" /> : "—"}
					</Row>
					<Row label={<Trans>Sharing</Trans>}>
						{resume.isPublic ? (
							<>
								{resume.hasPassword ? <Trans>Public, with a password</Trans> : <Trans>Public</Trans>}
								<a
									href={url}
									target="_blank"
									rel="noopener noreferrer"
									className="mt-0.5 block truncate font-mono text-[13px] text-accent underline-offset-2 hover:underline"
								>
									{url.replace(/^https?:\/\//, "")}
								</a>
							</>
						) : (
							<Trans>Private. Only you can see it.</Trans>
						)}
					</Row>
				</dl>
			</Modal.Body>
		</>
	);
}
