import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { View } from "react-native";
import { Banner, Button, Skeleton, useTheme } from "@/ui-legacy";

type LoadStateProps = { query: { isError: boolean; isPending: boolean; refetch: () => unknown } };
export function LoadState({ query }: LoadStateProps) {
	const { t } = useLingui();
	const { space } = useTheme();
	if (query.isError)
		return (
			<>
				<Banner tone="danger" message={t`Couldn't load this. Check your connection and try again.`} />
				<Button
					variant="secondary"
					label={t`Retry`}
					onPress={() => {
						void query.refetch();
					}}
				/>
			</>
		);
	return query.isPending ? <Skeleton height={space.s12 * 2} /> : null;
}
type ActionsProps = { children: ReactNode };
export function Actions({ children }: ActionsProps) {
	const { space } = useTheme();
	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s2 }}>{children}</View>
	);
}
