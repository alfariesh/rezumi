import { useLocalSearchParams } from "expo-router";
import { TemplateGallery } from "@/features/design/template-gallery";

export default function DesignTemplateGalleryRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <TemplateGallery id={id} />;
}
