import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import { Button, buttonVariants, Switch } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { generateId } from "@rezumi/utils/string";
import { ImageField } from "../images/image-field";
import { useSourceResume } from "./context";
import { RichTextField, TextInput, UrlInput } from "./fields";
import { resumeSectionItems, setItemHidden, setSectionHidden } from "./sections";
import { editPortfolio, usePortfolioData, usePortfolioRecord } from "./store";
import { useConfirm } from "@/hooks/use-confirm";

const { text: max } = PORTFOLIO_LIMITS;

/** About me: a short rich text, started from the resume's summary. */
export function AboutForm() {
	const { about } = usePortfolioData();
	return (
		<RichTextField
			label={t`About me`}
			value={about.content}
			maxLength={max.about}
			placeholder={t`Who you are, what you do best, and what you're looking for.`}
			onChange={(html) =>
				editPortfolio(
					(draft) => {
						draft.about.content = html;
					},
					{ key: "about" },
				)
			}
		/>
	);
}

/** One of the portfolio's own sections: a title, rich text and an optional link button. */
export function CustomSectionForm({ id }: { id: string }) {
	const { custom } = usePortfolioData();
	const confirm = useConfirm();
	const index = custom.findIndex((section) => section.id === id);
	const section = custom[index];
	if (!section) return null;

	const update = (change: (target: (typeof custom)[number]) => void, key?: string) =>
		editPortfolio(
			(draft) => {
				const target = draft.custom.find((entry) => entry.id === id);
				if (target) change(target);
			},
			key ? { key: `custom.${id}.${key}` } : undefined,
		);

	const remove = async () => {
		const confirmed = await confirm(t`Delete this section?`, {
			description: t`Its title and text are removed from the portfolio. You can undo this.`,
			confirmText: t`Delete section`,
		});
		if (!confirmed) return;
		editPortfolio(
			(draft) => {
				draft.custom = draft.custom.filter((entry) => entry.id !== id);
				const key: PortfolioSectionKey = `custom:${id}`;
				draft.sections.order = draft.sections.order.filter((entry) => entry !== key);
				setSectionHidden(draft, key, false);
				delete draft.sections.titles[key];
			},
			{ structural: true },
		);
	};

	return (
		<div className="grid gap-4">
			<TextInput
				label={t`Section title`}
				value={section.title}
				maxLength={max.customTitle}
				placeholder={t`How I work`}
				onChange={(value) =>
					update((target) => {
						target.title = value;
					}, "title")
				}
			/>
			<RichTextField
				label={t`Text`}
				value={section.content}
				maxLength={max.customContent}
				onChange={(html) =>
					update((target) => {
						target.content = html;
					}, "content")
				}
			/>
			<TextInput
				label={t`Button text (optional)`}
				value={section.button?.label ?? ""}
				maxLength={max.buttonLabel}
				placeholder={t`See the case study`}
				onChange={(value) =>
					update((target) => {
						if (!value.trim() && !target.button?.url) delete target.button;
						else target.button = { ...target.button, kind: "link", label: value };
					}, "button.label")
				}
			/>
			<UrlInput
				label={t`Button link`}
				value={section.button?.url}
				onChange={(url) =>
					update((target) => {
						if (!url && !target.button?.label?.trim()) delete target.button;
						else {
							target.button = { ...target.button, kind: "link" };
							if (url) target.button.url = url;
							else delete target.button.url;
						}
					})
				}
			/>
			<ImageField
				label={t`Picture (optional)`}
				value={section.image}
				altSuggestion={section.title.trim()}
				onChange={(image) =>
					update((target) => {
						if (image) target.image = image;
						else delete target.image;
					})
				}
			/>
			<Button variant="danger-soft" className="w-fit" onPress={() => void remove()}>
				<Icon name="trash" size={18} />
				<Trans>Delete section</Trans>
			</Button>
		</div>
	);
}

/** Adds one of the portfolio's own sections (up to ten), placed before Contact. */
export function addCustomSection(): string {
	const id = generateId();
	editPortfolio(
		(draft) => {
			draft.custom.push({ id, title: "", content: "", hidden: false });
		},
		{ structural: true },
	);
	return id;
}

/**
 * A section read from the source resume: every item with a switch to show it on the portfolio, without changing the
 * resume. Items hidden on the resume stay hidden. The resume itself is edited in its own editor.
 */
export function ResumeItemsForm({ sectionKey }: { sectionKey: PortfolioSectionKey }) {
	const data = usePortfolioData();
	const { sourceResume } = usePortfolioRecord();
	const source = useSourceResume();
	const items = resumeSectionItems(source.data, sectionKey);
	const hidden = new Set(data.sections.hiddenItems[sectionKey] ?? []);

	if (!source.data)
		return (
			<p className="text-sm text-muted">
				<Trans>This section comes from a resume. Choose one in Publish → Source resume to fill it.</Trans>
			</p>
		);

	return (
		<div className="grid gap-3">
			{items.length === 0 ? (
				<p className="text-sm text-muted">
					<Trans>Nothing here on your resume yet, so the section doesn't show.</Trans>
				</p>
			) : (
				<ul className="grid gap-1">
					{items.map((item) => (
						<li key={item.id}>
							<Switch
								isSelected={!item.hiddenOnResume && !hidden.has(item.id)}
								isDisabled={item.hiddenOnResume}
								onChange={(shown) => editPortfolio((draft) => setItemHidden(draft, sectionKey, item.id, !shown))}
								className="w-full"
							>
								<Switch.Content className="w-full justify-between gap-3 text-start">
									<span className="grid min-w-0">
										<span className="truncate text-sm">{item.label}</span>
										{item.hiddenOnResume && (
											<span className="text-xs text-muted">
												<Trans>Hidden on your resume</Trans>
											</span>
										)}
									</span>
									<Switch.Control>
										<Switch.Thumb />
									</Switch.Control>
								</Switch.Content>
							</Switch>
						</li>
					))}
				</ul>
			)}
			{sourceResume && (
				<a
					href={`/builder/${sourceResume.id}`}
					target="_blank"
					rel="noopener"
					className={buttonVariants({ variant: "secondary", className: "w-fit" })}
				>
					<Icon name="arrow-square-out" size={18} />
					<Trans>Edit on resume</Trans>
				</a>
			)}
		</div>
	);
}
