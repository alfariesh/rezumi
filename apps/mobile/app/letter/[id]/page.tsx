import { useLocalSearchParams, useRouter } from "expo-router";
import { LetterPage } from "@/features/letters/page";
import { routes } from "@/routes";

/** Also rendered beside the panel on tablet by the letter layout, so it reads the id without being focused. */
export default function LetterPageScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	return <LetterPage id={id} onFullScreen={() => router.push(routes.letterPreview(id))} />;
}
