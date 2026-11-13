import type { Basics, CustomField } from "@rezumi/schema/resume/data";
import { Button, ButtonGroup, Disclosure, Input, Popover, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { generateId } from "@rezumi/utils/string";
import { useEditorStore } from "../store";
import { TextField, validateEmail, WebsiteField } from "./fields";
import { PictureSettings } from "./picture-settings";
import { ProfileMarker } from "./profile-link";
import { useWriteIconStyle, useWriteSelector, useWriteSource, useWriteUpdate } from "./source";
import { IconPicker } from "@/components/input/icon-picker";
import { INPUT_WITH_ICON, WithInputIcon } from "@/components/input/input-icon";

type TextKey = "name" | "headline" | "email" | "phone" | "location";

function useBasicsWriter() {
	const update = useWriteUpdate();
	return (key: string, mutate: (basics: Basics) => void) =>
		update((draft) => mutate(draft.basics), { coalesceKey: `basics.${key}` });
}

type BasicsCardProps = { locked: boolean };

/**
 * The About widget: the page header's details. Its header names it and, closed, shows "name · headline"; open, it
 * holds the photo, contact fields and custom fields. Selecting the header on the page opens it. On the Profile it
 * holds the same details, which documents take from it.
 */
export function BasicsCard({ locked }: BasicsCardProps) {
	const basics = useWriteSelector((data) => data.basics);
	const profile = useWriteSource().kind === "profile";
	const open = useEditorStore((state) => state.basicsOpen);
	const write = useBasicsWriter();

	const text = (key: TextKey) => ({
		value: basics[key],
		labelAction: <ProfileMarker part={{ kind: "basics", field: key }} />,
		onChange: (value: string) =>
			write(key, (target) => {
				target[key] = value;
			}),
	});

	return (
		<section id="sidebar-basics" aria-label={profile ? t`Your details` : t`About`} className="scroll-mt-[60px] px-1">
			<Disclosure isExpanded={open} onExpandedChange={(next) => useEditorStore.setState({ basicsOpen: next })}>
				<Disclosure.Heading className="min-w-0">
					<Disclosure.Trigger className="flex min-h-8 w-full cursor-(--cursor-interactive) items-center gap-2 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-focus">
						<Icon name="user-circle" size={20} className="shrink-0 text-muted [&_*]:stroke-2" />
						<span className="shrink-0 text-sm font-semibold">
							{profile ? <Trans>Your details</Trans> : <Trans>About</Trans>}
						</span>
						<Disclosure.Indicator className="ms-auto text-muted" />
					</Disclosure.Trigger>
				</Disclosure.Heading>

				{/* `*:p-0`: Disclosure.Body pads an outer wrapper its className doesn't reach. */}
				<Disclosure.Content className="*:p-0">
					<Disclosure.Body className="p-0 pt-3">
						<div className="@container px-0.5">
							<fieldset
								disabled={locked}
								className="m-0 grid min-w-0 grid-cols-1 gap-x-3 gap-y-4 border-0 p-0 @xs:grid-cols-2"
							>
								<PhotoRow locked={locked} />
								<TextField
									label={<Trans>Full name</Trans>}
									icon="user-circle"
									wide
									autoComplete="name"
									// A blank resume opens straight into the name field.
									autoFocus={!locked && !profile && !basics.name}
									{...text("name")}
								/>
								<TextField label={<Trans>Headline</Trans>} icon="briefcase" wide {...text("headline")} />
								<TextField
									label={<Trans>Email</Trans>}
									icon="envelope"
									type="email"
									autoComplete="email"
									validate={validateEmail}
									{...text("email")}
								/>
								<TextField label={<Trans>Phone</Trans>} icon="phone" type="tel" autoComplete="tel" {...text("phone")} />
								<TextField label={<Trans>Location</Trans>} icon="map-pin" wide {...text("location")} />
								<WebsiteField
									label={<Trans>Website</Trans>}
									labelAction={<ProfileMarker part={{ kind: "basics", field: "website" }} />}
									value={basics.website}
									allowInlineLink={false}
									onChange={(website) =>
										write("website", (target) => {
											target.website = { url: website.url, label: website.label };
										})
									}
								/>
								<CustomFields fields={basics.customFields} locked={locked} />
							</fieldset>
						</div>
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</section>
	);
}

type PhotoRowProps = { locked: boolean };

function PhotoRow({ locked }: PhotoRowProps) {
	const picture = useWriteSelector((data) => data.picture);
	const profile = useWriteSource().kind === "profile";
	const hasPhoto = Boolean(picture.url);

	return (
		<div
			id="sidebar-picture"
			className="col-span-full flex items-center gap-3 rounded-xl border border-separator bg-surface p-2.5"
		>
			{hasPhoto ? (
				<img src={picture.url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
			) : (
				<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted">
					<Icon name="camera-plus" />
				</span>
			)}
			<p className="min-w-0 flex-1 text-xs text-muted">
				{!hasPhoto ? (
					<Trans>No photo. Most ATS ignore photos; some regions expect one.</Trans>
				) : profile ? (
					<Trans>Documents that show a photo use this one.</Trans>
				) : picture.hidden ? (
					<Trans>Photo hidden from the page.</Trans>
				) : (
					<Trans>Photo on the page.</Trans>
				)}
			</p>
			<ProfileMarker part={{ kind: "picture" }} />
			<Popover>
				<Button variant="secondary" size="sm" isDisabled={locked}>
					{hasPhoto ? <Trans>Edit</Trans> : <Trans>Add</Trans>}
				</Button>
				<Popover.Content placement="bottom end" className="max-h-[70svh] w-[360px] overflow-y-auto">
					<Popover.Dialog className="p-4">
						{/* The photo's frame (size, shape, border) belongs to each document; the Profile keeps the picture. */}
						<PictureSettings frame={!profile} />
					</Popover.Dialog>
				</Popover.Content>
			</Popover>
		</div>
	);
}

/**
 * Extra details (icon, an optional label, text and an optional link), as "Add field" under Website. A labelled field
 * prints as "Label: text", or as a row of the personal details table in templates that have one (Wibawa, Tenun).
 */
type CustomFieldsProps = { fields: CustomField[]; locked: boolean };
function CustomFields({ fields, locked }: CustomFieldsProps) {
	const update = useWriteUpdate();
	const iconStyle = useWriteIconStyle();

	const edit = (key: string, mutate: (list: CustomField[]) => void) =>
		update((draft) => mutate(draft.basics.customFields), { coalesceKey: `basics.customFields.${key}` });

	return (
		<div className="col-span-full grid gap-3">
			{fields.map((field, index) => (
				<CustomFieldRow key={field.id} field={field} index={index} locked={locked} iconStyle={iconStyle} edit={edit} />
			))}
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					isDisabled={locked}
					className="w-fit text-accent-soft-foreground"
					onPress={() => edit("add", (list) => list.push({ id: generateId(), icon: "acorn", text: "", link: "" }))}
				>
					<Icon name="plus" size={18} />
					<Trans>Add field</Trans>
				</Button>
				<ProfileMarker part={{ kind: "basics", field: "customFields" }} />
			</div>
		</div>
	);
}

type CustomFieldRowProps = {
	field: CustomField;
	index: number;
	locked: boolean;
	iconStyle: ReturnType<typeof useWriteIconStyle>;
	edit: (key: string, mutate: (list: CustomField[]) => void) => void;
};

/**
 * One custom field: its icon, its text, and a group of buttons (label, link, move up, remove). The label's own field
 * shows under the text only once it's asked for, or when the field already has one.
 */
function CustomFieldRow({ field, index, locked, iconStyle, edit }: CustomFieldRowProps) {
	const [labelOpen, setLabelOpen] = useState(Boolean(field.label));
	// A label that appears from elsewhere (an undo, a restore) shows its field too.
	if (field.label && !labelOpen) setLabelOpen(true);

	// Hiding the label field drops its text, so what shows is what prints.
	const toggleLabel = () => {
		if (labelOpen && field.label)
			edit(`${field.id}.label`, (list) => {
				const target = list[index];
				if (target) target.label = "";
			});
		setLabelOpen(!labelOpen);
	};

	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1.5">
			<IconPicker
				isDisabled={locked}
				// The same fill and radius as the text field beside it.
				className="rounded-field shadow-field [--button-bg-hover:var(--field-hover)] [--button-bg-pressed:var(--field-hover)] [--button-bg:var(--field-background)]"
				value={field.icon}
				iconStyle={iconStyle}
				popoverProps={{ modal: true }}
				onChange={(icon) =>
					edit(`${field.id}.icon`, (list) => {
						const target = list[index];
						if (target) target.icon = icon;
					})
				}
			/>
			<WithInputIcon icon="text-t">
				<Input
					className={INPUT_WITH_ICON}
					fullWidth
					variant="secondary"
					disabled={locked}
					aria-label={t`Field ${index + 1}`}
					placeholder={t`Text, e.g. Indonesian`}
					value={field.text}
					onChange={(event) =>
						edit(`${field.id}.text`, (list) => {
							const target = list[index];
							if (target) target.text = event.target.value;
						})
					}
				/>
			</WithInputIcon>
			<ButtonGroup variant="tertiary">
				<Tooltip>
					<Button
						isIconOnly
						variant="tertiary"
						aria-label={labelOpen ? t`Remove label` : t`Add a label`}
						aria-pressed={labelOpen}
						isDisabled={locked}
						className={labelOpen ? "text-accent" : "text-muted"}
						onPress={toggleLabel}
					>
						<Icon name="tag" size={16} />
					</Button>
					<Tooltip.Content>{labelOpen ? t`Remove label` : t`Add a label`}</Tooltip.Content>
				</Tooltip>
				<Popover>
					<Tooltip>
						<Button
							isIconOnly
							variant="tertiary"
							aria-label={field.link ? t`Edit link` : t`Add a link`}
							isDisabled={locked}
							className={field.link ? "text-accent" : "text-muted"}
						>
							<ButtonGroup.Separator />
							<Icon name={field.link ? "link-simple-horizontal" : "link-simple-horizontal-break"} size={16} />
						</Button>
						<Tooltip.Content>{field.link ? t`Edit link` : t`Add a link`}</Tooltip.Content>
					</Tooltip>
					<Popover.Content placement="bottom end" className="w-72">
						<Popover.Dialog>
							<WithInputIcon icon="link-simple-horizontal">
								<Input
									className={INPUT_WITH_ICON}
									fullWidth
									variant="secondary"
									disabled={locked}
									type="url"
									aria-label={t`Link address`}
									placeholder="https://"
									value={field.link}
									onChange={(event) =>
										edit(`${field.id}.link`, (list) => {
											const target = list[index];
											if (target) target.link = event.target.value;
										})
									}
								/>
							</WithInputIcon>
						</Popover.Dialog>
					</Popover.Content>
				</Popover>
				<Tooltip>
					<Button
						isIconOnly
						variant="tertiary"
						aria-label={t`Move field up`}
						isDisabled={locked || index === 0}
						className="text-muted"
						onPress={() => edit(`${field.id}.move`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))}
					>
						<ButtonGroup.Separator />
						<Icon name="arrow-up" size={16} />
					</Button>
					<Tooltip.Content>{t`Move field up`}</Tooltip.Content>
				</Tooltip>
				<Tooltip>
					<Button
						isIconOnly
						variant="tertiary"
						aria-label={t`Remove field`}
						isDisabled={locked}
						className="text-muted"
						onPress={() => edit(`${field.id}.remove`, (list) => list.splice(index, 1))}
					>
						<ButtonGroup.Separator />
						<Icon name="x" size={16} />
					</Button>
					<Tooltip.Content>{t`Remove field`}</Tooltip.Content>
				</Tooltip>
			</ButtonGroup>
			{labelOpen && (
				<WithInputIcon icon="tag" className="col-span-2 col-start-2">
					<Input
						className={INPUT_WITH_ICON}
						fullWidth
						variant="secondary"
						disabled={locked}
						autoFocus={!field.label}
						aria-label={t`Label for field ${index + 1}`}
						placeholder={t`Label, e.g. Languages`}
						value={field.label ?? ""}
						onChange={(event) =>
							edit(`${field.id}.label`, (list) => {
								const target = list[index];
								if (target) target.label = event.target.value;
							})
						}
					/>
				</WithInputIcon>
			)}
		</div>
	);
}
