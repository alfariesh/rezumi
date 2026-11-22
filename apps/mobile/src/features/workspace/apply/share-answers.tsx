import type { Application } from "@/features/applications/types";
import type { CareerWorkspace } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { answersClipboard, answersDocument } from "@rezumi/career/workspace";
import { ActionButton, Actions } from "../blocks";
import { shareText } from "../share";
import { Button, Icon, Menu, showToast } from "@/ui";

type ShareAnswersProps = {
	application: Application;
	written: boolean;
	currentAnswers: () => CareerWorkspace["answers"];
};

/** Copy the answers, or share them as a Markdown or plain-text file (the web's Download). */
export function ShareAnswers({ application, written, currentAnswers }: ShareAnswersProps) {
	const { t } = useLingui();
	const title = `${application.role} · ${application.company}`;
	const copy = async () => {
		await Clipboard.setStringAsync(answersClipboard(currentAnswers()));
		showToast({ title: t`Answers copied`, variant: "success" });
	};
	const share = async (format: "md" | "txt") => {
		try {
			await shareText(
				`${application.company} answers.${format}`,
				answersDocument(title, currentAnswers(), format),
				format === "md" ? "text/markdown" : "text/plain",
				format === "md" ? "net.daringfireball.markdown" : "public.plain-text",
			);
		} catch {
			showToast({ title: t`Couldn't share the answers. Try again.`, variant: "danger" });
		}
	};
	return (
		<Actions>
			<ActionButton
				icon="copy"
				label={t`Copy answers`}
				disabled={!written}
				onPress={() => void copy()}
				testID="apply-copy"
			/>
			<Menu>
				<Menu.Trigger asChild>
					<Button size="sm" variant="ghost" isDisabled={!written}>
						<Icon name="share-network" size={16} />
						<Button.Label>{t`Share as file`}</Button.Label>
					</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={220}>
						<Menu.Item onPress={() => void share("md")}>
							<Menu.ItemTitle>{t`Markdown (.md)`}</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item onPress={() => void share("txt")}>
							<Menu.ItemTitle>{t`Plain text (.txt)`}</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
		</Actions>
	);
}
