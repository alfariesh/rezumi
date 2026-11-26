import { useLingui } from "@lingui/react/macro";
import { Stack } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { javascriptNotices, licenceTexts, nativeNotices } from "@/features/licences/notices";
import { ListGroup, ListRow, Screen, Segment, Text } from "@/ui";

export default function LicencesScreen() {
	const { t } = useLingui();
	const [kind, setKind] = useState<"native" | "javascript">("native");
	const [expanded, setExpanded] = useState<string | null>(null);
	return (
		<Screen scroll={false} edges={["bottom"]}>
			<Stack.Screen options={{ title: t`Licenses` }} />
			<Segment<"native" | "javascript">
				accessibilityLabel={t`Dependency type`}
				value={kind}
				onValueChange={(value) => {
					setKind(value);
					setExpanded(null);
				}}
				options={[
					{ value: "native", label: t`Native & fonts` },
					{ value: "javascript", label: t`JavaScript` },
				]}
			/>
			<FlatList
				data={kind === "native" ? nativeNotices : javascriptNotices}
				keyExtractor={(item) => item.title}
				extraData={expanded}
				initialNumToRender={12}
				renderItem={({ item }) => (
					<ListGroup>
						<ListRow
							title={item.title}
							isSelected={expanded === item.title}
							chevron={false}
							accessibilityHint={expanded === item.title ? t`Hide license` : t`Read license`}
							onPress={() => setExpanded(expanded === item.title ? null : item.title)}
						/>
						{expanded === item.title ? (
							<View className="gap-3 p-4">
								{item.textIds.map((id, paragraph) => (
									<Text key={`${id}:${paragraph}`} selectable>
										{licenceTexts[id]}
									</Text>
								))}
							</View>
						) : null}
					</ListGroup>
				)}
			/>
		</Screen>
	);
}
