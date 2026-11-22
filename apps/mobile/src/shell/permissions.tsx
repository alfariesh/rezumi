// Permission prompts (K5): never at launch; the first time a feature needs notifications, the camera or the microphone,
// one sheet says what for (PermissionPrimer), and only "Continue" opens the system dialog. Once the system says no for
// good, a short alert points to Settings instead of asking again. Choosing a photo needs no prompt: the system picker
// runs outside the app.
import type { IconName } from "@/ui";
import { t as translate } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Alert, Linking } from "react-native";
import { create } from "zustand";
import { PermissionPrimer } from "@/ui";

export type PermissionKind = "notifications" | "camera" | "microphone";

/** The shape every Expo permission API answers with. */
export type PermissionAnswer = { granted: boolean; canAskAgain: boolean; status: string };

type PermissionApi = {
	/** Reads the current answer without prompting. */
	get: () => Promise<PermissionAnswer>;
	/** Opens the system prompt. */
	request: () => Promise<PermissionAnswer>;
};

type PrimerState = { kind: PermissionKind | null; resolve: ((go: boolean) => void) | null };

const usePrimer = create<PrimerState>(() => ({ kind: null, resolve: null }));

/** Shows the sheet for `kind` and waits for Continue (true) or Not now (false). One at a time. */
function showPrimer(kind: PermissionKind): Promise<boolean> {
	usePrimer.getState().resolve?.(false);
	return new Promise((resolve) => usePrimer.setState({ kind, resolve }));
}

/**
 * Whether the feature may go on: true when already allowed, or when the person continues past the sheet and allows it
 * in the system dialog. A permission refused for good offers Settings and returns false. `quiet` skips the Settings
 * alert (a background check that mustn't interrupt).
 */
export async function askPermission(kind: PermissionKind, api: PermissionApi, quiet = false) {
	const current = await api.get().catch(() => null);
	if (current?.granted) return true;
	if (current && !current.canAskAgain) {
		if (!quiet)
			Alert.alert(
				translate`Turned off in Settings`,
				translate`Rezumi can't ask again. Turn it on for Rezumi in your device's Settings, then try again.`,
				[
					{ text: translate`Not now`, style: "cancel" },
					{ text: translate`Open Settings`, onPress: () => void Linking.openSettings() },
				],
			);
		return false;
	}
	if (!(await showPrimer(kind))) return false;
	const answer = await api.request().catch(() => null);
	return answer?.granted === true;
}

/** The sheet itself, mounted once in app/_layout.tsx. */
export function PermissionPrimerHost() {
	const { t } = useLingui();
	const { kind, resolve } = usePrimer();
	const texts: Record<PermissionKind, { icon: IconName; title: string; description: string }> = {
		notifications: {
			icon: "bell",
			title: t`Get a nudge at the right time`,
			description: t`Rezumi sends reminders you set and new roles from your schedules. Nothing else. You can turn notifications off any time in Settings.`,
		},
		camera: {
			icon: "camera",
			title: t`Take a photo`,
			description: t`Rezumi uses the camera only while you take a photo for your Profile or resume. You can change this any time in Settings.`,
		},
		microphone: {
			icon: "microphone",
			title: t`Practise out loud`,
			description: t`Rezumi records only while you answer a practice question, to turn your answer into text. You can change this any time in Settings.`,
		},
	};
	const current = kind ? texts[kind] : texts.notifications;
	const answer = (go: boolean) => {
		resolve?.(go);
		usePrimer.setState({ kind: null, resolve: null });
	};
	return (
		<PermissionPrimer
			isOpen={kind !== null}
			icon={current.icon}
			title={current.title}
			description={current.description}
			continueLabel={t`Continue`}
			notNowLabel={t`Not now`}
			onContinue={() => answer(true)}
			onNotNow={() => answer(false)}
		/>
	);
}
