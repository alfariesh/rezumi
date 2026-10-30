import type { Basics, CustomField } from "@rezumi/schema/resume/data";
import { Disclosure, Input, buttonVariants } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@rezumi/ui/components/popover";
import { generateId, getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useEditorStore } from "../store";
import { TextField, validateEmail, WebsiteField } from "./fields";
import { PictureSettings } from "./picture-settings";
import { IconPicker } from "@/components/input/icon-picker";
import { useCurrentBuilderResumeSelector, useUpdateResumeData } from "@/features/resume/builder/draft";

type TextKey = "name" | "headline" | "email" | "phone" | "location";

function useBasicsWriter() {
	const updateResumeData = useUpdateResumeData();
	return (key: string, mutate: (basics: Basics) => void) =>
		updateResumeData((draft) => mutate(draft.basics), { coalesceKey: `basics.${key}` });
}

/**
 * The Basics card: name and "headline · location" with an initials avatar, opening to the photo, contact
 * fields and custom fields. The page header selects it.
 */
export function BasicsCard({ locked }: { locked: boolean }) {
	const basics = useCurrentBuilderResumeSelector((resume) => resume.data.basics);
	const open = useEditorStore((state) => state.basicsOpen);
	const selected = useEditorStore((state) => state.selection?.kind === "header");
	const write = useBasicsWriter();

	const text = (key: TextKey) => ({
		value: basics[key],
		onChange: (value: string) =>
			write(key, (target) => {
				target[key] = value;
			}),
	});

	return (
		<section
			id="sidebar-basics"
			aria-label={t`Basics`}
			className={cn(
				"scroll-mt-[60px] rounded-xl border border-line bg-surface transition-[border-color] duration-quick",
				selected && "border-accent",
			)}
		>
			<Disclosure isExpanded={open} onExpandedChange={(next) => useEditorStore.setState({ basicsOpen: next })}>
				<Disclosure.Heading>
					<Disclosure.Trigger className="flex w-full items-center gap-3 rounded-xl p-3 text-start">
						<span
							aria-hidden="true"
							className="grid size-10 shrink-0 place-items-center rounded-sm bg-accent-soft text-sm font-semibold text-accent-text"
						>
							{getInitials(basics.name || "?")}
						</span>
						<span className="min-w-0 flex-1">
							<span className={cn("block truncate text-sm font-semibold", !basics.name && "text-ink-3")}>
								{basics.name || <Trans>Your name</Trans>}
							</span>
							<span className="block truncate text-xs text-ink-3">
								{[basics.headline, basics.location].filter((part) => part.trim()).join(" · ")}
							</span>
						</span>
						<Disclosure.Indicator className="text-ink-2" />
					</Disclosure.Trigger>
				</Disclosure.Heading>

				<Disclosure.Content>
					<Disclosure.Body>
						<fieldset
							disabled={locked}
							className="m-0 grid min-w-0 grid-cols-2 gap-x-3 gap-y-2.5 border-0 border-t border-line px-3 pt-3 pb-3.5"
						>
							<PhotoRow locked={locked} />
							<TextField
								label={<Trans>Full name</Trans>}
								wide
								autoComplete="name"
								// A blank resume opens straight into the name field.
								autoFocus={!locked && !basics.name}
								{...text("name")}
							/>
							<TextField label={<Trans>Headline</Trans>} wide {...text("headline")} />
							<TextField
								label={<Trans>Email</Trans>}
								type="email"
								autoComplete="email"
								validate={validateEmail}
								{...text("email")}
							/>
							<TextField label={<Trans>Phone</Trans>} type="tel" autoComplete="tel" {...text("phone")} />
							<TextField label={<Trans>Location</Trans>} wide {...text("location")} />
							<WebsiteField
								label={<Trans>Website</Trans>}
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
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</section>
	);
}

function PhotoRow({ locked }: { locked: boolean }) {
	const picture = useCurrentBuilderResumeSelector((resume) => resume.data.picture);
	const hasPhoto = Boolean(picture.url);

	return (
		<div id="sidebar-picture" className="col-span-full flex items-center gap-3 rounded-lg bg-bg p-2.5">
			{hasPhoto ? (
				<img src={picture.url} alt="" className="size-10 shrink-0 rounded-md object-cover" />
			) : (
				<span className="grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink-3">
					<Icon name="camera-plus" />
				</span>
			)}
			<p className="min-w-0 flex-1 text-xs leading-4 text-ink-2">
				{!hasPhoto ? (
					<Trans>No photo. Most ATS ignore photos; some regions expect one.</Trans>
				) : picture.hidden ? (
					<Trans>Photo hidden from the page.</Trans>
				) : (
					<Trans>Photo on the page.</Trans>
				)}
			</p>
			<Popover>
				<PopoverTrigger
					render={
						<button type="button" disabled={locked} className={buttonVariants({ variant: "secondary", size: "sm" })} />
					}
				>
					{hasPhoto ? <Trans>Edit</Trans> : <Trans>Add</Trans>}
				</PopoverTrigger>
				<PopoverContent align="end" className="max-h-[70svh] w-[360px] overflow-y-auto p-4">
					<PictureSettings />
				</PopoverContent>
			</Popover>
		</div>
	);
}

/** Extra contact details (icon, text and an optional link), as "Add field" under Website. */
type CustomFieldsProps = { fields: CustomField[]; locked: boolean };
function CustomFields({ fields, locked }: CustomFieldsProps) {
	const updateResumeData = useUpdateResumeData();

	const edit = (key: string, mutate: (list: CustomField[]) => void) =>
		updateResumeData((draft) => mutate(draft.basics.customFields), { coalesceKey: `basics.customFields.${key}` });

	return (
		<div className="col-span-full grid gap-2">
			{fields.map((field, index) => (
				<div key={field.id} className="flex items-center gap-1.5">
					<IconPicker
						disabled={locked}
						value={field.icon}
						popoverProps={{ modal: true }}
						onChange={(icon) =>
							edit(`${field.id}.icon`, (list) => {
								const target = list[index];
								if (target) target.icon = icon;
							})
						}
					/>
					<Input
						fullWidth
						disabled={locked}
						aria-label={t`Field ${index + 1}`}
						value={field.text}
						onChange={(event) =>
							edit(`${field.id}.text`, (list) => {
								const target = list[index];
								if (target) target.text = event.target.value;
							})
						}
					/>
					<Popover>
						<PopoverTrigger
							render={
								<button
									type="button"
									disabled={locked}
									aria-label={field.link ? t`Edit link` : t`Add a link`}
									className={buttonVariants({
										variant: "ghost",
										size: "sm",
										isIconOnly: true,
										className: field.link ? "text-accent-text" : "text-muted",
									})}
								/>
							}
						>
							<Icon name={field.link ? "link-simple-horizontal" : "link-simple-horizontal-break"} />
						</PopoverTrigger>
						<PopoverContent align="end" className="w-72">
							<Input
								fullWidth
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
						</PopoverContent>
					</Popover>
					<IconButton
						icon="arrow-up"
						label={t`Move field up`}
						size="sm"
						isDisabled={locked || index === 0}
						onPress={() => edit(`${field.id}.move`, (list) => list.splice(index - 1, 0, ...list.splice(index, 1)))}
					/>
					<IconButton
						icon="x"
						label={t`Remove field`}
						isDisabled={locked}
						size="sm"
						onPress={() => edit(`${field.id}.remove`, (list) => list.splice(index, 1))}
					/>
				</div>
			))}
			<button
				type="button"
				disabled={locked}
				className="flex h-9 w-fit items-center gap-1.5 rounded-lg px-2 text-sm text-accent-text hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
				onClick={() => edit("add", (list) => list.push({ id: generateId(), icon: "acorn", text: "", link: "" }))}
			>
				<Icon name="plus" size={18} />
				<Trans>Add field</Trans>
			</button>
		</div>
	);
}
