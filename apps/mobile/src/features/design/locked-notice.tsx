import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { client } from "@/api/client";
import { useResumeStore } from "@/draft";
import { Alert, Button, showToast } from "@/ui";

/** A locked resume shows its design read-only; Unlock is one tap and reversible (Lock is in the document menu). */
export function LockedNotice({ id }: { id: string }) {
	const { t } = useLingui();
	const unlock = useMutation({
		mutationKey: ["design", "unlock", id],
		mutationFn: async () => {
			await client.resume.setLocked({ id, isLocked: false });
			// The draft reloads to pick it up.
			await useResumeStore.getState().open(id);
		},
		onError: () => showToast({ title: t`Couldn't unlock this resume. Try again.`, variant: "danger" }),
	});
	return (
		<Alert status="accent">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Description>{t`This resume is locked. Unlock it to change its design.`}</Alert.Description>
				<Button
					size="sm"
					variant="secondary"
					isDisabled={unlock.isPending}
					onPress={() => unlock.mutate()}
					className="mt-2 self-start"
				>
					<Button.Label>{t`Unlock`}</Button.Label>
				</Button>
			</Alert.Content>
		</Alert>
	);
}
