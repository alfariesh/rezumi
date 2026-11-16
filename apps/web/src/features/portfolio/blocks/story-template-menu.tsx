import type { StoryTemplateId } from "./story-templates";
import type { PortfolioWork } from "@rezumi/schema/portfolio/data";
import type { ReactNode } from "react";
import { Chip, Dropdown, Label } from "@heroui/react";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { usePortfolioSource } from "../editor/context";
import { usePortfolioEditorStore } from "../editor/store";
import { STORY_TEMPLATE_IDS, STORY_TEMPLATES, suggestStoryTemplate } from "./story-templates";

/**
 * The outline that most likely fits this work, from the person's role on it, then the portfolio's headline, then the
 * Profile's or resume's: shown first and marked in the menu, never added on its own.
 */
function useSuggestedStoryTemplate(work: PortfolioWork): StoryTemplateId {
	const headline = usePortfolioEditorStore((state) => state.portfolio?.data.basics.headline);
	const source = usePortfolioSource();
	return suggestStoryTemplate(work.role, headline, source.data?.basics.headline);
}

type StoryTemplateMenuProps = {
	work: PortfolioWork;
	onPick: (id: StoryTemplateId) => void;
	/** What opens the menu: a Button, or anything pressable with `asTrigger`. */
	children: ReactNode;
	/** Wraps `children` in the menu's own pressable (a card); without it, `children` is the Button that opens it. */
	asTrigger?: { className: string };
};

/** "Start from an outline": the story outlines for each kind of work, the likely one first. */
export function StoryTemplateMenu({ work, onPick, children, asTrigger }: StoryTemplateMenuProps) {
	const { i18n } = useLingui();
	const suggested = useSuggestedStoryTemplate(work);
	const ids = [suggested, ...STORY_TEMPLATE_IDS.filter((id) => id !== suggested)];

	return (
		<Dropdown>
			{asTrigger ? <Dropdown.Trigger className={asTrigger.className}>{children}</Dropdown.Trigger> : children}
			<Dropdown.Popover placement="bottom start" className="w-80">
				<Dropdown.Menu onAction={(key) => onPick(key as StoryTemplateId)}>
					{ids.map((id) => {
						const template = STORY_TEMPLATES[id];
						const name = i18n._(template.name);
						return (
							<Dropdown.Item key={id} id={id} textValue={name}>
								<Icon name={template.icon} className="text-muted" />
								<div className="grid">
									<span className="flex flex-wrap items-center gap-1.5">
										<Label>{name}</Label>
										{id === suggested && id !== "case-study" && (
											<Chip size="sm" variant="soft" color="accent">
												<Trans comment="Marks the story outline that likely fits the person's field">
													Fits your field
												</Trans>
											</Chip>
										)}
									</span>
									<span className="text-xs text-muted">{i18n._(template.description)}</span>
								</div>
							</Dropdown.Item>
						);
					})}
				</Dropdown.Menu>
			</Dropdown.Popover>
		</Dropdown>
	);
}
