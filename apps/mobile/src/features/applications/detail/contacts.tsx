// The people for this job (the web's detail/contacts.tsx): each with a label, role, email and phone. A tap edits one,
// Add opens the same form; removing one has Undo. Saved with the API's own contact schema.
import type { Application } from "../types";
import type { Contact } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { contactSchema } from "@rezumi/schema/applications/data";
import { useApplicationMutations } from "../queries";
import { FormField } from "./form-field";
import { DetailSection } from "./section";
import { Button, Chip, EmptyState, Icon, IconButton, ListRow, ListSection, Sheet, showToast } from "@/ui";

type ContactsProps = { application: Application };

const EMPTY: Contact = { name: "", role: "", type: "", email: "", phone: "" };

export function Contacts({ application }: ContactsProps) {
	const { t } = useLingui();
	const { update } = useApplicationMutations();
	const [editing, setEditing] = useState<{ index: number | null; contact: Contact } | null>(null);
	const contacts = application.contacts;
	const save = (next: Contact[], onSuccess?: () => void) =>
		update.mutate(
			{ id: application.id, contacts: next },
			{
				onSuccess: () => onSuccess?.(),
				onError: () => showToast({ title: t`Couldn't save the contacts. Try again.`, variant: "danger" }),
			},
		);
	const remove = (index: number) => {
		const before = contacts;
		const name = contacts[index]?.name ?? "";
		save(contacts.filter((_, at) => at !== index));
		showToast({ title: t`${name} removed`, undo: { label: t`Undo`, onUndo: () => save([...before]) } });
	};

	return (
		<DetailSection
			title={t`Contacts`}
			testID="contacts"
			action={
				<Button
					size="sm"
					variant="ghost"
					onPress={() => setEditing({ index: null, contact: EMPTY })}
					testID="contact-add"
				>
					<Icon name="plus" size={16} />
					<Button.Label>{t`Add`}</Button.Label>
				</Button>
			}
		>
			{contacts.length === 0 ? (
				<EmptyState
					kind="inline"
					title={t`No contacts yet`}
					description={t`Add the recruiter or the hiring manager.`}
				/>
			) : (
				<ListSection>
					{contacts.map((contact, index) => (
						<ListRow
							key={`${contact.name}-${index}`}
							icon="user-circle"
							title={contact.type ? `${contact.name} · ${contact.type}` : contact.name}
							description={[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || undefined}
							accessibilityHint={t`Edits the contact`}
							onPress={() => setEditing({ index, contact })}
							trailing={
								<IconButton
									icon="x"
									size="sm"
									label={t`Remove ${contact.name}`}
									isDisabled={update.isPending}
									onPress={() => remove(index)}
								/>
							}
						/>
					))}
				</ListSection>
			)}
			<Sheet
				isOpen={editing !== null}
				onOpenChange={(open) => !open && setEditing(null)}
				title={editing?.index === null ? t`Add contact` : t`Edit contact`}
				closeLabel={t`Close`}
			>
				{editing ? (
					<ContactForm
						key={editing.index ?? "new"}
						initial={editing.contact}
						busy={update.isPending}
						onSave={(contact) =>
							save(
								editing.index === null
									? [...contacts, contact]
									: contacts.map((item, at) => (at === editing.index ? contact : item)),
								() => setEditing(null),
							)
						}
					/>
				) : null}
			</Sheet>
		</DetailSection>
	);
}

type ContactFormProps = { initial: Contact; busy: boolean; onSave: (contact: Contact) => void };

function ContactForm({ initial, busy, onSave }: ContactFormProps) {
	const { t } = useLingui();
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	const set = (key: keyof Contact) => (value: string) => {
		setError(null);
		setDraft((current) => ({ ...current, [key]: value }));
	};
	const labels = [t`Recruiter`, t`Hiring manager`, t`Referral`, t`Interviewer`];
	const submit = () => {
		const parsed = contactSchema.safeParse(draft);
		if (!parsed.success) return setError(t`Enter a valid email address, or leave it empty.`);
		onSave(parsed.data);
	};
	return (
		<View className="gap-4 pb-2">
			<FormField label={t`Name`} value={draft.name} onChangeText={set("name")} isRequired autoFocus />
			<FormField label={t`Label`} value={draft.type} placeholder={t`Recruiter`} onChangeText={set("type")} />
			<View className="flex-row flex-wrap gap-2">
				{labels.map((label) => (
					<Chip
						key={label}
						variant={draft.type === label ? "primary" : "secondary"}
						color={draft.type === label ? "accent" : "default"}
						accessibilityRole="button"
						accessibilityState={{ selected: draft.type === label }}
						onPress={() => set("type")(label)}
					>
						<Chip.Label>{label}</Chip.Label>
					</Chip>
				))}
			</View>
			<FormField label={t`Role (optional)`} value={draft.role} onChangeText={set("role")} />
			<FormField
				label={t`Email (optional)`}
				value={draft.email}
				keyboardType="email-address"
				autoCapitalize="none"
				autoCorrect={false}
				error={error}
				onChangeText={set("email")}
			/>
			<FormField label={t`Phone (optional)`} value={draft.phone} keyboardType="phone-pad" onChangeText={set("phone")} />
			<Button variant="primary" isDisabled={!draft.name.trim() || busy} onPress={submit} testID="contact-save">
				<Button.Label>{t`Save contact`}</Button.Label>
			</Button>
		</View>
	);
}
