// Extra contact details under Website: icon, an optional label, text and an optional link; move up and remove (with
// Undo). A labelled detail prints as "Label: text", or as a row of the personal details table in templates that have
// one (Wibawa, Tenun), as on the web.
import type { CustomField } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { generateId } from "@rezumi/utils/string";
import { useUndoToast } from "./hooks";
import { IconPickerSheet } from "./icon-picker";
import { useWriteSource } from "./source";
import { Button, IconButton, Input, Label, Sheet, Surface, Text, TextField } from "@/ui";

type CustomFieldsProps = { fields: CustomField[]; disabled: boolean; marker?: ReactNode };

export function CustomFields({ fields, disabled, marker }: CustomFieldsProps) {
	const { t } = useLingui();
	const { update } = useWriteSource();
	const undoToast = useUndoToast();
	const [iconFor, setIconFor] = useState<string | null>(null);
	const [linkFor, setLinkFor] = useState<string | null>(null);
	const [link, setLink] = useState("");

	const edit = (key: string, mutate: (list: CustomField[]) => void) =>
		update((draft) => mutate(draft.basics.customFields), { coalesceKey: `basics.customFields.${key}` });
	const editField = (id: string, key: string, mutate: (field: CustomField) => void) =>
		edit(`${id}.${key}`, (list) => {
			const found = list.find((field) => field.id === id);
			if (found) mutate(found);
		});
	const saveLink = () => {
		const value = link.trim() === "https://" ? "" : link.trim();
		if (linkFor)
			editField(linkFor, "link", (target) => {
				target.link = value;
			});
		setLinkFor(null);
	};

	return (
		<View className="gap-3">
			<View className="gap-1">
				<View className="min-h-6 flex-row items-center justify-between gap-2">
					<Label className="shrink">{t`Other contact details`}</Label>
					{marker}
				</View>
				<Text size="xs" tone="muted">
					{t`A messenger handle, a portfolio, a driving licence: anything with an icon.`}
				</Text>
			</View>
			{fields.map((field, index) => (
				<CustomFieldRow
					key={field.id}
					field={field}
					index={index}
					disabled={disabled}
					editField={editField}
					onIcon={() => setIconFor(field.id)}
					onLink={() => {
						setLink(field.link || "https://");
						setLinkFor(field.id);
					}}
					onMoveUp={() => edit(`${field.id}.move`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))}
					onRemove={() => {
						update((draft) => void draft.basics.customFields.splice(index, 1), { newStep: true });
						undoToast(t`Detail removed`);
					}}
				/>
			))}
			{!disabled ? (
				<Button
					variant="secondary"
					size="sm"
					className="self-start"
					onPress={() =>
						update(
							(draft) => void draft.basics.customFields.push({ id: generateId(), icon: "acorn", text: "", link: "" }),
							{ newStep: true },
						)
					}
				>
					{t`Add detail`}
				</Button>
			) : null}
			<IconPickerSheet
				isOpen={iconFor !== null}
				value={fields.find((field) => field.id === iconFor)?.icon ?? ""}
				onOpenChange={(open) => !open && setIconFor(null)}
				onChange={(icon) => {
					if (iconFor)
						editField(iconFor, "icon", (target) => {
							target.icon = icon;
						});
					setIconFor(null);
				}}
			/>
			<Sheet
				isOpen={linkFor !== null}
				onOpenChange={(open) => !open && setLinkFor(null)}
				title={t`Link`}
				closeLabel={t`Close`}
				footer={<Button onPress={saveLink}>{t`Save link`}</Button>}
			>
				<TextField>
					<Label>{t`Address`}</Label>
					<Input
						variant="secondary"
						accessibilityLabel={t`Address`}
						value={link}
						onChangeText={setLink}
						keyboardType="url"
						autoCapitalize="none"
						autoCorrect={false}
						autoFocus
						onSubmitEditing={saveLink}
					/>
				</TextField>
				<Text size="xs" tone="muted">{t`Leave it empty to remove the link.`}</Text>
			</Sheet>
		</View>
	);
}

type CustomFieldRowProps = {
	field: CustomField;
	index: number;
	disabled: boolean;
	editField: (id: string, key: string, mutate: (field: CustomField) => void) => void;
	onIcon: () => void;
	onLink: () => void;
	onMoveUp: () => void;
	onRemove: () => void;
};

/** One detail. Its label field shows only once asked for, or when the detail already has one. */
function CustomFieldRow({
	field,
	index,
	disabled,
	editField,
	onIcon,
	onLink,
	onMoveUp,
	onRemove,
}: CustomFieldRowProps) {
	const { t } = useLingui();
	const { focus } = useWriteSource();
	const [labelOpen, setLabelOpen] = useState(Boolean(field.label));
	// A label that appears from elsewhere (an undo, a remote copy) shows its field too.
	if (field.label && !labelOpen) setLabelOpen(true);

	// Hiding the label field drops its text, so what shows is what prints.
	const toggleLabel = () => {
		if (labelOpen && field.label)
			editField(field.id, "label", (target) => {
				target.label = "";
			});
		setLabelOpen(!labelOpen);
	};

	return (
		<Surface variant="secondary" className="gap-2 rounded-xl p-3">
			{labelOpen ? (
				<TextField isDisabled={disabled}>
					<Label>{t`Label for detail ${index + 1}`}</Label>
					<Input
						variant="secondary"
						accessibilityLabel={t`Label for detail ${index + 1}`}
						placeholder={t`Label, e.g. Languages`}
						value={field.label ?? ""}
						editable={!disabled}
						autoFocus={!field.label && !disabled}
						onFocus={focus.onFocus}
						onBlur={focus.onBlur}
						onChangeText={(value) =>
							editField(field.id, "label", (target) => {
								target.label = value;
							})
						}
					/>
				</TextField>
			) : null}
			<TextField isDisabled={disabled}>
				<Label>{t`Detail ${index + 1}`}</Label>
				<Input
					variant="secondary"
					accessibilityLabel={t`Detail ${index + 1}`}
					placeholder={t`Text, e.g. Indonesian`}
					value={field.text}
					editable={!disabled}
					onFocus={focus.onFocus}
					onBlur={focus.onBlur}
					onChangeText={(value) =>
						editField(field.id, "text", (target) => {
							target.text = value;
						})
					}
				/>
			</TextField>
			<View className="flex-row items-center">
				<Button variant="ghost" size="sm" isDisabled={disabled} onPress={onIcon}>
					{field.icon ? t`Icon: ${field.icon}` : t`Choose icon`}
				</Button>
				<View className="flex-1" />
				<IconButton
					variant="ghost"
					size="sm"
					icon="tag"
					label={labelOpen ? t`Remove label` : t`Add a label`}
					isSelected={labelOpen}
					isDisabled={disabled}
					onPress={toggleLabel}
				/>
				<IconButton
					variant="ghost"
					size="sm"
					icon={field.link ? "link-simple-horizontal" : "link-simple-horizontal-break"}
					label={field.link ? t`Edit link` : t`Add a link`}
					isDisabled={disabled}
					onPress={onLink}
				/>
				<IconButton
					variant="ghost"
					size="sm"
					icon="arrow-up"
					label={t`Move detail up`}
					isDisabled={disabled || index === 0}
					onPress={onMoveUp}
				/>
				<IconButton
					variant="ghost"
					size="sm"
					icon="x"
					label={t`Remove detail ${index + 1}`}
					isDisabled={disabled}
					onPress={onRemove}
				/>
			</View>
		</Surface>
	);
}
