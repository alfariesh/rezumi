import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import { Button, buttonVariants, Switch } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { generateId } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";
import { useSourceResume } from "./context";
import { ItemToolbar, moveItem, RichTextField, TextInput, UrlInput } from "./fields";
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

/**
 * Work, for now a simple list: titles, order and which ones show. Covers, blocks and metrics arrive with the full
 * work editor (Phase 04).
 */
export function WorksForm() {
	const { works } = usePortfolioData();
	const items = works.items;

	if (items.length === 0)
		return (
			<p className="text-sm text-muted">
				<Trans>
					Projects from your resume show here as work. Adding work with pictures, text blocks and results is coming
					soon.
				</Trans>
			</p>
		);

	return (
		<div className="grid gap-3">
			{items.map((work, index) => {
				const name = work.title.trim() || t`Untitled work`;
				return (
					<div key={work.id} className="grid gap-2 rounded-2xl bg-surface-secondary p-3">
						<TextInput
							label={t`Title`}
							value={work.title}
							maxLength={max.workTitle}
							onChange={(value) =>
								editPortfolio(
									(draft) => {
										const target = draft.works.items[index];
										if (target) target.title = value;
									},
									{ key: `works.${work.id}.title` },
								)
							}
						/>
						<ItemToolbar
							name={name}
							index={index}
							count={items.length}
							onMove={(to) => editPortfolio((draft) => moveItem(draft.works.items, index, to), { structural: true })}
							onRemove={() =>
								editPortfolio(
									(draft) => {
										draft.works.items.splice(index, 1);
									},
									{ structural: true },
								)
							}
						>
							<IconButton
								icon={work.hidden ? "eye-slash" : "eye"}
								size="sm"
								aria-pressed={work.hidden}
								label={work.hidden ? t`Show ${name} on the page` : t`Hide ${name} from the page`}
								className={cn(work.hidden && "text-muted")}
								onPress={() =>
									editPortfolio((draft) => {
										const target = draft.works.items[index];
										if (target) target.hidden = !target.hidden;
									})
								}
							/>
						</ItemToolbar>
					</div>
				);
			})}
			<p className="text-xs text-muted">
				<Trans>Pictures, text blocks and results for each work are coming soon.</Trans>
			</p>
		</div>
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
			<p className="text-xs text-muted">
				<Trans>A picture for this section is coming soon.</Trans>
			</p>
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
