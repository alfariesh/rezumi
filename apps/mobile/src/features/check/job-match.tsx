import type { MatchedTerm } from "@rezumi/resume/check";
import type { ResumeData } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { matchJobDescription, surfaceFormsOf } from "@rezumi/resume/ats-pdf";
import { checkStateOf, hideTerm, matchPosting, newSkill } from "@rezumi/resume/check";
import { buildMarkdown } from "@rezumi/resume/markdown";
import { formatList } from "@rezumi/utils/locale";
import { useCheckActions } from "./actions";
import { CheckSection } from "./check-section";
import { NoPosting, PostingSource } from "./posting";
import { TermSheet } from "./term-sheet";
import { useApplication } from "@/features/applications/queries";
import { routes } from "@/routes";
import { Button, EmptyState, Icon, ProgressBar, Skeleton, TagGroup, Text } from "@/ui";

export type Application = { id: string; company: string; role: string; jobDescription: string | null };

type JobMatchTabProps = {
	id: string;
	data: ResumeData;
	applicationId: string | null;
	locked: boolean;
	offline: boolean;
	/** The posting pasted this visit, when no application is linked. */
	pasted: string;
	onPaste: (posting: string) => void;
	/** The covered term highlighted on the page. */
	highlightTerm: string | null;
	onHighlight: (term: string | null) => void;
};

/**
 * Job match reads the posting of the application the resume is linked to, or one pasted for this visit, and sorts
 * its terms into found and missing. Terms hidden as "not true for me" are left out. It isn't part of the score.
 */
export function JobMatchTab(props: JobMatchTabProps) {
	const { id, data, applicationId, locked, offline, pasted } = props;
	const { t, i18n } = useLingui();
	const router = useRouter();
	const { edit } = useCheckActions(id);
	const [open, setOpen] = useState<MatchedTerm | null>(null);
	const linked = useApplication(applicationId ?? "");
	const application: Application | null = applicationId ? (linked.data ?? null) : null;
	const posting = application ? (application.jobDescription ?? "").trim() : pasted.trim();
	const hiddenTerms = data.metadata.check?.hiddenTerms;
	const resumeText = useMemo(() => buildMarkdown(data), [data]);
	const result = useMemo(
		() =>
			posting ? matchPosting({ matchJobDescription, surfaceFormsOf }, { posting, resumeText, hiddenTerms }) : null,
		[posting, resumeText, hiddenTerms],
	);

	if (applicationId && linked.isPending) return <Skeleton variant="none" className="h-40 w-full rounded-2xl" />;
	if (applicationId && linked.isError)
		return (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load the linked posting.`}
				action={{ label: t`Retry`, onPress: () => void linked.refetch() }}
			/>
		);
	if (!posting)
		return <NoPosting id={id} application={application} locked={locked} offline={offline} onPaste={props.onPaste} />;

	const close = () => setOpen(null);

	return (
		<View className="gap-6">
			<PostingSource
				id={id}
				application={application}
				locked={locked}
				offline={offline}
				pasted={pasted}
				onClearPasted={() => props.onPaste("")}
			/>
			<CheckSection
				icon="list-magnifying-glass"
				title={t`Posting terms`}
				trailing={<Text size="xs" tone="muted">{t`not scored`}</Text>}
				testID="posting-terms"
			>
				{!result || result.total === 0 ? (
					<Text tone="muted">{t`No terms stood out in this posting.`}</Text>
				) : (
					<>
						<Text weight="semibold" tabular>
							{t`${result.found.length} of ${result.total} posting terms appear`}
						</Text>
						<ProgressBar
							accessibilityLabel={t`Posting terms in your resume`}
							value={result.found.length}
							maxValue={result.total}
							size="sm"
						/>
						{result.missing.length > 0 ? (
							<View className="gap-2">
								<Text weight="semibold">{t`Not in your resume · add only if true`}</Text>
								<TagGroup
									selectionMode="single"
									selectedKeys={new Set(open ? [open.term] : [])}
									onSelectionChange={(keys) => setOpen(result.missing.find((term) => keys.has(term.term)) ?? null)}
									accessibilityLabel={t`Not in your resume · add only if true`}
								>
									<TagGroup.List>
										{result.missing.map((term) => (
											<TagGroup.Item key={term.term} id={term.term} testID={`term-${term.term}`}>
												<Icon name="plus" size={16} />
												<TagGroup.ItemLabel>{term.label}</TagGroup.ItemLabel>
											</TagGroup.Item>
										))}
									</TagGroup.List>
								</TagGroup>
							</View>
						) : null}
						{result.found.length > 0 ? (
							<View className="gap-2">
								<Text weight="semibold">{t`Already covered · pick one to find it on the page`}</Text>
								<TagGroup
									selectionMode="single"
									selectedKeys={new Set(props.highlightTerm ? [props.highlightTerm] : [])}
									onSelectionChange={(keys) => props.onHighlight(([...keys][0] as string | undefined) ?? null)}
									accessibilityLabel={t`Already covered · pick one to find it on the page`}
								>
									<TagGroup.List>
										{result.found.map((term) => (
											<TagGroup.Item key={term.term} id={term.term}>
												<Icon name="check" size={16} tone="success" />
												<TagGroup.ItemLabel>{term.label}</TagGroup.ItemLabel>
											</TagGroup.Item>
										))}
									</TagGroup.List>
								</TagGroup>
							</View>
						) : null}
					</>
				)}
				{hiddenTerms?.length ? (
					<View className="flex-row flex-wrap items-center gap-2">
						<Text size="xs" tone="muted" className="shrink">
							{t`Hidden: ${formatList(i18n.locale, hiddenTerms)}`}
						</Text>
						<Button
							variant="tertiary"
							size="sm"
							isDisabled={locked}
							onPress={() =>
								edit(
									(draft) => {
										checkStateOf(draft).hiddenTerms = [];
									},
									t`Hidden terms are back`,
								)
							}
						>
							<Button.Label>{t`Show again`}</Button.Label>
						</Button>
					</View>
				) : null}
			</CheckSection>
			<TermSheet
				term={open}
				locked={locked}
				onClose={close}
				onAddToSkills={(term) => {
					edit(
						(draft) => void draft.sections.skills.items.push(newSkill(term.label)),
						t`“${term.label}” added to Skills`,
					);
					close();
					props.onHighlight(term.term);
				}}
				onAskAssistant={(term) => {
					close();
					router.push({
						pathname: routes.assistant(id),
						params: {
							ask: t`The posting asks for “${term.label}”. If it's true for me, work it into my resume where it fits. Ask me first.`,
						},
					});
				}}
				onHide={(term) => {
					edit((draft) => hideTerm(draft, term.term), t`“${term.label}” hidden`);
					close();
				}}
			/>
		</View>
	);
}
