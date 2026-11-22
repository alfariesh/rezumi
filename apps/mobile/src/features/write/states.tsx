// Write's loading and failed-load states, and the gate every Write screen waits behind: the builder layout opens the
// draft, so a pushed screen (an entry, Basics) opened from a link waits for it instead of saying it's gone.
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { useSession } from "@/auth/session";
import { useResumeStore } from "@/draft";
import { EmptyState, Screen, Skeleton } from "@/ui";

/** The outline's shape: the Basics card, then section rows. */
export function WriteSkeleton() {
	return (
		<Screen scroll={false} testID="write-loading">
			<Skeleton variant="none" className="h-16 rounded-2xl" />
			<Skeleton variant="none" className="h-3 w-32 rounded-md" />
			<View className="gap-2">
				{[0, 1, 2, 3, 4].map((row) => (
					<Skeleton key={row} variant="none" className="h-12 rounded-xl" />
				))}
			</View>
		</Screen>
	);
}

type ResumeGateProps = { id: string; children: ReactNode; fallback?: ReactNode };

export function ResumeGate({ id, children, fallback }: ResumeGateProps) {
	const { t } = useLingui();
	const session = useSession();
	const ready = useResumeStore((state) => state.document?.id === id && state.data !== null);
	const failed = useResumeStore((state) => state.status === "error" && state.document?.id !== id);

	if (session.status === "signed-out" || session.status === "expired")
		return (
			<Screen>
				<EmptyState kind="page" icon="lock" title={t`Sign in to edit this resume.`} />
			</Screen>
		);
	if (ready) return children;
	if (failed)
		return (
			<Screen>
				<EmptyState
					kind="page"
					icon="warning-circle"
					title={t`Couldn't load the resume`}
					description={t`Check your connection, then try again.`}
					action={{
						label: t`Try again`,
						onPress: () =>
							void useResumeStore
								.getState()
								.open(id)
								.catch(() => undefined),
					}}
				/>
			</Screen>
		);
	return fallback ?? <WriteSkeleton />;
}
