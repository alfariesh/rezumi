import type { EntryWriter } from "./fields";
import type { Entry } from "@rezumi/resume/write";
import type { CustomSectionType, RoleItem, Website } from "@rezumi/schema/resume/data";
import type { DateFormat, ResumeDates } from "@rezumi/schema/resume/dates";
import type { IconName } from "@rezumi/ui/components/icon";
import { CellSlider } from "@heroui-pro/react";
import { Button, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { EMPTY_RESUME_DATES } from "@rezumi/schema/resume/dates";
import { FormControl, FormItem, FormLabel } from "@rezumi/ui/components/form";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { generateId } from "@rezumi/utils/string";
import { DatesField } from "./dates-field";
import { MoreOptions, TextField, useFieldLabelClass, WebsiteField } from "./fields";
import { RichTextEditor } from "./rich-text-editor";
import { useWriteIconStyle, useWriteSource } from "./source";
import { ChipInput } from "@/components/input/chip-input";
import { ColorPicker } from "@/components/input/color-picker";
import { IconPicker } from "@/components/input/icon-picker";

export type PageSettings = { locale: string; dateFormat?: DateFormat | undefined };

type FieldSetProps = { entry: Entry; write: EntryWriter; page: PageSettings };

type Values = Record<string, unknown> & {
	website?: Website & { inlineLink?: boolean };
	dates?: ResumeDates;
	keywords?: string[];
	roles?: RoleItem[];
	level?: number;
};

const valuesOf = (entry: Entry) => entry as unknown as Values;
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** The icon each entry field wears; a field with none (an unknown one) is left plain. */
const FIELD_ICONS: Record<string, IconName> = {
	position: "user-circle",
	company: "briefcase",
	location: "map-pin",
	school: "graduation-cap",
	degree: "scroll",
	area: "book-open",
	grade: "star",
	name: "text-t",
	proficiency: "chart-line-up",
	language: "translate",
	fluency: "chart-line-up",
	title: "text-t",
	awarder: "seal-check",
	issuer: "seal-check",
	publisher: "books",
	organization: "house",
	phone: "phone",
	network: "share-network",
	username: "user-circle",
};

/** A text field bound to one entry field. */
function Text({
	entry,
	write,
	field,
	label,
	wide,
	autoFocus,
}: FieldSetProps & { field: string; label: string; wide?: boolean; autoFocus?: boolean | undefined }) {
	return (
		<TextField
			label={label}
			icon={FIELD_ICONS[field]}
			value={str(valuesOf(entry)[field])}
			wide={wide}
			autoFocus={autoFocus}
			data-entry-field={field}
			onChange={(value) =>
				write(field, (target) => {
					target[field] = value;
				})
			}
		/>
	);
}

function Dates({ entry, write, page, single }: FieldSetProps & { single?: boolean }) {
	return (
		<DatesField
			className="col-span-full"
			dates={valuesOf(entry).dates ?? EMPTY_RESUME_DATES}
			single={single}
			locale={page.locale}
			format={page.dateFormat}
			onChange={(dates) =>
				write("dates", (target) => {
					target.dates = dates;
				})
			}
		/>
	);
}

function Link({ entry, write }: FieldSetProps) {
	const website = valuesOf(entry).website ?? { url: "", label: "", inlineLink: false };
	// Where the link prints is each document's choice; the Profile keeps the link only.
	const document = useWriteSource().kind === "resume";
	return (
		<WebsiteField
			allowInlineLink={document}
			value={website}
			onChange={(value) =>
				write("website", (target) => {
					target.website = value;
				})
			}
		/>
	);
}

function Description({
	entry,
	write,
	field = "description",
	label,
}: FieldSetProps & { field?: string; label?: string }) {
	const labelClass = useFieldLabelClass();
	const name = label ?? t`Description`;
	return (
		<div className="col-span-full grid gap-1.5">
			<Label elementType="span" className={labelClass}>
				{name}
			</Label>
			<RichTextEditor
				label={name}
				placeholder={labelClass && name}
				value={str(valuesOf(entry)[field])}
				onChange={(html) =>
					write(field, (target) => {
						target[field] = html;
					})
				}
			/>
		</div>
	);
}

function Keywords({ entry, write, label }: FieldSetProps & { label: string }) {
	const labelClass = useFieldLabelClass();
	return (
		<FormItem className="col-span-full">
			<FormLabel className={labelClass}>{label}</FormLabel>
			<FormControl
				render={
					<ChipInput
						allowCommas
						{...(labelClass && { placeholder: label })}
						value={valuesOf(entry).keywords ?? []}
						onChange={(keywords) =>
							write("keywords", (target) => {
								target.keywords = keywords;
							})
						}
					/>
				}
			/>
		</FormItem>
	);
}

function Level({ entry, write }: FieldSetProps) {
	const level = Number(valuesOf(entry).level ?? 0);
	return (
		<div className="col-span-full">
			<CellSlider
				aria-label={t`Level`}
				minValue={0}
				maxValue={5}
				step={1}
				value={level}
				onChange={(value) => {
					if (typeof value !== "number") return;
					write("level", (target) => {
						target.level = value;
					});
				}}
			>
				<CellSlider.Track>
					<CellSlider.Fill />
					<CellSlider.Thumb />
					<CellSlider.Label>
						<Trans>Level</Trans>
					</CellSlider.Label>
					<CellSlider.Output>{level === 0 ? t`Hidden` : `${level} / 5`}</CellSlider.Output>
				</CellSlider.Track>
			</CellSlider>
		</div>
	);
}

/** The icon printed before the entry, and its colour (blank uses the template's). */
function IconAndColor({ entry, write }: FieldSetProps) {
	const values = valuesOf(entry);
	const iconStyle = useWriteIconStyle();
	return (
		<div className="col-span-full flex items-center gap-2">
			<IconPicker
				value={str(values.icon)}
				iconStyle={iconStyle}
				onChange={(icon: string) =>
					write("icon", (target) => {
						target.icon = icon;
					})
				}
				popoverProps={{ modal: true }}
			/>
			<ColorPicker
				value={str(values.iconColor)}
				onChange={(color) =>
					write("iconColor", (target) => {
						target.iconColor = color;
					})
				}
				trigger={
					<Button variant="secondary" size="sm">
						<span
							className="size-4 rounded-sm border border-border"
							style={{ backgroundColor: str(values.iconColor) || "currentColor" }}
						/>
						<Trans>Icon color</Trans>
					</Button>
				}
			/>
		</div>
	);
}

function Roles({ entry, write, page }: FieldSetProps) {
	const roles = valuesOf(entry).roles ?? [];
	const labelClass = useFieldLabelClass();

	const writeRoles = (key: string, mutate: (roles: RoleItem[]) => void) =>
		write(`roles:${key}`, (target) => {
			mutate(target.roles as RoleItem[]);
		});

	return (
		<div className="col-span-full grid gap-3">
			{roles.map((role, index) => (
				<div key={role.id} className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-surface p-3">
					<div className="col-span-full flex items-center justify-between">
						<span className="text-sm font-medium text-muted">
							<Trans>Role {index + 1}</Trans>
						</span>
						<div className="flex">
							<IconButton
								icon="arrow-up"
								label={t`Move role up`}
								size="sm"
								isDisabled={index === 0}
								onPress={() =>
									writeRoles(`move-${role.id}`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))
								}
							/>
							<IconButton
								icon="arrow-down"
								label={t`Move role down`}
								size="sm"
								isDisabled={index === roles.length - 1}
								onPress={() =>
									writeRoles(`move-${role.id}`, (list) => list.splice(index + 1, 0, ...list.splice(index, 1)))
								}
							/>
							<IconButton
								icon="trash"
								label={t`Remove role`}
								size="sm"
								onPress={() => writeRoles(`remove-${role.id}`, (list) => list.splice(index, 1))}
							/>
						</div>
					</div>
					<TextField
						label={t`Position`}
						value={role.position}
						wide
						onChange={(value) =>
							writeRoles(`${role.id}:position`, (list) => {
								const target = list[index];
								if (target) target.position = value;
							})
						}
					/>
					<DatesField
						className="col-span-full"
						dates={role.dates ?? EMPTY_RESUME_DATES}
						locale={page.locale}
						format={page.dateFormat}
						onChange={(dates) =>
							writeRoles(`${role.id}:dates`, (list) => {
								const target = list[index];
								if (target) target.dates = dates;
							})
						}
					/>
					<div className="col-span-full grid gap-1.5">
						<Label elementType="span" className={labelClass}>
							<Trans>Description</Trans>
						</Label>
						<RichTextEditor
							label={t`Description of role ${index + 1}`}
							placeholder={labelClass && t`Description`}
							value={role.description}
							onChange={(html) =>
								writeRoles(`${role.id}:description`, (list) => {
									const target = list[index];
									if (target) target.description = html;
								})
							}
						/>
					</div>
				</div>
			))}

			<Button
				variant="secondary"
				size="sm"
				className="w-fit"
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
				<Trans>Add role</Trans>
			</Button>
		</div>
	);
}

/** The fields each entry type edits, in a two-column grid. The first field takes focus on a new draft. */
export function EntryFields({
	type,
	autoFocus,
	...props
}: FieldSetProps & { type: CustomSectionType; autoFocus?: boolean | undefined }) {
	switch (type) {
		case "experience":
			return (
				<>
					<Text {...props} field="position" label={t`Position`} autoFocus={autoFocus} />
					<Text {...props} field="company" label={t`Company`} />
					<Text {...props} field="location" label={t`Location`} wide />
					<Dates {...props} />
					<Link {...props} />
					<Description {...props} />
					<Roles {...props} />
				</>
			);
		case "education":
			return (
				<>
					<Text {...props} field="school" label={t`School`} wide autoFocus={autoFocus} />
					<Text {...props} field="degree" label={t`Degree`} />
					<Text {...props} field="area" label={t`Area of study`} />
					<Text {...props} field="grade" label={t`Grade`} />
					<Text {...props} field="location" label={t`Location`} />
					<Dates {...props} />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "projects":
			return (
				<>
					<Text {...props} field="name" label={t`Name`} wide autoFocus={autoFocus} />
					<Dates {...props} />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "skills":
			return (
				<>
					<Text {...props} field="name" label={t`Name`} autoFocus={autoFocus} />
					<Text {...props} field="proficiency" label={t`Proficiency`} />
					<Keywords {...props} label={t`Keywords`} />
					<MoreOptions>
						<Level {...props} />
						<IconAndColor {...props} />
					</MoreOptions>
				</>
			);
		case "languages":
			return (
				<>
					<Text {...props} field="language" label={t`Language`} autoFocus={autoFocus} />
					<Text {...props} field="fluency" label={t`Fluency`} />
					<MoreOptions>
						<Level {...props} />
					</MoreOptions>
				</>
			);
		case "interests":
			return (
				<>
					<Text {...props} field="name" label={t`Name`} wide autoFocus={autoFocus} />
					<Keywords {...props} label={t`Keywords`} />
					<MoreOptions>
						<IconAndColor {...props} />
					</MoreOptions>
				</>
			);
		case "awards":
			return (
				<>
					<Text {...props} field="title" label={t`Title`} autoFocus={autoFocus} />
					<Text {...props} field="awarder" label={t`Awarder`} />
					<Dates {...props} single />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "certifications":
			return (
				<>
					<Text {...props} field="title" label={t`Title`} autoFocus={autoFocus} />
					<Text {...props} field="issuer" label={t`Issuer`} />
					<Dates {...props} single />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "publications":
			return (
				<>
					<Text {...props} field="title" label={t`Title`} autoFocus={autoFocus} />
					<Text {...props} field="publisher" label={t`Publisher`} />
					<Dates {...props} single />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "volunteer":
			return (
				<>
					<Text {...props} field="organization" label={t`Organization`} autoFocus={autoFocus} />
					<Text {...props} field="location" label={t`Location`} />
					<Dates {...props} />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "references":
			return (
				<>
					<Text {...props} field="name" label={t`Name`} autoFocus={autoFocus} />
					<Text {...props} field="position" label={t`Position`} />
					<Text {...props} field="phone" label={t`Phone`} wide />
					<Link {...props} />
					<Description {...props} />
				</>
			);
		case "profiles":
			return (
				<>
					<Text {...props} field="network" label={t`Network`} autoFocus={autoFocus} />
					<Text {...props} field="username" label={t`Username`} />
					<Link {...props} />
					<MoreOptions>
						<IconAndColor {...props} />
					</MoreOptions>
				</>
			);
		case "summary":
			return <Description {...props} field="content" label={t`Text`} />;
		// Letters are documents of their own; a resume that still carries one hands it over when it saves.
		case "cover-letter":
			return null;
	}
}
