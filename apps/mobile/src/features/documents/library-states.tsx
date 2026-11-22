// The library's states besides its documents: the loading shape (rows or cards), a failed load, the first run, a
// type with nothing yet, a search that matched nothing and an empty Trash. Wording from the web's Documents page.
import type { LibraryView } from "./library-toolbar";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useStartDocument } from "./use-start-document";
import { routes } from "@/routes";
import { Alert, Button, EmptyState, Skeleton, cx } from "@/ui";

/** A grid cell's share of the row, gaps included. */
const cellWidth: Record<number, string> = { 2: "w-[47%]", 3: "w-[31%]", 4: "w-[23%]", 5: "w-[18%]" };

type LibrarySkeletonProps = { view: LibraryView; columns: number };

export function LibrarySkeleton({ view, columns }: LibrarySkeletonProps) {
	const { t } = useLingui();
	if (view === "list")
		return (
			<View accessibilityLabel={t`Loading`} accessibilityRole="progressbar" className="gap-2" testID="library-loading">
				{Array.from({ length: 6 }, (_, index) => (
					<View key={index} className="flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
						<Skeleton variant="none" className="h-14 w-10 rounded-md" />
						<View className="flex-1 gap-2">
							<Skeleton variant="none" className="h-3.5 w-2/3 rounded-md" />
							<Skeleton variant="none" className="h-3 w-1/2 rounded-md" />
						</View>
					</View>
				))}
			</View>
		);
	return (
		<View
			accessibilityLabel={t`Loading`}
			accessibilityRole="progressbar"
			className="flex-row flex-wrap gap-3"
			testID="library-loading"
		>
			{Array.from({ length: columns * 2 }, (_, index) => (
				<View key={index} className={cx("gap-2", cellWidth[columns] ?? "w-[47%]")}>
					<Skeleton variant="none" className="aspect-[210/297] w-full rounded-lg" />
					<Skeleton variant="none" className="h-3.5 w-3/4 rounded-md" />
				</View>
			))}
		</View>
	);
}

type LoadFailedProps = { onRetry: () => void };

export function LoadFailed({ onRetry }: LoadFailedProps) {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="page"
			icon="warning-circle"
			title={t`Couldn't load documents`}
			description={t`Check your connection and try again.`}
			action={{ label: t`Try again`, onPress: onRetry }}
		/>
	);
}

/** The first visit, here and on Home until there is a document. */
export function FirstRun() {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<EmptyState
			kind="page"
			icon="file-arrow-up"
			title={t`Let's start with what you have`}
			description={t`Bring in your LinkedIn, GitHub or resume file and we fill in your Profile, or start a document blank or from a sample.`}
			action={{ label: t`Bring in my details`, onPress: () => router.push(routes.onboarding()) }}
			secondaryAction={{ label: t`New document`, onPress: () => router.push(routes.new()) }}
		/>
	);
}

type TypeEmptyProps = { type: "resume" | "letter" };

/** Resumes or Letters before the first of that type: what goes here, and the button that makes one. */
export function TypeEmpty({ type }: TypeEmptyProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { newLetter, creating } = useStartDocument();
	if (type === "letter")
		return (
			<EmptyState
				kind="page"
				icon="envelope-simple"
				title={t`No letters yet`}
				description={t`A new letter takes its sender details and design from your latest resume.`}
				action={{
					label: t`New cover letter`,
					onPress: () => {
						if (!creating) void newLetter();
					},
				}}
			/>
		);
	return (
		<EmptyState
			kind="page"
			icon="file-text"
			title={t`No resumes yet`}
			description={t`Import the resume you have, or start a new one from your Profile.`}
			action={{ label: t`New resume`, onPress: () => router.push(routes.new()) }}
		/>
	);
}

type NoMatchesProps = { q: string; onClear: () => void };

export function NoMatches({ q, onClear }: NoMatchesProps) {
	const { t } = useLingui();
	const query = q.trim();
	return (
		<EmptyState
			kind="filtered"
			title={query ? t`Nothing matches “${query}”` : t`Nothing matches these filters`}
			description={t`Search covers titles, tags and linked applications.`}
			action={{ label: t`Clear search and filters`, onPress: onClear }}
		/>
	);
}

export function TrashEmpty() {
	const { t } = useLingui();
	return (
		<EmptyState
			kind="page"
			icon="trash"
			title={t`Trash is empty`}
			description={t`Documents you move here stay for 30 days.`}
		/>
	);
}

type RefreshFailedProps = { onRetry: () => void };

/** A refresh failed while the last list is still shown (offline, a server error): the rows stay. */
export function RefreshFailed({ onRetry }: RefreshFailedProps) {
	const { t } = useLingui();
	return (
		<Alert status="warning">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>{t`Couldn't refresh your documents.`}</Alert.Title>
				<Alert.Description>{t`Showing the last list on this device.`}</Alert.Description>
			</Alert.Content>
			<Button size="sm" variant="secondary" onPress={onRetry}>
				<Button.Label>{t`Retry`}</Button.Label>
			</Button>
		</Alert>
	);
}
