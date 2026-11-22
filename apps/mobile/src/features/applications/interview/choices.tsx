// A few short choices as tags that wrap (interview kind, length, reminder lead), where a segment would cut the words.
import { View } from "react-native";
import { TagGroup, Text, haptics } from "@/ui";

type ChoicesProps<T extends string | number> = {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
	isDisabled?: boolean | undefined;
};

export function Choices<T extends string | number>({ label, options, value, onChange, isDisabled }: ChoicesProps<T>) {
	return (
		<View className="gap-2">
			<Text weight="medium">{label}</Text>
			<TagGroup
				selectionMode="single"
				selectedKeys={new Set([String(value)])}
				isDisabled={isDisabled ?? false}
				onSelectionChange={(keys) => {
					const [key] = [...keys];
					const picked = options.find((option) => String(option.value) === String(key));
					if (!picked || picked.value === value) return;
					haptics.selection();
					onChange(picked.value);
				}}
				accessibilityLabel={label}
			>
				<TagGroup.List>
					{options.map((option) => (
						<TagGroup.Item key={String(option.value)} id={String(option.value)}>
							<TagGroup.ItemLabel>{option.label}</TagGroup.ItemLabel>
						</TagGroup.Item>
					))}
				</TagGroup.List>
			</TagGroup>
		</View>
	);
}
