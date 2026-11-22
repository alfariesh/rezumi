import type { ThumbnailContent } from "./thumbnails";
import type { Template } from "@rezumi/schema/templates";
import { useLingui } from "@lingui/react/macro";
import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import { templateName, templateSample } from "@rezumi/resume/design-presets";
import { templateLayouts } from "@rezumi/schema/templates";
import { useTemplateThumbnail } from "./thumbnails";
import { useSession } from "@/auth/session";
import { Icon, Text, cx, motion } from "@/ui";

/** "One column · ATS-safe": a template's layout in a line. */
export function useLayoutTags() {
	const { t } = useLingui();
	return (id: Template) => {
		const layout = templateLayouts[id];
		return [layout.columns === 1 ? t`One column` : t`Two columns`, layout.atsSafe ? t`ATS-safe` : null]
			.filter(Boolean)
			.join(" · ");
	};
}

const fill = { flex: 1 };

type TemplatePictureProps = {
	id: Template;
	content: ThumbnailContent;
	/** Shown width in points: what the preview is drawn at. */
	width: number;
	/** The 300 pt sample instead of the 600 pt one, for small cards. */
	small?: boolean | undefined;
};

/** A template's first page: drawn from the person's resume when it can be, its sample picture until then. */
export function TemplatePicture({ id, content, width, small = false }: TemplatePictureProps) {
	const { i18n } = useLingui();
	const session = useSession();
	const thumbnail = useTemplateThumbnail(id, content, width);
	const sample = templateSample(id, i18n.locale);
	return (
		<Image
			source={{ uri: thumbnail ?? `${session.server}${small ? sample.smallThumbnail : sample.thumbnail}` }}
			contentFit="cover"
			contentPosition="top"
			transition={motion.standard}
			// expo-image takes no className.
			style={fill}
			accessibilityIgnoresInvertColors
		/>
	);
}

type TemplateCardProps = {
	id: Template;
	content: ThumbnailContent;
	width: number;
	/** The resume's template now. */
	selected: boolean;
	/** On the page as a try, not applied yet. */
	trying: boolean;
	/** Android: "Plus" on a premium template while plans apply. */
	labelled: boolean;
	disabled: boolean;
	onPress: () => void;
};

/** One template in the gallery: its page, name and layout. A press tries it on the page; the footer applies it. */
export function TemplateCard(props: TemplateCardProps) {
	const { id, content, width, selected, trying, labelled, disabled, onPress } = props;
	const { t } = useLingui();
	const layoutTags = useLayoutTags();
	const name = templateName(id);
	const state = selected ? t`In use` : trying ? t`On the page` : undefined;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[name, layoutTags(id), labelled ? "Plus" : null, state].filter(Boolean).join(", ")}
			accessibilityHint={selected ? undefined : t`Shows it on the page before you apply it.`}
			accessibilityState={{ selected: selected || trying, disabled }}
			disabled={disabled}
			onPress={onPress}
			className="gap-1.5 active:scale-[0.98]"
			style={[{ width }]}
		>
			{/* The paper is white in both themes. */}
			<View
				className={cx(
					"aspect-[210/297] overflow-hidden rounded-xl border bg-paper",
					selected || trying ? "border-2 border-accent" : "border-border",
				)}
			>
				<TemplatePicture id={id} content={content} width={width} />
				{selected ? (
					<View className="absolute end-1.5 top-1.5 size-6 items-center justify-center rounded-full bg-accent">
						<Icon name="check" size={14} tone="accent-foreground" />
					</View>
				) : labelled ? (
					<View className="absolute end-1.5 top-1.5 rounded-full bg-foreground/70 px-1.5 py-0.5">
						<Text size="xs" weight="medium" className="text-background">
							Plus
						</Text>
					</View>
				) : null}
			</View>
			<Text weight="medium" numberOfLines={1}>
				{name}
			</Text>
			<Text size="xs" tone="muted" numberOfLines={1}>
				{layoutTags(id)}
			</Text>
		</Pressable>
	);
}
