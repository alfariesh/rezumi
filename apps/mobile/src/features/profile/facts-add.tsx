// Adding a fact by hand: the sentence and its type. The form's state lives in `useAddFact` so the Facts panel can put
// the save button in a sheet's footer on phones and under the fields beside the list on tablets.
import type { FactCategory } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { View } from "react-native";
import { FACT_CATEGORIES, categoryLabel } from "./facts-labels";
import { client, useCareerAction } from "@/features/career/hooks";
import { Alert, Button, Description, Label, RadioGroup, TextArea, TextField } from "@/ui";

/** Shorter than this is not a fact anyone could use ("ok"); the web asks for the same. */
const MIN_LENGTH = 4;

export type AddFactForm = ReturnType<typeof useAddFact>;

/** `onAdded` gets the saved fact's id when the server returns it. */
export function useAddFact(onAdded: (id: string | undefined) => void) {
	const [text, setText] = useState("");
	const [category, setCategory] = useState<FactCategory>("accomplishment");
	const action = useCareerAction();
	const ready = text.trim().length >= MIN_LENGTH;
	const save = () => {
		const value = text.trim();
		if (value.length < MIN_LENGTH || action.pending) return;
		void action.run(
			() =>
				client.career.saveFact({
					applicationId: null,
					text: value,
					category,
					source: { kind: "manual", id: Crypto.randomUUID(), quote: value },
				}),
			(fact) => {
				setText("");
				onAdded(fact && typeof fact === "object" && "id" in fact ? String(fact.id) : undefined);
			},
		);
	};
	return { text, setText, category, setCategory, ready, save, pending: action.pending, error: action.error };
}

type AddFactFieldsProps = { form: AddFactForm };

export function AddFactFields({ form }: AddFactFieldsProps) {
	const { t } = useLingui();
	return (
		<View className="gap-5">
			<TextField>
				<Label>{t`Fact`}</Label>
				<TextArea
					variant="secondary"
					value={form.text}
					onChangeText={form.setText}
					maxLength={2000}
					autoFocus
					accessibilityLabel={t`Fact`}
				/>
				<Description>{t`Something true you can support, such as “I mentored two associate PMs in 2025”.`}</Description>
			</TextField>
			<View className="gap-2">
				<Label>{t`Type`}</Label>
				<RadioGroup value={form.category} onValueChange={(value) => form.setCategory(value as FactCategory)}>
					{FACT_CATEGORIES.map((category) => (
						<RadioGroup.Item key={category} value={category} className="min-h-11">
							{categoryLabel(category)}
						</RadioGroup.Item>
					))}
				</RadioGroup>
			</View>
			{form.error ? (
				<Alert status="danger">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Content>
				</Alert>
			) : null}
		</View>
	);
}

type AddFactButtonProps = { form: AddFactForm };

export function AddFactButton({ form }: AddFactButtonProps) {
	const { t } = useLingui();
	return (
		<Button variant="primary" isDisabled={!form.ready || form.pending} onPress={form.save}>
			<Button.Label>{form.pending ? t`Adding…` : t`Add fact`}</Button.Label>
		</Button>
	);
}
