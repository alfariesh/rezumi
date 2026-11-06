import type { PortfolioButton } from "@rezumi/schema/portfolio/data";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_BUTTON_KINDS } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { SwitchRow } from "@rezumi/ui/components/switch";
import { usePortfolioOwner, useSourceResume } from "./context";
import { ChoiceSelect, ItemToolbar, moveItem, TextInput, UrlInput } from "./fields";
import { setBasicsText } from "./sections";
import { editPortfolio, usePortfolioData } from "./store";

const { text: max } = PORTFOLIO_LIMITS;

const buttonKindLabel = (kind: PortfolioButton["kind"]) =>
	({
		resume: t`View resume`,
		pdf: t`Download resume PDF`,
		contact: t`Send a message (to Contact)`,
		whatsapp: t`WhatsApp`,
		email: t`Email`,
		profile: t`A profile (LinkedIn, GitHub…)`,
		link: t`Another link`,
	})[kind];

/**
 * The intro, always first on the page: the name, headline and location the portfolio shows (empty follows the
 * resume), a short greeting, the photo, "Open to work" and up to three buttons. Highlights arrive with metrics in
 * Phase 04.
 */
export function IntroForm() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const owner = usePortfolioOwner();
	const resume = source.data;
	const fromResume = resume !== null;
	const { basics, hero } = data;

	const followsResume = (value: string | undefined) =>
		fromResume ? t`Empty uses your resume's: ${value || "—"}` : undefined;

	return (
		<div className="grid gap-4">
			<TextInput
				label={t`Name`}
				value={basics.name ?? ""}
				maxLength={max.name}
				placeholder={resume?.basics.name || owner.name}
				description={followsResume(resume?.basics.name)}
				onChange={(value) => editPortfolio((draft) => setBasicsText(draft, "name", value), { key: "basics.name" })}
			/>
			<TextInput
				label={t`Headline`}
				value={basics.headline ?? ""}
				maxLength={max.headline}
				placeholder={resume?.basics.headline || t`Product designer`}
				description={followsResume(resume?.basics.headline)}
				onChange={(value) =>
					editPortfolio((draft) => setBasicsText(draft, "headline", value), { key: "basics.headline" })
				}
			/>
			<TextInput
				label={t`Location`}
				value={basics.location ?? ""}
				maxLength={max.location}
				placeholder={resume?.basics.location || t`Bandung, Indonesia`}
				description={followsResume(resume?.basics.location)}
				onChange={(value) =>
					editPortfolio((draft) => setBasicsText(draft, "location", value), { key: "basics.location" })
				}
			/>
			<TextInput
				label={t`Greeting`}
				multiline
				value={hero.greeting}
				maxLength={max.greeting}
				placeholder={t`I design apps people enjoy using, and I'm looking for my next team.`}
				description={t`One or two sentences under your name. ${hero.greeting.length}/${max.greeting}`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							draft.hero.greeting = value;
						},
						{ key: "hero.greeting" },
					)
				}
			/>
			<SwitchRow
				isSelected={hero.showPicture}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.hero.showPicture = checked;
					})
				}
				label={t`Show my photo`}
				description={
					fromResume
						? t`Uses your resume's photo. A portfolio-only photo arrives soon.`
						: t`A photo for the portfolio arrives soon.`
				}
				className="items-start py-0"
			/>
			<SwitchRow
				isSelected={hero.availability.show}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.hero.availability.show = checked;
					})
				}
				label={t`Show “Open to work”`}
				className="py-0"
			/>
			{hero.availability.show && (
				<TextInput
					label={t`Label text`}
					value={hero.availability.text}
					maxLength={max.availability}
					placeholder={t`Open to work`}
					description={t`Empty shows “Open to work” in the page's language.`}
					onChange={(value) =>
						editPortfolio(
							(draft) => {
								draft.hero.availability.text = value;
							},
							{ key: "hero.availability" },
						)
					}
				/>
			)}
			<HeroButtons />
		</div>
	);
}

const ADD_ORDER: PortfolioButton["kind"][] = ["contact", "resume", "whatsapp", "email", "pdf", "profile", "link"];

/** Up to three buttons under the intro. Ones that can't work yet (no WhatsApp number, say) are left off the page. */
function HeroButtons() {
	const { hero } = usePortfolioData();
	const buttons = hero.buttons;
	const kindOptions = PORTFOLIO_BUTTON_KINDS.map((kind) => ({ id: kind, label: buttonKindLabel(kind) }));

	const update = (index: number, change: (button: PortfolioButton) => void, key?: string) =>
		editPortfolio(
			(draft) => {
				const button = draft.hero.buttons[index];
				if (button) change(button);
			},
			key ? { key: `hero.buttons.${index}.${key}` } : undefined,
		);

	const add = () =>
		editPortfolio((draft) => {
			const used = new Set(draft.hero.buttons.map((button) => button.kind));
			const kind = ADD_ORDER.find((candidate) => !used.has(candidate)) ?? "link";
			draft.hero.buttons.push({ kind });
		});

	return (
		<div className="grid gap-3">
			<div className="grid gap-0.5">
				<span className="text-sm font-medium">
					<Trans>Buttons</Trans>
				</span>
				<span className="text-xs text-muted">
					<Trans>Up to three, under your greeting. The first one stands out.</Trans>
				</span>
			</div>
			{buttons.map((button, index) => {
				const name = button.label?.trim() || buttonKindLabel(button.kind);
				return (
					// oxlint-disable-next-line react/no-array-index-key -- buttons have no id; their place is who they are
					<div key={index} className="grid gap-3 rounded-2xl bg-surface-secondary p-3">
						<ChoiceSelect
							label={t`Opens`}
							value={button.kind}
							options={kindOptions}
							onChange={(kind) =>
								update(index, (draft) => {
									draft.kind = kind;
									if (kind !== "profile" && kind !== "link") delete draft.url;
								})
							}
						/>
						<TextInput
							label={t`Button text`}
							value={button.label ?? ""}
							maxLength={max.buttonLabel}
							placeholder={t`Empty uses a default`}
							onChange={(value) =>
								update(
									index,
									(draft) => {
										if (value.trim()) draft.label = value;
										else delete draft.label;
									},
									"label",
								)
							}
						/>
						{(button.kind === "profile" || button.kind === "link") && (
							<UrlInput
								label={t`Address`}
								value={button.url}
								onChange={(url) =>
									update(index, (draft) => {
										if (url) draft.url = url;
										else delete draft.url;
									})
								}
							/>
						)}
						<ItemToolbar
							name={name}
							index={index}
							count={buttons.length}
							onMove={(to) => editPortfolio((draft) => moveItem(draft.hero.buttons, index, to), { structural: true })}
							onRemove={() =>
								editPortfolio(
									(draft) => {
										draft.hero.buttons.splice(index, 1);
									},
									{ structural: true },
								)
							}
						/>
					</div>
				);
			})}
			{buttons.length < PORTFOLIO_LIMITS.heroButtons && (
				<Button variant="secondary" className="w-fit" onPress={add}>
					<Icon name="plus" size={18} />
					<Trans>Add a button</Trans>
				</Button>
			)}
		</div>
	);
}
