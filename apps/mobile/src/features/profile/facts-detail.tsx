// One fact, opened from the Facts list: its text (corrected in place), whether the coach uses it, where it came from,
// what leans on it and its correction history, with the actions the web row has (Correct, Use for all applications,
// Forget). Phones show it in a sheet, tablets beside the list.
import type { Fact } from "@/features/career/hooks";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { categoryLabel, categoryOf, factExcerpt, sourceLabel, usageLabel } from "./facts-labels";
import { useCareerTime } from "@/features/career/hooks";
import { Button, Chip, Description, Icon, Label, Separator, Switch, Text, TextArea, TextField, Typography } from "@/ui";

export type FactDetailProps = {
	fact: Fact;
	onToggle: (fact: Fact, active: boolean) => void;
	onCorrect: (fact: Fact, text: string) => void;
	onShare: (fact: Fact) => void;
	onForget: (fact: Fact) => void;
};

export function FactDetail({ fact, onToggle, onCorrect, onShare, onForget }: FactDetailProps) {
	const { t } = useLingui();
	const { locale, timeZone } = useCareerTime();
	const [correcting, setCorrecting] = useState(false);
	const on = fact.status === "active";
	const date = (value: Date | string) =>
		new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(
			new Date(value),
		);
	const lastRevision = fact.revisions.at(-1);

	return (
		<View className="gap-4">
			<View className="flex-row flex-wrap items-center gap-1.5">
				<Chip size="sm" variant="soft" color="default">
					<Chip.Label>{categoryLabel(categoryOf(fact))}</Chip.Label>
				</Chip>
				{fact.company === null ? (
					<Text size="xs" tone="muted">
						{t`All applications`}
					</Text>
				) : (
					<Chip size="sm" variant="soft" color="accent">
						<Chip.Label>{t`${fact.company} only`}</Chip.Label>
					</Chip>
				)}
			</View>

			{correcting ? (
				<FactCorrection
					text={fact.text}
					onCancel={() => setCorrecting(false)}
					onSave={(text) => {
						setCorrecting(false);
						if (text !== fact.text) onCorrect(fact, text);
					}}
				/>
			) : (
				<Typography type="body" color={on ? "default" : "muted"} selectable>
					{fact.text}
				</Typography>
			)}

			<View className="min-h-11 flex-row items-center gap-3">
				<View className="flex-1 gap-0.5">
					<Text weight="medium">{t`Use in coaching`}</Text>
					<Text size="xs" tone="muted">
						{on ? t`The coach and your documents can use this fact.` : t`Kept, but not used.`}
					</Text>
				</View>
				<Switch
					isSelected={on}
					onSelectedChange={(active) => onToggle(fact, active)}
					accessibilityLabel={t`Use in coaching: ${factExcerpt(fact)}`}
				/>
			</View>

			{correcting ? null : (
				<View className="-ms-3 flex-row flex-wrap gap-1">
					<Button size="sm" variant="ghost" onPress={() => setCorrecting(true)}>
						<Icon name="pencil-simple" size={16} />
						<Button.Label>{t`Correct`}</Button.Label>
					</Button>
					{fact.company === null ? null : (
						<Button size="sm" variant="ghost" onPress={() => onShare(fact)}>
							<Icon name="globe-simple" size={16} />
							<Button.Label>{t`Use for all applications`}</Button.Label>
						</Button>
					)}
					<Button size="sm" variant="ghost" onPress={() => onForget(fact)}>
						<Icon name="trash" size={16} tone="danger" />
						<Button.Label className="text-danger">{t`Forget`}</Button.Label>
					</Button>
				</View>
			)}

			<View className="gap-1.5 rounded-xl bg-surface-secondary px-3.5 py-3">
				<Text size="xs" weight="semibold">
					{`${sourceLabel(fact)} · ${date(fact.createdAt)}`}
				</Text>
				<Text size="xs" tone="muted">
					{usageLabel(fact)}
				</Text>
				<Text size="xs" tone="muted">
					{lastRevision ? t`Corrected ${date(lastRevision.at)} · original kept` : t`No corrections`}
				</Text>
				{fact.source.quote ? (
					<View className="mt-1 border-s-2 border-separator ps-2">
						<Typography type="body-xs" selectable>
							{fact.source.quote}
						</Typography>
					</View>
				) : null}
				{fact.revisions.length > 0 ? (
					<>
						<Separator className="my-1.5" />
						{[...fact.revisions].reverse().map((revision) => (
							<Typography key={revision.at} type="body-xs" color="muted">
								{`${date(revision.at)} · ${revision.text}`}
							</Typography>
						))}
					</>
				) : null}
				<Text size="xs" tone="muted" className="mt-1">
					{t`Forgetting unlinks this fact from stories and saved items. The original source stays unchanged.`}
				</Text>
			</View>
		</View>
	);
}

type FactCorrectionProps = { text: string; onSave: (text: string) => void; onCancel: () => void };

function FactCorrection({ text, onSave, onCancel }: FactCorrectionProps) {
	const { t } = useLingui();
	const [draft, setDraft] = useState(text);
	const save = () => {
		if (draft.trim()) onSave(draft.trim());
	};
	return (
		<View className="gap-2">
			<TextField>
				<Label>{t`Correct this fact`}</Label>
				<TextArea
					variant="secondary"
					value={draft}
					onChangeText={setDraft}
					maxLength={2000}
					autoFocus
					accessibilityLabel={t`Correct this fact`}
				/>
				<Description>{t`The original stays in the history.`}</Description>
			</TextField>
			<View className="flex-row flex-wrap gap-2">
				<Button size="sm" variant="secondary" isDisabled={!draft.trim()} onPress={save}>
					<Button.Label>{t`Save correction`}</Button.Label>
				</Button>
				<Button size="sm" variant="ghost" onPress={onCancel}>
					<Button.Label>{t`Cancel`}</Button.Label>
				</Button>
			</View>
		</View>
	);
}
