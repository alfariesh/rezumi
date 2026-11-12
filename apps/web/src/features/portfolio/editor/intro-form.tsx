import type { PortfolioButton } from "@rezumi/schema/portfolio/data";
import { Button } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_BUTTON_KINDS } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { ownPictureUrl } from "@rezumi/utils/own-picture";
import { useRemovalFocus } from "../blocks/list-focus";
import { ImageField } from "../images/image-field";
import { MetricsEditor } from "../metrics/metric-form";
import { pageLocaleOf, usePortfolioOwner, useSourceResume } from "./context";
import { ChoiceSelect, moveItem, SortableCard, SortableList, TextInput, UrlInput } from "./fields";
import { removeWithUndo } from "./list-undo";
import { useOwnOrigins } from "./pictures";
import { setBasicsText } from "./sections";
import { editPortfolio, usePortfolioData } from "./store";
import { KEPT_PHOTO_MS, usePortfolioEditorUi } from "./ui";
import { useEditorView, usePageMessages } from "./use-view";

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
		vcard: t`Save contact`,
	})[kind];

/**
 * The intro, always first on the page: the name, headline and location the portfolio shows (empty follows the
 * resume), a short greeting, the photo, "Open to work", two to four achievement numbers and up to three buttons.
 */
export function IntroForm() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const owner = usePortfolioOwner();
	const resume = source.data;
	const { basics, hero } = data;

	return (
		<div className="grid gap-4">
			<TextInput
				label={t`Name`}
				value={basics.name ?? ""}
				maxLength={max.name}
				icon="user-circle"
				placeholder={resume?.basics.name || owner.name}
				onChange={(value) => editPortfolio((draft) => setBasicsText(draft, "name", value), { key: "basics.name" })}
			/>
			<TextInput
				label={t`Headline`}
				value={basics.headline ?? ""}
				maxLength={max.headline}
				icon="briefcase"
				placeholder={resume?.basics.headline || t`Product designer`}
				onChange={(value) =>
					editPortfolio((draft) => setBasicsText(draft, "headline", value), { key: "basics.headline" })
				}
			/>
			<TextInput
				label={t`Location`}
				value={basics.location ?? ""}
				maxLength={max.location}
				icon="map-pin"
				placeholder={resume?.basics.location || t`Bandung, Indonesia`}
				onChange={(value) =>
					editPortfolio((draft) => setBasicsText(draft, "location", value), { key: "basics.location" })
				}
			/>
			<CellSwitchRow
				isSelected={hero.showLocation}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.hero.showLocation = checked;
					})
				}
				label={t`Show my location`}
			/>
			<TextInput
				label={t`Greeting`}
				multiline
				rewrite="greeting"
				value={hero.greeting}
				maxLength={max.greeting}
				placeholder={t`I design apps people enjoy using, and I'm looking for my next team.`}
				onChange={(value) =>
					editPortfolio(
						(draft) => {
							draft.hero.greeting = value;
						},
						{ key: "hero.greeting" },
					)
				}
			/>
			<HeroPhoto />
			<CellSwitchRow
				isSelected={hero.availability.show}
				onChange={(checked) =>
					editPortfolio((draft) => {
						draft.hero.availability.show = checked;
					})
				}
				label={t`Show “Open to work”`}
			/>
			{hero.availability.show && (
				<TextInput
					label={t`Label text`}
					value={hero.availability.text}
					maxLength={max.availability}
					icon="pencil-line"
					placeholder={t`Open to work`}
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
			<HeroHighlights />
			<HeroButtons />
		</div>
	);
}

/**
 * The intro's photo: the resume's, one for the portfolio only, or none. A portfolio-only photo is kept in the editor
 * (not in the saved data) when the resume's is chosen, so switching back, even after visiting another tab, doesn't
 * upload it twice.
 */
function HeroPhoto() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const owner = usePortfolioOwner();
	const kept = usePortfolioEditorUi((state) => state.keptPhoto);
	const keepPhoto = usePortfolioEditorUi((state) => state.keepPhoto);
	const wantsOwn = usePortfolioEditorUi((state) => state.wantsOwnPhoto);
	const setWantsOwn = usePortfolioEditorUi((state) => state.setWantsOwnPhoto);
	const origins = useOwnOrigins();
	const resume = source.data;
	// Only a photo uploaded here can show on the page (`./pictures.ts`); one kept on another site isn't offered.
	const resumePhoto = resume && !resume.picture.hidden ? (ownPictureUrl(resume.picture.url, origins) ?? null) : null;
	const { basics, hero } = data;
	const stored = !hero.showPicture || basics.picture === null ? "none" : basics.picture ? "own" : "resume";
	// "A photo for the portfolio only" stays chosen while its photo is still to be uploaded.
	const choice = stored === "resume" && (wantsOwn || !resumePhoto) ? "own" : stored;
	const name = basics.name?.trim() || resume?.basics.name.trim() || owner.name;

	const choose = (next: string) => {
		setWantsOwn(next === "own");
		// The photo in the data right now is the one to bring back, whatever undo or redo did before.
		if (next === "resume" && basics.picture) keepPhoto(basics.picture);
		const restore = kept && Date.now() - kept.at < KEPT_PHOTO_MS ? kept.image : null;
		editPortfolio((draft) => {
			if (next === "none") {
				draft.hero.showPicture = false;
				return;
			}
			draft.hero.showPicture = true;
			if (next === "resume") delete draft.basics.picture;
			else if (!draft.basics.picture && restore) draft.basics.picture = restore;
			else if (draft.basics.picture === null) delete draft.basics.picture;
		});
	};

	return (
		<div className="grid gap-4">
			<ChoiceSelect
				label={t`Photo`}
				value={choice}
				options={[
					...(resumePhoto ? [{ id: "resume", label: t`The photo on my resume` }] : []),
					{ id: "own", label: t`A photo for the portfolio only` },
					{ id: "none", label: t`No photo` },
				]}
				onChange={choose}
			/>
			{choice === "own" && (
				<ImageField
					label={t`Portfolio photo`}
					// Its small copy is a JPEG, which the share card can draw.
					kind="portrait"
					value={basics.picture ?? undefined}
					altSuggestion={name}
					onChange={(image, typing) => {
						// A removed photo isn't offered back later.
						if (!image) keepPhoto(null);
						editPortfolio(
							(draft) => {
								draft.hero.showPicture = true;
								if (image) draft.basics.picture = image;
								else delete draft.basics.picture;
							},
							typing ? { key: "basics.picture.alt" } : undefined,
						);
					}}
				/>
			)}
		</div>
	);
}

/** Two to four achievement numbers under the greeting: a value and a label each. */
function HeroHighlights() {
	const data = usePortfolioData();
	const source = useSourceResume();
	const locale = pageLocaleOf(data, source.data);
	return (
		<div className="grid gap-3">
			<span className="text-sm font-medium">
				<Trans>Achievement numbers</Trans>
			</span>
			<MetricsEditor
				compact
				metrics={data.hero.highlights}
				keyPrefix="hero.highlights"
				locale={locale}
				maxItems={PORTFOLIO_LIMITS.highlights}
				addLabel={<Trans>Add a number</Trans>}
				edit={(recipe, options) =>
					editPortfolio((draft) => {
						recipe(draft.hero.highlights);
					}, options)
				}
			/>
		</div>
	);
}

/** Why the page leaves a button off, and what makes it show. */
function hiddenButtonReason(kind: PortfolioButton["kind"]): string {
	switch (kind) {
		case "resume":
			return t`Not on the page: your source resume isn't public. Make it public in the resume's Share settings.`;
		case "pdf":
			return t`Not on the page: your source resume isn't public, or doesn't offer its PDF.`;
		case "contact":
			return t`Not on the page: the Contact section is hidden or has nothing in it.`;
		case "whatsapp":
			return t`Not on the page: add your WhatsApp number in Contact.`;
		case "email":
			return t`Not on the page: your source resume has no email address.`;
		case "profile":
		case "link":
			return t`Not on the page: add the address below.`;
		case "vcard":
			return t`Shown on your published page.`;
	}
}

const ADD_ORDER: PortfolioButton["kind"][] = [
	"contact",
	"resume",
	"whatsapp",
	"email",
	"pdf",
	"vcard",
	"profile",
	"link",
];

/** Up to three buttons under the intro. Ones that can't work yet (no WhatsApp number, say) are left off the page. */
function HeroButtons() {
	const { hero } = usePortfolioData();
	const buttons = hero.buttons;
	const kindOptions = PORTFOLIO_BUTTON_KINDS.map((kind) => ({ id: kind, label: buttonKindLabel(kind) }));
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	const view = useEditorView();
	const messages = usePageMessages();
	// Whether the page shows the button: it leaves off ones that can't work yet, and says nothing about it.
	const shows = (button: PortfolioButton) => {
		const label = button.label?.trim() || messages.buttons[button.kind];
		return view.hero.buttons.some(
			(shown) => shown.kind === button.kind && shown.label === label && (!button.url || shown.href === button.url),
		);
	};

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
			<span className="text-sm font-medium">
				<Trans>Buttons</Trans>
			</span>
			<SortableList
				ids={buttons.map((_, index) => String(index))}
				onMove={(from, to) => editPortfolio((draft) => moveItem(draft.hero.buttons, from, to), { structural: true })}
			>
				{buttons.map((button, index) => {
					const name = button.label?.trim() || buttonKindLabel(button.kind);
					return (
						// oxlint-disable-next-line react/no-array-index-key -- buttons have no id; their place is who they are
						<SortableCard
							key={index}
							id={String(index)}
							list="hero-buttons"
							index={index}
							name={name}
							itemProps={itemProps}
							onRemove={() => {
								removed(index);
								removeWithUndo({
									list: (draft) => draft.hero.buttons,
									item: button,
									index,
									most: PORTFOLIO_LIMITS.heroButtons,
									name,
								});
							}}
						>
							<ChoiceSelect
								label={t`Opens`}
								value={button.kind}
								options={kindOptions}
								warning={shows(button) ? undefined : hiddenButtonReason(button.kind)}
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
								icon="text-t"
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
										update(
											index,
											(draft) => {
												if (url) draft.url = url;
												else delete draft.url;
											},
											"url",
										)
									}
								/>
							)}
						</SortableCard>
					);
				})}
			</SortableList>
			{buttons.some((button) => button.kind === "email" || button.kind === "whatsapp") && (
				<p className="px-1 text-body-xs text-muted">
					<Trans>An Email or WhatsApp button shows that address to visitors, even if Contact hides it.</Trans>
				</p>
			)}
			<div ref={fallbackRef} className="contents">
				{buttons.length < PORTFOLIO_LIMITS.heroButtons && (
					<Button variant="secondary" className="w-fit" onPress={add}>
						<Icon name="plus" size={18} />
						<Trans>Add a button</Trans>
					</Button>
				)}
			</div>
		</div>
	);
}
