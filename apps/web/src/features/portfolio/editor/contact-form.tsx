import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WHATSAPP_NUMBER_PATTERN } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { LocationFields } from "../location/location-fields";
import { useDraftText } from "../metrics/use-draft-text";
import { TextInput } from "./fields";
import { editPortfolio, usePortfolioData } from "./store";
import { orpc } from "@/libs/orpc/client";

const { text: max } = PORTFOLIO_LIMITS;

/**
 * Digits only, without a leading 0 or +: "0812-5550-1824" in Indonesia becomes "6281255501824". A trunk "(0)" written
 * after the country code ("+44 (0)20…") is left out.
 */
export function normalizeWhatsAppNumber(text: string, defaultCountryCode = "62"): string {
	const digits = text.replace(/\(0\)/g, "").replace(/\D/g, "");
	if (!digits) return "";
	if (text.trim().startsWith("+")) return digits;
	if (digits.startsWith("0")) return `${defaultCountryCode}${digits.replace(/^0+/, "")}`;
	return digits;
}

/**
 * Contact: the invitation, which of the resume's details show (email and website on, phone off by default), WhatsApp,
 * profiles, the contact form, and the Location card with its optional map.
 */
export function ContactForm() {
	const { contact } = usePortfolioData();
	const { data: portfolio } = useQuery(orpc.portfolio.get.queryOptions());
	// Until the answer is in (the editor's route loads it first), the switch isn't greyed out for nothing.
	const formAvailable = portfolio?.contactFormAvailable ?? true;
	const set = <K extends keyof typeof contact>(field: K, value: (typeof contact)[K]) =>
		editPortfolio((draft) => {
			draft.contact[field] = value;
		});

	return (
		<div className="grid gap-4">
			<TextInput
				label={t`Invitation`}
				multiline
				value={contact.note}
				maxLength={max.contactNote}
				placeholder={t`Have a project in mind? Let's talk.`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							draft.contact.note = value;
						},
						{ key: "contact.note" },
					)
				}
			/>
			<CellSwitchRow
				isSelected={contact.email}
				onChange={(checked) => set("email", checked)}
				label={t`Show my email address`}
			/>
			<CellSwitchRow
				isSelected={contact.phone}
				onChange={(checked) => set("phone", checked)}
				label={t`Show my phone number`}
			/>
			<CellSwitchRow
				isSelected={contact.website}
				onChange={(checked) => set("website", checked)}
				label={t`Show my website`}
			/>
			<CellSwitchRow
				isSelected={contact.profiles}
				onChange={(checked) => set("profiles", checked)}
				label={t`Show my profiles`}
			/>
			<CellSwitchRow
				isSelected={contact.form && formAvailable}
				isDisabled={!formAvailable}
				onChange={(checked) => set("form", checked)}
				label={t`Show a contact form`}
			/>
			{!formAvailable && (
				<p className="px-1 text-body-xs text-warning">
					<Trans>The contact form isn't available right now. Visitors can still use your other contact options.</Trans>
				</p>
			)}
			<CellSwitchRow
				isSelected={contact.saveContact}
				onChange={(checked) => set("saveContact", checked)}
				label={t`Show a Save contact button`}
			/>
			<p className="-mt-2 px-1 text-body-xs text-muted">
				<Trans>Visitors save your name, headline and the contact details shown here to their phone.</Trans>
			</p>
			<WhatsAppField />
			<LocationFields />
		</div>
	);
}

function WhatsAppField() {
	const { contact } = usePortfolioData();
	const [text, setText] = useDraftText(contact.whatsapp.number ? `+${contact.whatsapp.number}` : "");
	const [touched, setTouched] = useState(false);
	const number = normalizeWhatsAppNumber(text);
	const valid = WHATSAPP_NUMBER_PATTERN.test(number);
	// A number starting with 0 is read as Indonesian; say so, since another country's would be read wrong.
	const assumesIndonesia = /^\s*0/.test(text) && valid;

	return (
		<div className="grid gap-4">
			<CellSwitchRow
				isSelected={contact.whatsapp.show}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.contact.whatsapp.show = checked;
					})
				}
				label={t`Show a WhatsApp button`}
			/>
			<TextInput
				label={t`WhatsApp number`}
				type="tel"
				inputMode="tel"
				value={text}
				maxLength={20}
				icon="phone"
				placeholder="+62 812 5550 1824"
				// Like address fields: said once the field is left, so a number being typed isn't called wrong.
				errorMessage={touched && !valid ? t`Enter 7 to 15 digits, with the country code.` : undefined}
				onBlur={() => setTouched(true)}
				onChange={(value) => {
					setText(value);
					const next = normalizeWhatsAppNumber(value);
					if (WHATSAPP_NUMBER_PATTERN.test(next))
						editPortfolio(
							(draft) => {
								draft.contact.whatsapp.number = next;
							},
							{ key: "contact.whatsapp" },
						);
				}}
			/>
			{assumesIndonesia && (
				<p className="-mt-2 px-1 text-body-xs text-muted">
					<Trans>Read as an Indonesian number (+62). For another country, start with + and its code.</Trans>
				</p>
			)}
		</div>
	);
}
