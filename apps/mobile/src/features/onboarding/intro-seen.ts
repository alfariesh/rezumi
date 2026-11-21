// Whether this install already showed the intro: once per installation, whichever account signs in after.
import Storage from "expo-sqlite/kv-store";

const KEY = "mobile:intro-seen";

export function introSeen(): boolean {
	try {
		return Storage.getItemSync(KEY) === "1";
	} catch {
		// A store that can't be read must not show the intro on every launch.
		return true;
	}
}

export function markIntroSeen() {
	try {
		Storage.setItemSync(KEY, "1");
	} catch {
		// Shown again next launch; nothing else depends on it.
	}
}
