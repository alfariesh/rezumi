import { Platform } from "react-native";

// The platform rules for running Rezumi AI with credits are separate from the read-only Plan screen.
export const canUseRezumiAi = () => Platform.OS === "android";
