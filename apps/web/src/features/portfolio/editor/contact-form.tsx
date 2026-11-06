import type { PortfolioLocation } from "@rezumi/schema/portfolio/data";
import { Checkbox, Label } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { PORTFOLIO_WORK_MODES, WHATSAPP_NUMBER_PATTERN } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { useSourceResume } from "./context";
import { ChoiceSelect, TextInput } from "./fields";
import { editPortfolio, usePortfolioData, usePortfolioEditorStore } from "./store";

const { text: max } = PORTFOLIO_LIMITS;

/** Digits only, without a leading 0 or +: "0812-5550-1824" in Indonesia becomes "6281255501824". */
export function normalizeWhatsAppNumber(text: string, defaultCountryCode = "62"): string {
	const digits = text.replace(/\D/g, "");
	if (!digits) return "";
	if (text.trim().startsWith("+")) return digits;
	if (digits.startsWith("0")) return `${defaultCountryCode}${digits.replace(/^0+/, "")}`;
	return digits;
}

const workModeLabel = (mode: PortfolioLocation["workModes"][number]) =>
	({ remote: t`Remote`, hybrid: t`Hybrid`, onsite: t`On-site` })[mode];

/** Common time zones for the local time; Phase 05's city search sets it from the city instead. */
function timeZoneOptions(current: string | undefined) {
	const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const zones = [
		"Asia/Jakarta",
		"Asia/Makassar",
		"Asia/Jayapura",
		"Asia/Singapore",
		"Asia/Kuala_Lumpur",
		"Asia/Tokyo",
		"Asia/Dubai",
		"Europe/London",
		"Europe/Amsterdam",
		"America/New_York",
		"America/Los_Angeles",
		"Australia/Sydney",
		"UTC",
	];
	const all = [...new Set([...(current ? [current] : []), device, ...zones].filter(Boolean))];
	return all.map((zone) => ({ id: zone, label: zone.replaceAll("_", " ") }));
}

/**
 * Contact: the invitation, which of the resume's details show (email and website on, phone off by default), WhatsApp,
 * profiles, and the Location card (the map arrives in Phase 05). The contact form arrives in Phase 08.
 */
export function ContactForm() {
	const { contact } = usePortfolioData();
	const source = useSourceResume();
	const resume = source.data;
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
			<WhatsAppField />
			<LocationFields />
			<p className="text-xs text-muted">
				<Trans>A contact form and a map of your city are coming soon.</Trans>
			</p>
		</div>
	);
}

function WhatsAppField() {
	const { contact } = usePortfolioData();
	const revision = usePortfolioEditorStore((state) => state.revision);
	const [text, setText] = useState(contact.whatsapp.number ? `+${contact.whatsapp.number}` : "");
	const [seen, setSeen] = useState(revision);
	if (seen !== revision) {
		setSeen(revision);
		setText(contact.whatsapp.number ? `+${contact.whatsapp.number}` : "");
	}
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
				description={
					valid
						? t`With the country code. Numbers starting with 0 are read as Indonesian (+62).`
						: t`Enter 7 to 15 digits, with the country code.`
				}
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

function LocationFields() {
	const { location } = usePortfolioData();
	const source = useSourceResume();
	const resumeLocation = source.data?.basics.location ?? "";

	return (
		<div className="grid gap-3 rounded-2xl bg-surface-secondary p-3">
			<span className="text-sm font-medium">
				<Trans>Location card</Trans>
			</span>
			<TextInput
				label={t`City or region`}
				value={location.label}
				maxLength={max.location}
				placeholder={resumeLocation || t`Bandung, Indonesia`}
				description={resumeLocation ? t`Empty uses your resume's: ${resumeLocation}` : undefined}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							draft.location.label = value;
						},
						{ key: "location.label" },
					)
				}
			/>
			<fieldset className="grid gap-1.5">
				<legend className="mb-1.5 text-sm font-medium">
					<Trans>How you work</Trans>
				</legend>
				<div className="flex flex-wrap gap-x-4 gap-y-2">
					{PORTFOLIO_WORK_MODES.map((mode) => (
						<Checkbox
							key={mode}
							isSelected={location.workModes.includes(mode)}
							onChange={(checked) =>
								editPortfolio((draft) => {
									const rest = draft.location.workModes.filter((entry) => entry !== mode);
									draft.location.workModes = checked
										? PORTFOLIO_WORK_MODES.filter((entry) => entry === mode || rest.includes(entry))
										: rest;
								})
							}
						>
							<Checkbox.Content>
								<Checkbox.Control>
									<Checkbox.Indicator />
								</Checkbox.Control>
								<Label className="text-sm">{workModeLabel(mode)}</Label>
							</Checkbox.Content>
						</Checkbox>
					))}
				</div>
			</fieldset>
			<SwitchRow
				isSelected={location.relocate}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.relocate = checked;
					})
				}
				label={t`Open to relocating`}
				className="py-0"
			/>
			<SwitchRow
				isSelected={location.showLocalTime}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.location.showLocalTime = checked;
						draft.location.timezone ??= Intl.DateTimeFormat().resolvedOptions().timeZone;
					})
				}
				label={t`Show my local time`}
				description={t`Helps recruiters in other time zones know when to reach you.`}
				className="items-start py-0"
			/>
			{location.showLocalTime && (
				<ChoiceSelect
					label={t`Time zone`}
					value={location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
					options={timeZoneOptions(location.timezone)}
					onChange={(zone) =>
						editPortfolio((draft) => {
							draft.location.timezone = zone;
						})
					}
				/>
			)}
		</div>
	);
}
