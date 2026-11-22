import { useLocalSearchParams } from "expo-router";
import { useSession } from "@/auth/session";
import { CheckPane } from "@/features/check/check-pane";

export default function CheckRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const session = useSession();
	return <CheckPane key={`${id}:${session.server}`} id={id} />;
}
