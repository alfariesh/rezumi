// Apple's own "Continue with Apple" button (Human Interface Guidelines: the system button, never a lookalike). Black in
// light mode and white in dark, the HeroUI field radius, 48 pt tall. iOS only; renders nothing where Apple sign-in is
// unavailable, so screens need no platform check.
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { cx } from "./cx";
import { useColorSchemeValue } from "./theme";

type AppleSignInButtonProps = {
	onPress: () => void;
	isDisabled?: boolean | undefined;
	testID?: string | undefined;
};

export function AppleSignInButton({ onPress, isDisabled = false, testID }: AppleSignInButtonProps) {
	const scheme = useColorSchemeValue();
	const [available, setAvailable] = useState(false);
	useEffect(() => {
		if (Platform.OS !== "ios") return;
		void AppleAuthentication.isAvailableAsync().then(setAvailable, () => setAvailable(false));
	}, []);
	if (!available) return null;
	return (
		<View className={cx("h-12 w-full", isDisabled && "opacity-50")}>
			<AppleAuthentication.AppleAuthenticationButton
				testID={testID}
				buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
				buttonStyle={
					scheme === "dark"
						? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
						: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
				}
				cornerRadius={12}
				style={StyleSheet.absoluteFill}
				onPress={isDisabled ? () => undefined : onPress}
			/>
		</View>
	);
}
