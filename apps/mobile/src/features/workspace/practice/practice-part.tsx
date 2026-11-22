// Practice (web workspace/practise.tsx): questions from the briefing and from Debrief (or general ones, or one story
// from the Profile), answered typed or spoken, and every attempt with feedback kept.
import type { WorkspacePartProps } from "../part";
import type { SavedItem } from "../queries";
import type { Attempt } from "./feedback-card";
import type { Question } from "./question-card";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { ActionButton, Block, Caption, Notice } from "../blocks";
import { latest, useSavedItems, useStories } from "../queries";
import { useVoiceSettings } from "../voice";
import { SavedAttempt } from "./feedback-card";
import { Session } from "./session";
import { useUserTime } from "@/features/applications/date";
import { ListGroup, ListRow, Skeleton } from "@/ui";

const isAttempt = (item: SavedItem): item is Attempt => item.data.kind === "practice";

export function PracticePart({ application, version, interview, speak, story, now, go }: WorkspacePartProps) {
	const { t } = useLingui();
	const saved = useSavedItems(application.id);
	const stories = useStories(application.id);
	const voice = useVoiceSettings();
	const viewing = version && isAttempt(version) ? version : undefined;
	const attempts = saved.data?.filter(isAttempt) ?? [];
	const selectedStory = story ? stories.data?.find((item) => item.id === story) : undefined;
	const company = application.company;

	if (story && stories.isError)
		return (
			<Notice
				status="danger"
				message={t`Your story couldn't be loaded.`}
				action={{ label: t`Try again`, onPress: () => void stories.refetch() }}
			/>
		);
	if (story && stories.isPending) return <Skeleton variant="none" className="h-60 rounded-2xl" />;
	if (story && !selectedStory)
		return (
			<View className="gap-3">
				<Notice status="warning" message={t`This story is unavailable or uses facts that are switched off.`} />
				<ActionButton label={t`Practice another question`} onPress={() => go("practise")} />
			</View>
		);

	const storyTitle = selectedStory?.data.title;
	// The briefing's practice questions for this interview, then questions recalled in Debrief; general ones otherwise.
	const simulated = latest(saved.data, "briefing", interview?.id)?.data.practiceQuestions ?? [];
	const recalled = (saved.data ?? []).flatMap((item) => (item.data.kind === "debrief" ? [item.data.question] : []));
	const found: Question[] = [
		...simulated.map((text) => ({ text, origin: "simulated" as const })),
		...[...new Set(recalled)].map((text) => ({ text, origin: "recalled" as const })),
	];
	const questions: Question[] = storyTitle
		? [
				{
					text: t`Tell me about “${storyTitle}”. What was your part, what did you do, and what changed?`,
					origin: "simulated",
				},
			]
		: found.length > 0
			? found
			: [
					t`Tell me about a piece of work you're proud of. What was your part in it, and how did you measure success?`,
					t`Tell me about a time you disagreed with a colleague. How did you resolve it?`,
					t`Why do you want this role at ${company}?`,
				].map((text) => ({ text, origin: "simulated" as const }));

	return (
		<View className="gap-4">
			{viewing ? (
				<SavedAttempt item={viewing} />
			) : saved.isPending ? (
				<Skeleton variant="none" className="h-72 rounded-2xl" />
			) : (
				<Session
					key={`${application.id}:${interview?.id ?? "none"}:${story ?? "general"}`}
					applicationId={application.id}
					interviewId={interview?.id ?? null}
					questions={questions}
					storyId={selectedStory?.id}
					storyTitle={storyTitle}
					voice={voice}
					initialMode={speak ? "spoken" : "typed"}
				/>
			)}
			<Attempts attempts={attempts} now={now} current={viewing?.id} onOpen={(id) => go("practise", { version: id })} />
			<Caption>{t`Compare attempts to see what improved. Practice questions are simulated, not from ${company}.`}</Caption>
		</View>
	);
}

type AttemptsProps = { attempts: Attempt[]; now: Date; current: string | undefined; onOpen: (id: string) => void };

function Attempts({ attempts, now, current, onOpen }: AttemptsProps) {
	const { t } = useLingui();
	const { day, time, when } = useUserTime();
	return (
		<Block title={t`Your attempts`}>
			{attempts.length === 0 ? (
				<Caption>{t`Each answer you get feedback on is kept here, newest first.`}</Caption>
			) : (
				<ListGroup variant="secondary">
					{attempts.map((item) => {
						const hour = time(item.createdAt);
						const at = day(item.createdAt) === day(now) ? t`Today, ${hour}` : when(item.createdAt);
						const mode = item.data.mode === "spoken" ? t`spoken` : t`typed`;
						return (
							<ListRow
								key={item.id}
								title={item.data.answer}
								description={[`${at} · ${mode}`, item.data.note].filter(Boolean).join(" · ")}
								icon={item.data.mode === "spoken" ? "microphone" : "keyboard"}
								isSelected={item.id === current}
								onPress={() => onOpen(item.id)}
							/>
						);
					})}
				</ListGroup>
			)}
		</Block>
	);
}
