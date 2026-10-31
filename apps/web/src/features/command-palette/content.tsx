import { Command } from "@heroui-pro/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Icon } from "@rezumi/ui/components/icon";
import { AskCommandGroup } from "./pages/ask";
import { NavigationCommandGroup } from "./pages/navigation";
import { PreferencesCommandGroup } from "./pages/preferences";
import { ResumesCommandGroup } from "./pages/resumes";
import { useCommandPaletteStore } from "./store";

/** Substring match on the item's `textValue`. The query is trimmed so "ask <query>" rows stay visible. */
const filterItems = (textValue: string, inputValue: string) =>
	textValue.toLowerCase().includes(inputValue.trim().toLowerCase());

export default function CommandPaletteContent() {
	const { open, search, pages, setOpen, setSearch, goBack } = useCommandPaletteStore();

	const isFirstPage = pages.length === 0;
	const currentPage = pages[pages.length - 1];

	return (
		<Command>
			<Command.Backdrop isOpen={open} onOpenChange={setOpen}>
				<Command.Container>
					<Command.Dialog
						inputValue={search}
						onInputChange={setSearch}
						filter={filterItems}
						aria-label={
							isFirstPage
								? t({
										comment: "Accessible label for the command palette dialog",
										message: "Command palette",
									})
								: t({
										comment: "Accessible label for command palette dialog when browsing a nested command page",
										message: `Command palette: ${currentPage}`,
									})
						}
					>
						<Command.InputGroup
							aria-label={t({
								comment: "Accessible label for command palette search input",
								message: "Search commands",
							})}
						>
							<Command.InputGroup.Prefix>
								<Icon name="magnifying-glass" size={20} />
							</Command.InputGroup.Prefix>
							<Command.InputGroup.Input
								placeholder={
									isFirstPage
										? t({
												comment: "Placeholder in command palette input on root page",
												message: "Type a command or search…",
											})
										: t({
												comment: "Placeholder in command palette input on nested pages",
												message: "Search…",
											})
								}
								onKeyDown={(event) => {
									// Empty input: Backspace steps back a page (or closes from the root page).
									if (event.key !== "Backspace" || search.length > 0) return;
									event.preventDefault();
									goBack();
								}}
							/>
							<Command.InputGroup.ClearButton />
						</Command.InputGroup>

						<Command.List
							key={currentPage ?? "root"}
							aria-label={t({
								comment: "Accessible label for command list region inside command palette",
								message: "Command palette",
							})}
							renderEmptyState={() => (
								<div className="py-8 text-center text-sm text-muted">
									<Trans comment="Empty-state message when no command palette results match the search query">
										No commands match that search.
									</Trans>
								</div>
							)}
						>
							<ResumesCommandGroup />
							<PreferencesCommandGroup />
							<NavigationCommandGroup />
							<AskCommandGroup />
						</Command.List>
					</Command.Dialog>
				</Command.Container>
			</Command.Backdrop>
		</Command>
	);
}
