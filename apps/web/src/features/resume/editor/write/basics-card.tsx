import type { Basics, CustomField } from "@rezumi/schema/resume/data";
import { Widget } from "@heroui-pro/react";
import { Button, Disclosure, Input, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { generateId } from "@rezumi/utils/string";
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
 * The About widget: the page header's details. Its header names it and, closed, shows "name · headline"; open, it
 * holds the photo, contact fields and custom fields. Selecting the header on the page opens it.
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
		<Widget
			id="sidebar-basics"
			role="region"
			aria-label={t`About`}
			className={cn(
				"scroll-mt-[60px] transition-shadow duration-quick",
				selected && "ring-2 ring-accent",
				!open && "pb-0.5",
			)}
		>
			<Disclosure isExpanded={open} onExpandedChange={(next) => useEditorStore.setState({ basicsOpen: next })}>
				{/* The trigger sits in Widget.Header, so a folded widget keeps HeroUI's header size and padding. */}
				<Widget.Header>
					<Disclosure.Heading className="min-w-0 flex-1">
						<Disclosure.Trigger className="flex min-h-8 w-full cursor-(--cursor-interactive) items-center gap-2 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-focus">
							<Icon name="user-circle" size={16} className="shrink-0 text-muted" />
							<Widget.Title className="shrink-0">
								<Trans>About</Trans>
							</Widget.Title>
							{/* Closed, the header still says whose resume this is. */}
							<Widget.Description className={cn("min-w-0 flex-1 truncate", open && "invisible")}>
								{[basics.name, basics.headline].filter((part) => part.trim()).join(" · ")}
							</Widget.Description>
							<Disclosure.Indicator className="ms-auto text-muted" />
						</Disclosure.Trigger>
					</Disclosure.Heading>
				</Widget.Header>

				{/* `*:p-0`: Disclosure.Body pads an outer wrapper its className doesn't reach; the widget's own insets apply. */}
				<Disclosure.Content className="*:p-0">
					{/* `pt-px`: room for the content's hairline under the header, which the panel's clip would cut. */}
					<Disclosure.Body className="p-0 pt-px">
						<Widget.Content className="fields-on-background @container mt-0">
							<fieldset
								disabled={locked}
								className="m-0 grid min-w-0 grid-cols-1 gap-x-3 gap-y-4 border-0 p-0 @xs:grid-cols-2"
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
						</Widget.Content>
					</Disclosure.Body>
				</Disclosure.Content>
			</Disclosure>
		</Widget>
	);
}

function PhotoRow({ locked }: { locked: boolean }) {
	const picture = useCurrentBuilderResumeSelector((resume) => resume.data.picture);
	const hasPhoto = Boolean(picture.url);

	return (
		<div
			id="sidebar-picture"
			className="fields-on-card col-span-full flex items-center gap-3 rounded-xl bg-background p-2.5"
		>
			{hasPhoto ? (
				<img src={picture.url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
			) : (
				<span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted">
					<Icon name="camera-plus" />
				</span>
			)}
			<p className="min-w-0 flex-1 text-xs leading-4 text-muted">
				{!hasPhoto ? (
					<Trans>No photo. Most ATS ignore photos; some regions expect one.</Trans>
				) : picture.hidden ? (
					<Trans>Photo hidden from the page.</Trans>
				) : (
					<Trans>Photo on the page.</Trans>
				)}
			</p>
			<Popover>
				<Button variant="secondary" size="sm" isDisabled={locked}>
					{hasPhoto ? <Trans>Edit</Trans> : <Trans>Add</Trans>}
				</Button>
				<Popover.Content placement="bottom end" className="max-h-[70svh] w-[360px] overflow-y-auto">
					<Popover.Dialog className="p-4">
						<PictureSettings />
					</Popover.Dialog>
				</Popover.Content>
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
						isDisabled={locked}
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
						variant="secondary"
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
						<IconButton
							icon={field.link ? "link-simple-horizontal" : "link-simple-horizontal-break"}
							label={field.link ? t`Edit link` : t`Add a link`}
							size="sm"
							isDisabled={locked}
							className={field.link ? "text-accent" : "text-muted"}
						/>
						<Popover.Content placement="bottom end" className="w-72">
							<Popover.Dialog>
								<Input
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
							</Popover.Dialog>
						</Popover.Content>
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
			<Button
				variant="ghost"
				isDisabled={locked}
				className="w-fit text-accent-soft-foreground"
				onPress={() => edit("add", (list) => list.push({ id: generateId(), icon: "acorn", text: "", link: "" }))}
			>
				<Icon name="plus" size={18} />
				<Trans>Add field</Trans>
			</Button>
		</div>
	);
}
