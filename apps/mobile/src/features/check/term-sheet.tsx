import type { MatchedTerm } from "@rezumi/resume/check";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Button, Icon, Sheet, Typography } from "@/ui";

type TermSheetProps = {
	term: MatchedTerm | null;
	locked: boolean;
	onClose: () => void;
	onAddToSkills: (term: MatchedTerm) => void;
	onAskAssistant: (term: MatchedTerm) => void;
	onHide: (term: MatchedTerm) => void;
};

/** A posting term the resume doesn't have: add it only if it's true, ask the assistant, or hide it. */
export function TermSheet({ term, locked, onClose, onAddToSkills, onAskAssistant, onHide }: TermSheetProps) {
	const { t } = useLingui();
	return (
		<Sheet
			isOpen={!!term}
			onOpenChange={(open) => (open ? undefined : onClose())}
			title={term ? t`Add “${term.label}”` : undefined}
			closeLabel={t`Close`}
			testID="term-sheet"
		>
			{term ? (
				<>
					<Typography type="body-sm" className="text-muted">
						{`${plural(term.jdCount, {
							one: `“${term.label}” appears once in the posting.`,
							other: `“${term.label}” appears #× in the posting.`,
						})} ${t`If it's part of your experience, add it where it belongs.`}`}
					</Typography>
					<Button isDisabled={locked} onPress={() => onAddToSkills(term)} testID="term-add">
						<Icon name="plus" size={20} tone="accent-foreground" />
						<Button.Label>{t`Add to Skills`}</Button.Label>
					</Button>
					<Button variant="secondary" isDisabled={locked} onPress={() => onAskAssistant(term)}>
						<Icon name="sparkle" size={20} />
						<Button.Label>{t`Ask the assistant to work it in`}</Button.Label>
					</Button>
					<Button variant="ghost" isDisabled={locked} onPress={() => onHide(term)}>
						<Button.Label>{t`Not true for me, hide it`}</Button.Label>
					</Button>
				</>
			) : null}
		</Sheet>
	);
}
