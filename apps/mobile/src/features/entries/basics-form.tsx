// Your details: name, headline, contact details, website and custom fields, bound to the source. Used by Profile →
// Details and, from Phase 07, by the CV builder's Basics.
import type { Basics, CustomField } from "@rezumi/schema/resume/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { generateId } from "@rezumi/utils/string";
import { useUndoToast } from "./hooks";
import { IconPickerSheet } from "./icon-picker";
import { useWriteData, useWriteSource } from "./source";
import { BoundText, LinkField, useValidators } from "./text-fields";
import { Button, IconButton, Input, Label, Sheet, Surface, Text, TextField } from "@/ui";

type TextKey = "name" | "headline" | "email" | "phone" | "location";

type BasicsFormProps = { disabled?: boolean | undefined; focusField?: string | undefined };

export function BasicsForm({ disabled = false, focusField }: BasicsFormProps) {
	const { t } = useLingui();
	const basics = useWriteData((data) => data.basics, null);
	const { update } = useWriteSource();
	const validate = useValidators();
	if (!basics) return null;

	const write = (key: string, mutate: (target: Basics) => void) =>
		update((draft) => mutate(draft.basics), { coalesceKey: `basics.${key}` });
	const text = (key: TextKey) => ({
		value: basics[key],
		disabled,
		autoFocus: !disabled && focusField === key,
		testID: `basics-${key}`,
		onChange: (value: string) =>
			write(key, (target) => {
				target[key] = value;
			}),
	});

	return (
		<View className="gap-4">
			<BoundText label={t`Full name`} autoComplete="name" autoCapitalize="words" {...text("name")} />
			<BoundText label={t`Headline`} placeholder={t`Product designer`} {...text("headline")} />
			<BoundText
				label={t`Email`}
				keyboardType="email-address"
				autoComplete="email"
				validate={validate.email}
				{...text("email")}
			/>
			<BoundText label={t`Phone`} keyboardType="phone-pad" autoComplete="tel" {...text("phone")} />
			<BoundText label={t`Location`} placeholder={t`City, country`} {...text("location")} />
			<LinkField
				label={t`Website`}
				value={basics.website}
				allowInlineLink={false}
				autoFocus={!disabled && focusField?.startsWith("website")}
				disabled={disabled}
				onChange={(website) =>
					write("website", (target) => {
						target.website = { url: website.url, label: website.label };
					})
				}
			/>
			<CustomFields fields={basics.customFields} disabled={disabled} />
		</View>
	);
}

type CustomFieldsProps = { fields: CustomField[]; disabled: boolean };

/** Extra contact details: icon, text and an optional link; move up and remove (with Undo). */
function CustomFields({ fields, disabled }: CustomFieldsProps) {
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
				<Label>{t`Other contact details`}</Label>
				<Text
					size="xs"
					tone="muted"
				>{t`A messenger handle, a portfolio, a driving licence: anything with an icon.`}</Text>
			</View>
			{fields.map((field, index) => (
				<Surface key={field.id} variant="secondary" className="gap-2 rounded-xl p-3">
					<TextField isDisabled={disabled}>
						<Label>{t`Detail ${index + 1}`}</Label>
						<Input
							variant="secondary"
							accessibilityLabel={t`Detail ${index + 1}`}
							value={field.text}
							editable={!disabled}
							onChangeText={(value) =>
								editField(field.id, "text", (target) => {
									target.text = value;
								})
							}
						/>
					</TextField>
					<View className="flex-row items-center">
						<Button variant="ghost" size="sm" isDisabled={disabled} onPress={() => setIconFor(field.id)}>
							{field.icon ? t`Icon: ${field.icon}` : t`Choose icon`}
						</Button>
						<View className="flex-1" />
						<IconButton
							variant="ghost"
							size="sm"
							icon={field.link ? "link-simple-horizontal" : "link-simple-horizontal-break"}
							label={field.link ? t`Edit link` : t`Add a link`}
							isDisabled={disabled}
							onPress={() => {
								setLink(field.link || "https://");
								setLinkFor(field.id);
							}}
						/>
						<IconButton
							variant="ghost"
							size="sm"
							icon="arrow-up"
							label={t`Move detail up`}
							isDisabled={disabled || index === 0}
							onPress={() => edit(`${field.id}.move`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))}
						/>
						<IconButton
							variant="ghost"
							size="sm"
							icon="x"
							label={t`Remove detail ${index + 1}`}
							isDisabled={disabled}
							onPress={() => {
								update((draft) => void draft.basics.customFields.splice(index, 1), { newStep: true });
								undoToast(t`Detail removed`);
							}}
						/>
					</View>
				</Surface>
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
