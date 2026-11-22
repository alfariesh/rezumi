// Every field of one entry, from the field schema shared with the CV builder (`features/entries/fields.ts`, as on the
// web's entries.tsx). Level and icon wait behind "More options".
import type { EntryWriter } from "./hooks";
import type { PageSettings } from "./source";
import type { EntryField } from "@/features/entries/fields";
import type { Entry } from "@/features/entries/model";
import type { CustomSectionType, RoleItem, Website } from "@rezumi/schema/resume/data";
import type { ResumeDates } from "@rezumi/schema/resume/dates";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { EMPTY_RESUME_DATES } from "@rezumi/schema/resume/dates";
import { generateId } from "@rezumi/utils/string";
import { DatesField } from "./dates-field";
import { IconPickerSheet } from "./icon-picker";
import { RichTextField } from "./rich-text-field";
import { BoundText, LinkField } from "./text-fields";
import { ENTRY_FIELDS } from "@/features/entries/fields";
import { Button, ChipInput, IconButton, Label, ListRow, ListSection, Slider, Surface, Text } from "@/ui";

type Values = Record<string, unknown> & {
	website?: Website & { inlineLink?: boolean };
	dates?: ResumeDates;
	keywords?: string[];
	roles?: RoleItem[];
	level?: number;
};

const str = (value: unknown) => (typeof value === "string" ? value : "");

type FieldProps = {
	entry: Entry;
	write: EntryWriter;
	page: PageSettings;
	disabled: boolean;
	focusField?: string | undefined;
};

function Level({ entry, write, disabled }: FieldProps) {
	const { t } = useLingui();
	const level = Number((entry as unknown as Values).level ?? 0);
	return (
		<Slider
			value={level}
			minValue={0}
			maxValue={5}
			step={1}
			isDisabled={disabled}
			onChange={(next) => {
				const value = Array.isArray(next) ? (next[0] ?? 0) : next;
				if (value !== level)
					write("level", (target) => {
						target.level = value;
					});
			}}
		>
			<View className="flex-row items-center justify-between">
				<Label>{t`Level`}</Label>
				<Text tone="muted" tabular>
					{level === 0 ? t`Hidden` : t`${level} of 5`}
				</Text>
			</View>
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	);
}

/** The icon printed before the entry. Its colour is a design choice, set in the CV builder. */
function EntryIcon({ entry, write, disabled }: FieldProps) {
	const { t } = useLingui();
	const icon = str((entry as unknown as Values).icon);
	const [open, setOpen] = useState(false);
	return (
		<>
			<ListSection>
				<ListRow
					title={t`Icon`}
					icon="bookmark-simple"
					value={icon || t`None`}
					isDisabled={disabled}
					onPress={() => setOpen(true)}
				/>
			</ListSection>
			<IconPickerSheet
				isOpen={open}
				value={icon}
				onOpenChange={setOpen}
				onChange={(next) => {
					setOpen(false);
					write("icon", (target) => {
						target.icon = next;
					});
				}}
			/>
		</>
	);
}

function Roles({ entry, write, page, disabled, focusField }: FieldProps) {
	const { t } = useLingui();
	const roles = (entry as unknown as Values).roles ?? [];
	const writeRoles = (key: string, mutate: (list: RoleItem[]) => void) =>
		write(`roles:${key}`, (target) => {
			mutate(target.roles as RoleItem[]);
		});
	const update = (role: RoleItem, key: string, mutate: (target: RoleItem) => void) =>
		writeRoles(`${role.id}:${key}`, (list) => {
			const found = list.find((item) => item.id === role.id);
			if (found) mutate(found);
		});

	return (
		<View className="gap-3">
			{roles.map((role, index) => (
				<Surface key={role.id} variant="secondary" className="gap-3 rounded-xl p-3">
					<View className="flex-row items-center">
						<Text size="xs" weight="semibold" tone="muted" className="flex-1">
							{t`Role ${index + 1}`}
						</Text>
						<IconButton
							variant="ghost"
							size="sm"
							icon="arrow-up"
							label={t`Move role up`}
							isDisabled={disabled || index === 0}
							onPress={() =>
								writeRoles(`move-${role.id}`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))
							}
						/>
						<IconButton
							variant="ghost"
							size="sm"
							icon="arrow-down"
							label={t`Move role down`}
							isDisabled={disabled || index === roles.length - 1}
							onPress={() =>
								writeRoles(`move-${role.id}`, (list) => list.splice(index + 1, 0, ...list.splice(index, 1)))
							}
						/>
						<IconButton
							variant="ghost"
							size="sm"
							icon="x"
							label={t`Remove role ${index + 1}`}
							isDisabled={disabled}
							onPress={() => writeRoles(`remove-${role.id}`, (list) => list.splice(index, 1))}
						/>
					</View>
					<BoundText
						label={t`Position`}
						autoFocus={!disabled && focusField === `roles/${index}/position`}
						value={role.position}
						disabled={disabled}
						onChange={(value) =>
							update(role, "position", (target) => {
								target.position = value;
							})
						}
					/>
					<DatesField
						dates={role.dates ?? EMPTY_RESUME_DATES}
						locale={page.locale}
						format={page.dateFormat}
						disabled={disabled}
						onChange={(dates) =>
							update(role, "dates", (target) => {
								target.dates = dates;
							})
						}
					/>
					<RichTextField
						label={t`Description of role ${index + 1}`}
						value={role.description}
						disabled={disabled}
						onChange={(html) =>
							update(role, "description", (target) => {
								target.description = html;
							})
						}
					/>
				</Surface>
			))}
			{!disabled ? (
				<Button
					variant="secondary"
					size="sm"
					onPress={() =>
						writeRoles("add", (list) => {
							list.push({
								id: generateId(),
								position: "",
								period: "",
								dates: { ...EMPTY_RESUME_DATES },
								description: "",
							});
						})
					}
				>
					{t`Add role`}
				</Button>
			) : null}
		</View>
	);
}

type EntryFieldsProps = FieldProps & { type: CustomSectionType; autoFocus?: boolean | undefined };

export function EntryFields({ type, autoFocus, ...props }: EntryFieldsProps) {
	const { t, i18n } = useLingui();
	const fields = ENTRY_FIELDS[type];
	const { entry, write, page, disabled, focusField } = props;
	const [more, setMore] = useState(() => fields.some((field) => field.more && field.key === focusField));
	const values = entry as unknown as Values;

	const render = (field: EntryField, index: number) => {
		const label = i18n._(field.label);
		switch (field.kind) {
			case "text":
				return (
					<BoundText
						key={field.key}
						label={label}
						value={str(values[field.key])}
						disabled={disabled}
						autoFocus={!disabled && (focusField ? focusField === field.key : autoFocus && index === 0)}
						keyboardType={field.keyboard === "phone" ? "phone-pad" : undefined}
						testID={`entry-${field.key}`}
						onChange={(value) =>
							write(field.key, (target) => {
								target[field.key] = value;
							})
						}
					/>
				);
			case "dates":
			case "date":
				return (
					<DatesField
						key={field.key}
						dates={values.dates ?? EMPTY_RESUME_DATES}
						single={field.kind === "date"}
						locale={page.locale}
						format={page.dateFormat}
						autoFocus={!disabled && ["dates", "period", "date"].some((key) => focusField?.startsWith(key))}
						disabled={disabled}
						onChange={(dates) =>
							write("dates", (target) => {
								target.dates = dates;
							})
						}
					/>
				);
			case "link":
				return (
					<LinkField
						key={field.key}
						label={label}
						disabled={disabled}
						value={values.website ?? { url: "", label: "", inlineLink: false }}
						autoFocus={!disabled && focusField?.startsWith("website")}
						onChange={(website) =>
							write("website", (target) => {
								target.website = website;
							})
						}
					/>
				);
			case "richText":
				return (
					<RichTextField
						key={field.key}
						label={label}
						value={str(values[field.key])}
						disabled={disabled}
						autoFocus={!disabled && focusField === field.key}
						onChange={(html) =>
							write(field.key, (target) => {
								target[field.key] = html;
							})
						}
					/>
				);
			case "keywords":
				return (
					<ChipInput
						key={field.key}
						label={label}
						variant="secondary"
						values={values.keywords ?? []}
						removeLabel={(value) => t`Remove ${value}`}
						onChange={(keywords) => {
							if (disabled) return;
							write("keywords", (target) => {
								// Commas separate keywords, as on the web.
								target.keywords = [
									...new Set(keywords.flatMap((keyword) => keyword.split(",").map((part) => part.trim()))),
								].filter(Boolean);
							});
						}}
					/>
				);
			case "level":
				return <Level key={field.key} {...props} />;
			case "icon":
				return <EntryIcon key={field.key} {...props} />;
			case "roles":
				return (
					<View key={field.key} className="gap-1.5">
						<Label>{label}</Label>
						<Roles {...props} />
					</View>
				);
		}
	};

	const main = fields.filter((field) => !field.more);
	const hidden = fields.filter((field) => field.more);
	return (
		<View className="gap-4">
			{main.map(render)}
			{hidden.length > 0 ? (
				<>
					<Button variant="ghost" className="self-start" onPress={() => setMore(!more)}>
						{more ? t`Fewer options` : t`More options`}
					</Button>
					{more ? hidden.map((field) => render(field, -1)) : null}
				</>
			) : null}
		</View>
	);
}
