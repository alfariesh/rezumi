// Your details: name, headline, contact details, website and custom fields, bound to the source. Used by Profile →
// Details and by the CV builder's Basics, which passes `marker` for the "differs from Profile" marks.
import type { ProfilePart } from "@rezumi/schema/profile/data";
import type { Basics } from "@rezumi/schema/resume/data";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { CustomFields } from "./custom-fields";
import { useWriteData, useWriteSource } from "./source";
import { BoundText, LinkField, useValidators } from "./text-fields";

type TextKey = "name" | "headline" | "email" | "phone" | "location";

type BasicsFormProps = {
	disabled?: boolean | undefined;
	focusField?: string | undefined;
	/** A control beside a part's label (the resume's Profile marker); nothing on the Profile itself. */
	marker?: ((part: ProfilePart) => ReactNode) | undefined;
};

export function BasicsForm({ disabled = false, focusField, marker }: BasicsFormProps) {
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
		labelAction: marker?.({ kind: "basics", field: key }),
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
				labelAction={marker?.({ kind: "basics", field: "website" })}
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
			<CustomFields
				fields={basics.customFields}
				disabled={disabled}
				marker={marker?.({ kind: "basics", field: "customFields" })}
			/>
		</View>
	);
}
