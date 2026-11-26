import Storage from "expo-sqlite/kv-store";

const key = "rezumi:ai-sharing-blocked";

export const isAiSharingBlocked = () => Storage.getItemSync(key) === "yes";
export function setAiSharingBlocked(blocked: boolean) {
	if (blocked) Storage.setItemSync(key, "yes");
	else Storage.removeItemSync(key);
}
