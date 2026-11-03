import type { Contact } from "@rezumi/schema/applications/data";
import { EmptyState, Widget } from "@heroui-pro/react";
import { Button, Input, Popover } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useState } from "react";
import { contactSchema } from "@rezumi/schema/applications/data";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { FIELD_CLASS } from "./field-style";
import { RowIcon } from "@/components/layout/icon-row";
import { WidgetAction, WidgetHeading } from "@/components/layout/widget-heading";
import { SettingsRows } from "@/features/settings/section";

const EMPTY_CONTACT = { name: "", role: "", type: "", email: "", phone: "" };

const TYPES = () => [t`Recruiter`, t`Hiring manager`, t`Referral`, t`Interviewer`];

type ContactsProps = { contacts: Contact[]; disabled: boolean; onChange: (contacts: Contact[]) => void };

/** The Contact cell: the primary contact (the first), and the full list, with add and remove, in a popover. */
export function Contacts({ contacts, disabled, onChange }: ContactsProps) {
	const [primary, ...others] = contacts;

	return (
		<Popover>
			<Popover.Trigger className={cn(FIELD_CLASS, "gap-2 hover:bg-default")}>
				{primary ? (
					<span className="min-w-0 flex-1 truncate">{primary.name}</span>
				) : (
					<span className="min-w-0 flex-1 truncate font-normal text-muted">
						<Trans>Add a contact</Trans>
					</span>
				)}
				{others.length > 0 && <span className="shrink-0 text-xs font-normal text-muted">+{others.length}</span>}
			</Popover.Trigger>
			<Popover.Content placement="bottom end" offset={8} className="w-96 max-w-[calc(100vw-2rem)]">
				<ContactsWidget contacts={contacts} disabled={disabled} onChange={onChange} />
			</Popover.Content>
		</Popover>
	);
}

/** The popover's body: a Widget with the contacts as rows, or an empty state, and a form to add one. */
function ContactsWidget({ contacts, disabled, onChange }: ContactsProps) {
	const titleId = useId();
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState(EMPTY_CONTACT);
	const [error, setError] = useState("");
	const empty = contacts.length === 0 && !adding;

	const add = () => {
		if (!draft.name.trim()) return;
		// Checked with the API's schema here, so a mistyped email is caught before the draft is thrown away.
		const parsed = contactSchema.safeParse(draft);
		if (!parsed.success) return setError(t`Enter a valid email address.`);
		onChange([...contacts, parsed.data]);
		setDraft(EMPTY_CONTACT);
		setError("");
		setAdding(false);
	};

	const field = (key: keyof typeof EMPTY_CONTACT, label: string, type = "text") => (
		<Input
			fullWidth
			aria-label={label}
			placeholder={label}
			type={type}
			value={draft[key]}
			onChange={(event) => {
				setError("");
				setDraft((current) => ({ ...current, [key]: event.target.value }));
			}}
		/>
	);

	return (
		<Popover.Dialog aria-labelledby={titleId} className="p-1.5">
			<Widget>
				<WidgetHeading
					id={titleId}
					icon="user-circle"
					title={<Trans>Contacts</Trans>}
					count={contacts.length > 0 ? contacts.length : undefined}
					action={
						!empty &&
						!adding && (
							<WidgetAction isDisabled={disabled} onPress={() => setAdding(true)}>
								<Icon name="plus" size={16} />
								<Trans>Add contact</Trans>
							</WidgetAction>
						)
					}
				/>
				<Widget.Content className="grid gap-4">
					{empty && (
						<EmptyState size="sm">
							<EmptyState.Header>
								<EmptyState.Media variant="icon">
									<Icon name="user-plus" size={20} />
								</EmptyState.Media>
								<EmptyState.Title>
									<Trans>No contacts yet</Trans>
								</EmptyState.Title>
								<EmptyState.Description>
									<Trans>Recruiters, interviewers and referrals for this job.</Trans>
								</EmptyState.Description>
							</EmptyState.Header>
							<EmptyState.Content>
								<Button variant="secondary" size="sm" isDisabled={disabled} onPress={() => setAdding(true)}>
									<Icon name="plus" size={16} />
									<Trans>Add contact</Trans>
								</Button>
							</EmptyState.Content>
						</EmptyState>
					)}

					{contacts.length > 0 && (
						<SettingsRows>
							{contacts.map((contact, index) => (
								<li key={`${contact.name}-${index}`} className="flex items-center gap-3">
									<RowIcon className="font-semibold text-muted">{contact.name.slice(0, 1).toUpperCase()}</RowIcon>
									<div className="grid min-w-0 flex-1 text-sm">
										<span className="truncate font-medium">
											{contact.name}
											{contact.type && <span className="font-normal text-muted"> · {contact.type}</span>}
										</span>
										{contact.role && <span className="truncate text-xs text-muted">{contact.role}</span>}
										{contact.email && (
											<a
												href={`mailto:${contact.email}`}
												className="truncate text-xs text-accent-soft-foreground hover:underline"
											>
												{contact.email}
											</a>
										)}
										{contact.phone && (
											<a
												href={`tel:${contact.phone}`}
												className="truncate text-xs text-accent-soft-foreground hover:underline"
											>
												{contact.phone}
											</a>
										)}
									</div>
									<Button
										isIconOnly
										size="sm"
										variant="ghost"
										isDisabled={disabled}
										aria-label={t`Remove ${contact.name}`}
										onPress={() => onChange(contacts.filter((_, i) => i !== index))}
									>
										<Icon name="x" size={16} />
									</Button>
								</li>
							))}
						</SettingsRows>
					)}

					{adding && (
						<form
							className="grid gap-2 rounded-xl bg-surface-secondary p-3"
							onSubmit={(event) => {
								event.preventDefault();
								add();
							}}
						>
							{field("name", t`Name`)}
							{field("role", t`Job title (optional)`)}
							<div className="grid grid-cols-2 gap-2">
								{field("email", t`Email (optional)`, "email")}
								{field("phone", t`Phone (optional)`, "tel")}
							</div>
							<div role="group" aria-label={t`Label`} className="flex flex-wrap gap-1.5">
								{TYPES().map((type) => (
									<Button
										key={type}
										size="sm"
										variant={draft.type === type ? "primary" : "tertiary"}
										aria-pressed={draft.type === type}
										className={cn("rounded-full", draft.type !== type && "bg-surface text-muted hover:bg-default")}
										onPress={() => setDraft((current) => ({ ...current, type: current.type === type ? "" : type }))}
									>
										{type}
									</Button>
								))}
							</div>
							{error && <p className="text-xs text-danger-soft-foreground">{error}</p>}
							<div className="flex justify-end gap-1.5">
								<Button
									size="sm"
									variant="ghost"
									onPress={() => {
										setAdding(false);
										setDraft(EMPTY_CONTACT);
										setError("");
									}}
								>
									<Trans>Cancel</Trans>
								</Button>
								<Button type="submit" size="sm" isDisabled={!draft.name.trim() || disabled}>
									<Trans>Add</Trans>
								</Button>
							</div>
						</form>
					)}
				</Widget.Content>
			</Widget>
		</Popover.Dialog>
	);
}
