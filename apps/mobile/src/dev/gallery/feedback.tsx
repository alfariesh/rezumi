// Gallery: loading, empty, banner and progress states.
import { useState } from "react";
import { View } from "react-native";
import { Caption, GallerySection, Row } from "./section";
import { Button, ListRow, ListSection, Switch, Text } from "@/ui";
import { Alert, EmptyState, ProgressBar, Skeleton, SkeletonGroup, Spinner } from "@/ui/feedback";
import { ProgressCircle } from "@/ui/progress-circle";

const noop = () => undefined;

const statuses = [
	["default", "Saved to this device", "It syncs when you sign in."],
	["accent", "New roles match your profile", "Three postings since yesterday."],
	["success", "Resume exported", "The PDF is in your Files app."],
	["warning", "You are offline", "Changes save when you are back online."],
	["danger", "Could not save", "Check your connection and try again."],
] as const;

export function FeedbackGallery() {
	const [loading, setLoading] = useState(true);
	return (
		<View className="gap-8">
			<GallerySection
				title="Skeleton · SkeletonGroup"
				note="Keep the real frame and draw placeholder rows inside it, at their final size."
			>
				<Row>
					<Switch isSelected={loading} onSelectedChange={setLoading} accessibilityLabel="Loading" />
					<Caption>{loading ? "Loading" : "Loaded"}</Caption>
				</Row>
				<ListSection title="Recent">
					{[0, 1, 2].map((index) => (
						<SkeletonGroup key={index} isLoading={loading} className="min-h-14 flex-row items-center gap-3 px-4 py-2">
							<SkeletonGroup.Item className="size-10 rounded-xl">
								<View className="size-10 rounded-xl bg-surface-secondary" />
							</SkeletonGroup.Item>
							<View className="flex-1 gap-1.5">
								<SkeletonGroup.Item className="h-4 w-3/5 rounded-md">
									<Text weight="medium">Product designer</Text>
								</SkeletonGroup.Item>
								<SkeletonGroup.Item className="h-3 w-2/5 rounded-md">
									<Text size="xs" tone="muted">
										Acme · edited today
									</Text>
								</SkeletonGroup.Item>
							</View>
						</SkeletonGroup>
					))}
				</ListSection>
				<Row>
					<Skeleton isLoading={loading} variant="pulse" className="h-24 w-32 rounded-2xl">
						<View className="h-24 w-32 rounded-2xl bg-paper" />
					</Skeleton>
					<Caption>pulse</Caption>
					<Skeleton isLoading={loading} variant="none" className="h-24 w-32 rounded-2xl">
						<View className="h-24 w-32 rounded-2xl bg-paper" />
					</Skeleton>
					<Caption>none (still)</Caption>
				</Row>
			</GallerySection>

			<GallerySection title="Spinner" note="Only for a wait with no shape to hold (a button's pending state, a sheet).">
				<Row>
					<Spinner size="sm" />
					<Spinner />
					<Spinner size="lg" />
					<Spinner color="success" />
					<Spinner color="danger" />
				</Row>
			</GallerySection>

			<GallerySection
				title="EmptyState · page"
				note="A screen or list with nothing yet: what goes here, one sentence, the action that adds the first one."
			>
				<View className="rounded-2xl bg-surface">
					<EmptyState
						kind="page"
						icon="file-text"
						title="No resumes yet"
						description="Start from a template or import the PDF you already have."
						action={{ label: "New resume", onPress: noop }}
						secondaryAction={{ label: "Import", onPress: noop }}
					/>
				</View>
			</GallerySection>

			<GallerySection
				title="EmptyState · page, failed load"
				note="What went wrong and Retry; the last content stays when there is any."
			>
				<View className="rounded-2xl bg-surface">
					<EmptyState
						kind="page"
						icon="warning-circle"
						title="Applications did not load"
						description="Check your connection, then try again."
						action={{ label: "Retry", onPress: noop }}
					/>
				</View>
			</GallerySection>

			<GallerySection
				title="EmptyState · filtered"
				note="A search or filter matched nothing: say what, offer to clear."
			>
				<View className="rounded-2xl bg-surface">
					<EmptyState
						kind="filtered"
						title="No matches for “designer”"
						description="Try another word or clear the filters."
						action={{ label: "Clear filters", onPress: noop }}
					/>
				</View>
			</GallerySection>

			<GallerySection title="EmptyState · inline" note="A small part of a screen: one line and a quiet action.">
				<EmptyState
					kind="inline"
					title="No interviews"
					description="Add one when it is booked."
					action={{ label: "Add", onPress: noop }}
				/>
				<EmptyState kind="inline" title="No notes yet" />
			</GallerySection>

			<GallerySection
				title="Alert"
				note="The banner: offline, locked, a failed save. Danger announces itself; the others wait to be read."
			>
				{statuses.map(([status, title, description]) => (
					<Alert key={status} status={status}>
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Title>{title}</Alert.Title>
							<Alert.Description>{description}</Alert.Description>
						</Alert.Content>
					</Alert>
				))}
				<Alert status="warning">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>Session expired</Alert.Title>
						<Alert.Description>Sign in again to keep your changes.</Alert.Description>
					</Alert.Content>
					<Button size="sm" variant="secondary" onPress={noop}>
						Sign in
					</Button>
				</Alert>
			</GallerySection>

			<GallerySection
				title="ProgressCircle"
				note="Pro. A score or share as a ring with its value inside (Check's readability score)."
			>
				<Row>
					<ProgressCircle value={86} size="lg" color="accent" accessibilityLabel="Readability score: 86 out of 100">
						86
					</ProgressCircle>
					<ProgressCircle value={54} size="lg" color="warning" accessibilityLabel="Readability score: 54 out of 100">
						54
					</ProgressCircle>
				</Row>
			</GallerySection>

			<GallerySection title="ProgressBar" note="Pro. Known progress (upload, onboarding); accent by default.">
				<ProgressBar value={0} accessibilityLabel="Not started" />
				<ProgressBar value={40} accessibilityLabel="Uploading resume">
					Uploading resume
				</ProgressBar>
				<ProgressBar value={100} color="success" accessibilityLabel="Upload finished">
					Upload finished
				</ProgressBar>
				<ProgressBar value={2} maxValue={4} size="sm" accessibilityLabel="Step 2 of 4" />
				<ProgressBar isIndeterminate accessibilityLabel="Preparing export" />
				<ProgressBar value={60} isDisabled accessibilityLabel="Paused" />
				<Caption>0 · 40 with label · 100 success · sm 2/4 · indeterminate · disabled</Caption>
			</GallerySection>

			<GallerySection title="In a row" note="States sit inside the frame they belong to.">
				<ListSection title="Documents">
					<ListRow icon="file-text" title="Product designer" description="Edited today" onPress={noop} />
					<ListRow icon="file-text" title="Exporting…" trailing={<Spinner size="sm" />} />
				</ListSection>
			</GallerySection>
		</View>
	);
}
