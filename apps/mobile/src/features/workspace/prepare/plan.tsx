// W6, the day before: the timed plan from the briefing (ticks kept with the application), the questions to ask, the
// briefing itself, the automatic refresh and the stories to bring.
import type { WorkspacePartProps } from "../part";
import type { SavedData } from "../queries";
import type { Briefing } from "./briefing";
import type { Application } from "@/features/applications/types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ActionButton, Block, CheckRow, Pill } from "../blocks";
import { useGenerate, useTicks, useWorkspace } from "../queries";
import { useWorking, workingSteps } from "../working";
import { BriefingSheet, StoriesToBring } from "./briefing";
import { RefreshSwitch } from "./refresh-switch";
import { useHasAIProvider } from "@/features/ai/providers";
import { routes } from "@/routes";
import { Text, Typography, cx } from "@/ui";

type PlanProps = {
	application: Application;
	interview: InterviewTimelineEntry | undefined;
	briefing: Briefing;
	readOnly: boolean;
	go: WorkspacePartProps["go"];
};

export function Plan({ application, interview, briefing, readOnly, go }: PlanProps) {
	const { t } = useLingui();
	const router = useRouter();
	const { data } = briefing;
	const ticks = useTicks(application.id, `plan:${briefing.id}`);
	const workspace = useWorkspace(application.id);
	const [reading, setReading] = useState(false);
	const provider = useHasAIProvider().defaultProvider;
	const generate = useGenerate(application.id);
	const againLabel = useWorking(generate.isPending, workingSteps("briefing"), t`Plan again`);
	const done = (index: number) => ticks.ticked.includes(String(index));
	const total = data.plan.reduce((sum, row) => sum + row.minutes, 0);
	const doneMinutes = data.plan.reduce((sum, row, index) => sum + (done(index) ? row.minutes : 0), 0);
	const questions = [...data.questions, ...workspace.data.questions];

	const action = (row: SavedData<"briefing">["plan"][number]) => {
		switch (row.action) {
			case "story":
				return { label: t`Open story`, onPress: () => router.push(routes.profile("stories")) };
			case "draft-story":
				return { label: t`Draft story`, onPress: () => router.push(routes.profile("stories")) };
			case "practise":
				return { label: t`Practice`, onPress: () => go("practise", { speak: true }) };
			case "questions":
			case "none":
				return null;
		}
	};

	return (
		<View className="gap-4">
			<View className="gap-1">
				<Typography.Heading type="h4">{data.headline}</Typography.Heading>
				<Typography type="body-sm" color="muted">
					{data.summary}
				</Typography>
				<Text mono size="xs" tone="muted">{t`${doneMinutes} of ${total} min`}</Text>
			</View>
			{/* The interview, posting or Profile changed since it was planned: plan again on request. */}
			{briefing.outdated && !readOnly && provider && interview ? (
				<ActionButton
					label={againLabel}
					busy={generate.isPending}
					onPress={() => void generate.run({ task: "briefing", interviewId: interview.id }).catch(() => undefined)}
				/>
			) : null}
			<View
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				className="h-1.5 flex-row gap-0.5 overflow-hidden rounded-full"
			>
				{data.plan.map((row, index) => {
					// Each block's width is its share of the minutes, known only at run time.
					const share = { flexGrow: row.minutes, flexBasis: 0 };
					return (
						<View
							key={`${row.title}-${index}`}
							style={share}
							className={cx(done(index) ? "bg-accent" : "bg-default")}
						/>
					);
				})}
			</View>
			<Block>
				{data.plan.map((row, index) => {
					const next = action(row);
					const minutes = row.minutes;
					return (
						<View key={`${row.title}-${index}`} className="gap-1">
							<CheckRow
								label={row.title}
								detail={row.detail}
								checked={done(index)}
								disabled={readOnly}
								strike
								onChange={(on) => ticks.toggle(String(index), on)}
								trailing={<Text mono size="xs" tone="muted">{t`${minutes} min`}</Text>}
							/>
							{next ? (
								<View className="ps-8">
									<ActionButton label={next.label} onPress={next.onPress} />
								</View>
							) : null}
						</View>
					);
				})}
			</Block>
			{questions.length > 0 ? (
				<Block title={t`Questions to ask`}>
					{questions.map((question, index) => (
						<View key={`${question.text}-${index}`} className="flex-row gap-2">
							<Text mono tone="accent">
								{String(index + 1)}
							</Text>
							<Typography type="body-sm" className="flex-1">
								{question.text}
							</Typography>
							<Text size="xs" tone="muted">
								{question.origin}
							</Text>
						</View>
					))}
				</Block>
			) : null}
			<Block title={t`10-minute briefing`} trailing={<Pill tone="accent" label={t`Ready`} />}>
				<Typography type="body-xs" color="muted">
					{t`Your opening, the stories to bring and questions to ask. It becomes your checklist 10 minutes before the call.`}
				</Typography>
				<ActionButton label={t`Read briefing`} onPress={() => setReading(true)} />
			</Block>
			{interview && !readOnly ? <RefreshSwitch application={application} interview={interview} /> : null}
			<StoriesToBring applicationId={application.id} briefing={briefing} />
			<BriefingSheet briefing={briefing} isOpen={reading} onOpenChange={setReading} />
		</View>
	);
}
