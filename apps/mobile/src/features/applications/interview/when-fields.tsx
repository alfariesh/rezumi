// When the interview is: date and time on the interview's own clock, its time zone, and its length.
import type { InterviewEditor } from "./use-interview-editor";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Choices } from "./choices";
import { lengthChoices } from "./draft";
import { DatePicker, LinkButton, Text } from "@/ui";
import { TimeField } from "@/ui";

type WhenFieldsProps = { editor: InterviewEditor };

export function WhenFields({ editor }: WhenFieldsProps) {
	const { t } = useLingui();
	const { draft, set, at, pending, userTime } = editor;
	const otherZone = draft.timezone !== userTime.timeZone;
	return (
		<View className="gap-4">
			<View className="flex-row gap-3">
				<View className="flex-1">
					<DatePicker
						label={t`Date`}
						value={draft.date}
						onChange={(date) => date && set("date", date)}
						placeholder={t`Choose a date`}
						locale={userTime.locale}
						isDisabled={pending}
						variant="secondary"
						testID="interview-date"
					/>
				</View>
				<View className="flex-1">
					<TimeField
						label={otherZone ? t`Time · ${draft.timezone.replaceAll("_", " ")}` : t`Time`}
						value={draft.time}
						onChange={(time) => set("time", time)}
						placeholder={t`Choose a time`}
						doneLabel={t`Done`}
						locale={userTime.locale}
						isDisabled={pending}
						isInvalid={!at}
						errorMessage={t`This time doesn't exist in that time zone. Choose another time.`}
						variant="secondary"
						testID="interview-time"
					/>
				</View>
			</View>
			<View className="items-start gap-1">
				<Text size="xs" tone="muted">
					{otherZone && at
						? t`${draft.time} in ${draft.timezone} is ${userTime.when(at)} on your clock (${userTime.timeZone}).`
						: t`Shown on your clock (${userTime.timeZone}).`}
				</Text>
				<LinkButton size="sm" onPress={() => editor.setView("zone")} isDisabled={pending}>
					<LinkButton.Label>
						{otherZone ? t`Change the time zone` : t`Interview is in another time zone`}
					</LinkButton.Label>
				</LinkButton>
			</View>
			<Choices
				label={t`Length`}
				options={lengthChoices(draft.durationMinutes).map((minutes) => ({
					value: minutes,
					label: plural(minutes, { one: "# min", other: "# min" }),
				}))}
				value={draft.durationMinutes}
				onChange={(minutes) => set("durationMinutes", minutes)}
				isDisabled={pending}
			/>
		</View>
	);
}
