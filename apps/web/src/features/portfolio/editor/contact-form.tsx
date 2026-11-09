import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { WHATSAPP_NUMBER_PATTERN } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { LocationFields } from "../location/location-fields";
import { useDraftText } from "../metrics/use-draft-text";
import { useSourceResume } from "./context";
import { TextInput } from "./fields";
import { editPortfolio, usePortfolioData } from "./store";
import { orpc } from "@/libs/orpc/client";

const { text: max } = PORTFOLIO_LIMITS;

/** Digits only, without a leading 0 or +: "0812-5550-1824" in Indonesia becomes "6281255501824". */
export function normalizeWhatsAppNumber(text: string, defaultCountryCode = "62"): string {
	const digits = text.replace(/\D/g, "");
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
	const source = useSourceResume();
	const resume = source.data;
	const { data: portfolio } = useQuery(orpc.portfolio.get.queryOptions());
	const formAvailable = portfolio?.contactFormAvailable ?? false;
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
			<div className="grid gap-1">
				<SwitchRow
					isSelected={contact.email}
					onChange={(checked) => set("email", checked)}
					label={t`Show my email address`}
					description={resume?.basics.email || t`From your resume; it has none yet.`}
					className="items-start py-1"
				/>
				<SwitchRow
					isSelected={contact.phone}
					onChange={(checked) => set("phone", checked)}
					label={t`Show my phone number`}
					description={resume?.basics.phone || t`From your resume; it has none yet.`}
					className="items-start py-1"
				/>
				<SwitchRow
					isSelected={contact.website}
					onChange={(checked) => set("website", checked)}
					label={t`Show my website`}
					description={resume?.basics.website.url || t`From your resume; it has none yet.`}
					className="items-start py-1"
				/>
				<SwitchRow
					isSelected={contact.profiles}
					onChange={(checked) => set("profiles", checked)}
					label={t`Show my profiles`}
					description={t`LinkedIn, GitHub and other profiles from your resume.`}
					className="items-start py-1"
				/>
			</div>
			<SwitchRow
				isSelected={contact.form && formAvailable}
				isDisabled={!formAvailable}
				onChange={(checked) => set("form", checked)}
				label={t`Show a contact form`}
				description={
					formAvailable
						? t`Messages arrive by email and in your dashboard, and are deleted after 90 days.`
						: t`The contact form isn't available right now. Visitors can still use your other contact options.`
				}
				className="items-start py-1"
			/>
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

	return (
		<div className="grid gap-2">
			<SwitchRow
				isSelected={contact.whatsapp.show}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.contact.whatsapp.show = checked;
					})
				}
				label={t`Show a WhatsApp button`}
				className="py-0"
			/>
			<TextInput
				label={t`WhatsApp number`}
				type="tel"
				inputMode="tel"
				value={text}
				maxLength={20}
				placeholder="+62 812 5550 1824"
				description={t`With the country code. Numbers starting with 0 are read as Indonesian (+62).`}
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
		</div>
	);
}
