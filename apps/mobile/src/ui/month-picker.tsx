// Picking a month and year (resume dates): Android's date dialog (the day is ignored), iOS's wheels in a sheet with
// Clear and Done. Typed input stays the main way in; this is the calendar button beside it.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Button } from "./button";
import { Sheet } from "./sheet";

export type MonthPickerProps = {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	/** The sheet's title on iOS ("Start"). */
	title: string;
	/** Where the picker starts. */
	value: Date;
	/** BCP 47 locale for month names. */
	locale?: string | undefined;
	onPick: (date: Date) => void;
	onClear: () => void;
	clearLabel: string;
	doneLabel: string;
	closeLabel: string;
};

export function MonthPicker({
	isOpen,
	onOpenChange,
	title,
	value,
	locale,
	onPick,
	onClear,
	clearLabel,
	doneLabel,
	closeLabel,
}: MonthPickerProps) {
	const [picked, setPicked] = useState(value);
	useEffect(() => {
		if (!isOpen) return;
		setPicked(value);
		// Android's own dialog, opened imperatively like DatePicker's; it reports a pick or a dismissal.
		if (Platform.OS === "android")
			DateTimePickerAndroid.open({
				value,
				mode: "date",
				onValueChange: (_event, date) => {
					onOpenChange(false);
					onPick(date);
				},
				onDismiss: () => onOpenChange(false),
			});
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- starts from the value each time it opens
	}, [isOpen]);

	if (Platform.OS === "android") return null;

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={title}
			closeLabel={closeLabel}
			footer={
				<View className="flex-row justify-end gap-2">
					<Button
						variant="ghost"
						onPress={() => {
							onOpenChange(false);
							onClear();
						}}
					>
						{clearLabel}
					</Button>
					<Button
						onPress={() => {
							onOpenChange(false);
							onPick(picked);
						}}
					>
						{doneLabel}
					</Button>
				</View>
			}
		>
			<View className="items-center">
				<DateTimePicker
					value={picked}
					mode="date"
					display="spinner"
					{...(locale ? { locale } : {})}
					onValueChange={(_event, date) => setPicked(date)}
				/>
			</View>
		</Sheet>
	);
}
