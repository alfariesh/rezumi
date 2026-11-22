import type { VoiceSettings } from "../voice";
import type { usePlayer } from "../voice";
import { useLingui } from "@lingui/react/macro";
import { useEffect, useState } from "react";
import { ActionButton } from "../blocks";
import { workspaceError } from "../queries";
import { createRequests, playLatest } from "../state";
import { deleteQuietly, speak } from "../voice";
import { showToast } from "@/ui";

type HearItProps = { text: string; voice: VoiceSettings; player: ReturnType<typeof usePlayer> };

/** Reads the question aloud with the chosen speech connection; hidden when there is none or it's set to text only. */
export function HearIt({ text, voice, player }: HearItProps) {
	const { t } = useLingui();
	const [busy, setBusy] = useState(false);
	const [requests] = useState(createRequests);
	// A reply that lands after leaving (or after a newer question) is deleted instead of played.
	useEffect(() => requests.invalidate, [requests]);
	const reader = voice.settings.speak;
	if (!reader) return null;
	const stop = () => {
		requests.invalidate();
		player.stop();
		setBusy(false);
	};
	const play = async () => {
		if (player.playing || busy) return stop();
		setBusy(true);
		try {
			const played = await playLatest(
				requests,
				() => speak(reader, text),
				(file) => player.play(file.uri, () => deleteQuietly(file)),
				deleteQuietly,
			);
			if (played) setBusy(false);
		} catch (error) {
			stop();
			showToast({
				title: workspaceError(error, t`Spoken audio is unavailable. Continue with the text question.`),
				variant: "danger",
			});
		}
	};
	const playing = player.playing || busy;
	return (
		<ActionButton
			variant="ghost"
			icon={playing ? "stop" : "speaker-high"}
			label={playing ? t`Stop audio` : t`Hear it`}
			onPress={() => void play()}
		/>
	);
}
