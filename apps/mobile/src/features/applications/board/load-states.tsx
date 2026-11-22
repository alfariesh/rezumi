// What Board and Calendar show before they have applications: the skeleton, offline with nothing kept, a failed load
// with Retry, and an empty account. Null once there is something to show.
import type { useApplications } from "@/features/applications/queries";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { applicationError } from "@/features/applications/error";
import { EmptyState } from "@/ui";

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const online = () => onlineManager.isOnline();

/** Whether the device is online, as TanStack Query sees it (it pauses queries offline). */
export const useOnline = () => useSyncExternalStore(subscribe, online, online);

type LoadStateProps = {
	query: ReturnType<typeof useApplications>;
	/** The layout's own skeleton, in its final shape. */
	skeleton: ReactNode;
	/** What an account with no applications says here. */
	emptyDescription: string;
};

export function useLoadState({ query, skeleton, emptyDescription }: LoadStateProps): ReactNode {
	const { t } = useLingui();
	const isOnline = useOnline();
	if (query.data) {
		if (query.data.length > 0) return null;
		return (
			<EmptyState kind="page" icon="briefcase" title={t`Your job search starts here`} description={emptyDescription} />
		);
	}
	if (query.isError)
		return (
			<EmptyState
				kind="page"
				icon="warning-circle"
				title={t`Couldn't load your applications`}
				description={applicationError(query.error)}
				action={{ label: t`Try again`, onPress: () => void query.refetch() }}
			/>
		);
	if (!isOnline)
		return (
			<EmptyState
				kind="page"
				icon="cloud-slash"
				title={t`You're offline`}
				description={t`Your applications show here once you're back online.`}
			/>
		);
	return skeleton;
}
