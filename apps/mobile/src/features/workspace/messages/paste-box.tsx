// W15: the employer's message, kept with the application (autosaved, and on the device until the server has it),
// and Read it for me.
import type { SaveResult } from "../state";
import type { Application } from "@/features/applications/types";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { AiNotice } from "../ai-notice";
import { ActionButton } from "../blocks";
import { useAutosave, useDraft } from "../drafts";
import { useGenerate } from "../queries";
import { SaveError } from "../save-error";
import { useWorking, workingSteps } from "../working";
import { useHasAIProvider } from "@/features/ai/providers";
import { Description, Label, TextArea, TextField } from "@/ui";

type PasteBoxProps = {
	application: Application;
	initial: string;
	readOnly: boolean;
	onSave: (message: string) => Promise<SaveResult>;
	/** The message in a freshly fetched, server-confirmed workspace. */
	fetchServer: () => Promise<string>;
};

export function PasteBox({ application, initial, readOnly, onSave, fetchServer }: PasteBoxProps) {
	const { t } = useLingui();
	const draft = useDraft(readOnly ? null : `message:${application.id}`, initial);
	const message = draft.value;
	const generate = useGenerate(application.id);
	const provider = useHasAIProvider().defaultProvider;
	const autosave = useAutosave(readOnly ? initial : message, initial, onSave, draft, fetchServer);
	const label = useWorking(generate.isPending, workingSteps("reply"), t`Read it for me`);
	const company = application.company;
	const field = t`Paste a message from ${company}`;

	return (
		<View className="gap-3">
			<TextField isDisabled={readOnly}>
				<Label>{field}</Label>
				<TextArea
					value={message}
					maxLength={20_000}
					accessibilityLabel={field}
					onChangeText={draft.setValue}
					onBlur={autosave.flush}
					testID="messages-paste"
				/>
				<Description>{t`Paste the email or message, without the signature.`}</Description>
			</TextField>
			<SaveError autosave={autosave} />
			{readOnly ? null : (
				<View className="gap-2">
					{provider ? (
						<ActionButton
							icon="sparkle"
							label={label}
							busy={generate.isPending}
							disabled={!message.trim()}
							onPress={() => void generate.run({ task: "reply", message: message.trim() }).catch(() => undefined)}
							testID="messages-read"
						/>
					) : null}
					<AiNotice />
				</View>
			)}
		</View>
	);
}
