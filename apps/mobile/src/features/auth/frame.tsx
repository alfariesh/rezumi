// The frame every sign-in screen shares: safe areas, a back button when the screen is not the first one, the page title
// and an optional sentence under it, then the form, kept to a readable width on tablets.
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { I18nManager, View } from "react-native";
import { routes } from "@/routes";
import { IconButton, Screen, Typography } from "@/ui";

type AuthFrameProps = {
	title: string;
	description?: string | undefined;
	/** Shows Back (to the previous auth screen). */
	back?: boolean | undefined;
	children: ReactNode;
	/** Under the form, pinned to the bottom when the screen is taller than its content (legal links, server). */
	footer?: ReactNode;
	testID?: string | undefined;
};

export function AuthFrame({ title, description, back = true, children, footer, testID }: AuthFrameProps) {
	const { t } = useLingui();
	const router = useRouter();
	return (
		<View className="flex-1 bg-background" testID={testID}>
			<Screen edges={["top", "bottom"]}>
				{back ? (
					<IconButton
						icon={I18nManager.isRTL ? "arrow-right" : "arrow-left"}
						label={t`Back`}
						// Always drawn, so the layout never shifts; a screen opened from a link goes back to Welcome.
						onPress={() => (router.canGoBack() ? router.back() : router.replace(routes.signIn()))}
						className="-ms-2 self-start"
					/>
				) : null}
				<View className="w-full max-w-[480px] gap-6 self-center">
					<View className="gap-2">
						<Typography.Heading type="h2" accessibilityRole="header">
							{title}
						</Typography.Heading>
						{description ? (
							<Typography type="body-sm" className="text-muted">
								{description}
							</Typography>
						) : null}
					</View>
					{children}
					{footer ? <View className="gap-2 pt-4">{footer}</View> : null}
				</View>
			</Screen>
		</View>
	);
}
