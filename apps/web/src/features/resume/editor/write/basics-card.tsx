import type { SortableTarget } from "@/components/input/sortable";
import type { Basics, CustomField } from "@rezumi/schema/resume/data";
import { Button, Disclosure, Dropdown, Input, Label, Popover, Separator, Tooltip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { getContactIcon } from "@rezumi/resume/icons";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { generateId } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { TextField, validateEmail, WebsiteField } from "./fields";
import { PictureSettings } from "./picture-settings";
import { ProfileMarker } from "./profile-link";
import { useWriteIconStyle, useWriteSelector, useWriteSource, useWriteUpdate } from "./source";
import { IconPicker } from "@/components/input/icon-picker";
import { INPUT_WITH_ICON, WithInputIcon } from "@/components/input/input-icon";
import { SortableEdge, SortableHandle, SortableProvider, useSortableItem } from "@/components/input/sortable";

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
 * They sit in one card like a section's entries: rows split by hairlines, Add field as the last row. Fields reorder by
 * their grip: drag it, or Enter on it and the arrow keys.
 */
type CustomFieldsProps = { fields: CustomField[]; locked: boolean };
function CustomFields({ fields, locked }: CustomFieldsProps) {
	const update = useWriteUpdate();
	const iconStyle = useWriteIconStyle();

	const edit = (key: string, mutate: (list: CustomField[]) => void) =>
		update((draft) => mutate(draft.basics.customFields), { coalesceKey: `basics.customFields.${key}` });

	const move = (id: string, { index: to }: SortableTarget) =>
		edit(`${id}.move`, (list) => {
			const from = list.findIndex((field) => field.id === id);
			if (from === -1 || from === to) return;
			const [field] = list.splice(from, 1);
			if (field) list.splice(to, 0, field);
		});

	return (
		<div className="col-span-full divide-y divide-separator rounded-xl border border-separator bg-surface">
			<SortableProvider onMove={move}>
				{fields.map((field, index) => (
					<CustomFieldRow
						key={field.id}
						field={field}
						index={index}
						locked={locked}
						iconStyle={iconStyle}
						edit={edit}
					/>
				))}
			</SortableProvider>
			<div className="flex items-center gap-1 pe-1">
				<Button
					variant="ghost"
					isDisabled={locked}
					className="h-10 w-fit px-3 text-accent-soft-foreground"
					onPress={() => edit("add", (list) => list.push({ id: generateId(), icon: "", text: "", link: "" }))}
				>
					<Icon name="plus" size={18} />
					<Trans>Add field</Trans>
				</Button>
				<ProfileMarker part={{ kind: "basics", field: "customFields" }} />
			</div>
		</div>
	);
}

/** An icon nobody picked: none yet, the old default (which the icon set no longer draws), or the one the text suggested. */
const followsText = (field: CustomField) =>
	!field.icon || field.icon === "acorn" || field.icon === getContactIcon(field.text);

/** A bare text box in a row: no frame of its own, the light field fill (`fields-on-surface`'s) while typing in it. */
const ROW_INPUT =
	"h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-(--field-placeholder) focus:bg-background disabled:cursor-default";

type CustomFieldRowProps = {
	field: CustomField;
	index: number;
	locked: boolean;
	iconStyle: ReturnType<typeof useWriteIconStyle>;
	edit: (key: string, mutate: (list: CustomField[]) => void) => void;
};

/**
 * One custom field, written in place: its icon, its text, the link button (accent once there's a link) and a ⋯ menu
 * with the label and Remove. On hover the row slides over and its grip fades in, like an entry's; touch screens always
 * show it. Until an icon is picked, the icon follows the text: a network's logo for its address, a globe for another.
 * The label's own line shows under the text only once it's asked for, or when the field already has one.
 */
function CustomFieldRow({ field, index, locked, iconStyle, edit }: CustomFieldRowProps) {
	const [labelOpen, setLabelOpen] = useState(Boolean(field.label));
	// A label that appears from elsewhere (an undo, a restore) shows its field too.
	if (field.label && !labelOpen) setLabelOpen(true);
	const title = field.text.trim() || t`Field ${index + 1}`;
	const sortable = useSortableItem({ id: field.id, list: "custom-fields", index, label: title, isDisabled: locked });

	const write = (key: string, mutate: (target: CustomField) => void) =>
		edit(`${field.id}.${key}`, (list) => {
			const target = list[index];
			if (target) mutate(target);
		});

	// Hiding the label field drops its text, so what shows is what prints.
	const toggleLabel = () => {
		if (labelOpen && field.label) write("label", (target) => (target.label = ""));
		setLabelOpen(!labelOpen);
	};

	const slide =
		!locked &&
		"transition-[padding] duration-quick ease-out group-focus-within/field:ps-6.5 group-hover/field:ps-6.5 pointer-coarse:ps-6.5 motion-reduce:transition-none";

	return (
		<div {...sortable.dropTargetProps} className={cn("group/field relative", sortable.isDragging && "opacity-50")}>
			<SortableEdge edge={sortable.edge} />
			{!locked && (
				<SortableHandle
					item={sortable}
					label={t`Reorder ${title}`}
					iconSize={16}
					className="absolute inset-s-1 top-0 h-10 w-6 opacity-0 transition-opacity duration-quick group-focus-within/field:opacity-100 group-hover/field:opacity-100 pointer-coarse:opacity-100"
				/>
			)}
			<div className={cn("flex h-10 items-center gap-0.5 ps-1.5 pe-1", slide)}>
				<IconPicker
					isDisabled={locked}
					size="sm"
					className="size-7 min-w-0 shadow-none [--button-bg-hover:var(--field-hover)] [--button-bg-pressed:var(--field-hover)] [--button-bg:transparent]"
					value={field.icon === "acorn" ? "" : field.icon}
					iconStyle={iconStyle}
					popoverProps={{ modal: true }}
					onChange={(icon) => write("icon", (target) => (target.icon = icon))}
				/>
				<input
					className={ROW_INPUT}
					disabled={locked}
					aria-label={t`Field ${index + 1}`}
					placeholder={t`Text, e.g. Indonesian`}
					value={field.text}
					onChange={(event) => {
						const text = event.target.value;
						write("text", (target) => {
							if (followsText(target)) target.icon = getContactIcon(text);
							target.text = text;
						});
					}}
				/>
				<Popover>
					<Tooltip>
						<Button
							isIconOnly
							size="sm"
							variant="ghost"
							aria-label={field.link ? t`Edit link` : t`Add a link`}
							isDisabled={locked}
							className={field.link ? "text-accent" : "text-muted"}
						>
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
									onChange={(event) => write("link", (target) => (target.link = event.target.value))}
								/>
							</WithInputIcon>
						</Popover.Dialog>
					</Popover.Content>
				</Popover>
				<Dropdown>
					<IconButton icon="dots-three" label={t`Options for ${title}`} size="sm" isDisabled={locked} />
					<Dropdown.Popover placement="bottom end" className="w-52">
						<Dropdown.Menu>
							<Dropdown.Item id="label" textValue={labelOpen ? t`Remove label` : t`Add a label`} onAction={toggleLabel}>
								<Icon name="tag" className="text-muted" />
								<Label>{labelOpen ? t`Remove label` : t`Add a label`}</Label>
							</Dropdown.Item>
							<Separator />
							<Dropdown.Item
								id="remove"
								textValue={t`Remove field`}
								variant="danger"
								onAction={() => edit(`${field.id}.remove`, (list) => list.splice(index, 1))}
							>
								<Icon name="trash" />
								<Label>{t`Remove field`}</Label>
							</Dropdown.Item>
						</Dropdown.Menu>
					</Dropdown.Popover>
				</Dropdown>
			</div>
			{labelOpen && (
				<div className={cn("-mt-1 flex h-9 items-center gap-0.5 ps-1.5 pe-1", slide)}>
					<span className="grid size-7 shrink-0 place-items-center text-muted">
						<Icon name="tag" size={14} />
					</span>
					<input
						className={ROW_INPUT}
						disabled={locked}
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- the line was just asked for; typing goes there.
						autoFocus={!field.label}
						aria-label={t`Label for field ${index + 1}`}
						placeholder={t`Label, e.g. Languages`}
						value={field.label ?? ""}
						onChange={(event) => write("label", (target) => (target.label = event.target.value))}
					/>
				</div>
			)}
		</div>
	);
}
