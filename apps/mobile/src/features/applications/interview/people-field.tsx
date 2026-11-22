import type { Participant } from "./draft";
// Who the person will meet: a name, role and optional public profile link for each (up to 20). Links are used only
// when Web research is on.
import type { InterviewEditor } from "./use-interview-editor";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { MAX_PEOPLE, newParticipant } from "./draft";
import { Button, Icon, IconButton, Input, Label, Text, TextField } from "@/ui";

type PeopleFieldProps = { editor: InterviewEditor };

export function PeopleField({ editor }: PeopleFieldProps) {
	const { t } = useLingui();
	const { draft, set, pending, peopleInvalid } = editor;
	const update = (id: string, patch: Partial<Participant>) =>
		set(
			"participants",
			draft.participants.map((person) => (person.id === id ? { ...person, ...patch } : person)),
		);
	return (
		<View className="gap-3">
			<Text weight="medium">{t`Who you'll meet`}</Text>
			{draft.participants.map((person, index) => (
				<View key={person.id} className="gap-2 rounded-2xl bg-surface-secondary p-3">
					<View className="flex-row items-end gap-2">
						<TextField className="flex-1">
							<Label>{t`Name`}</Label>
							<Input
								value={person.name}
								maxLength={200}
								editable={!pending}
								accessibilityLabel={t`Name of person ${index + 1}`}
								onChangeText={(name) => update(person.id, { name })}
							/>
						</TextField>
						<IconButton
							icon="x"
							label={t`Remove person ${index + 1}`}
							isDisabled={pending}
							onPress={() =>
								set(
									"participants",
									draft.participants.filter((item) => item.id !== person.id),
								)
							}
						/>
					</View>
					<TextField>
						<Label>{t`Role`}</Label>
						<Input
							value={person.role}
							maxLength={200}
							editable={!pending}
							accessibilityLabel={t`Role of person ${index + 1}`}
							onChangeText={(role) => update(person.id, { role })}
						/>
					</TextField>
					<TextField>
						<Label>{t`Profile link (optional)`}</Label>
						<Input
							value={person.profileUrl}
							maxLength={2048}
							editable={!pending}
							keyboardType="url"
							autoCapitalize="none"
							autoCorrect={false}
							accessibilityLabel={t`Profile link of person ${index + 1}`}
							onChangeText={(profileUrl) => update(person.id, { profileUrl })}
						/>
					</TextField>
				</View>
			))}
			{peopleInvalid ? (
				<Text size="xs" tone="danger">
					{t`Profile links must be public HTTPS addresses.`}
				</Text>
			) : null}
			<Button
				variant="secondary"
				size="sm"
				className="self-start"
				isDisabled={pending || draft.participants.length >= MAX_PEOPLE}
				onPress={() => set("participants", [...draft.participants, newParticipant()])}
			>
				<Icon name="user-plus" size={16} />
				<Button.Label>{t`Add a person`}</Button.Label>
			</Button>
			<Text size="xs" tone="muted">
				{t`Profile links are optional and only used when Web research is on.`}
			</Text>
		</View>
	);
}
