// Building blocks of the dev gallery (app/dev/ui.tsx). Sample copy is not translated: the gallery is not a product
// screen and production builds never reach it.
import type { ReactNode } from "react";
import { View } from "react-native";
import { Text, Typography } from "@/ui";

type GallerySectionProps = { title: string; note?: string; children: ReactNode };

/** One component (or one family) with a heading and an optional line on when to use it. */
export function GallerySection({ title, note, children }: GallerySectionProps) {
	return (
		<View className="gap-3">
			<View className="gap-1">
				<Typography.Heading type="h6">{title}</Typography.Heading>
				{note ? (
					<Typography type="body-xs" color="muted">
						{note}
					</Typography>
				) : null}
			</View>
			{children}
		</View>
	);
}

/** Wrapping row of samples. */
export function Row({ children }: { children: ReactNode }) {
	return <View className="flex-row flex-wrap items-center gap-2">{children}</View>;
}

/** A small caption under or beside a sample. */
export function Caption({ children }: { children: ReactNode }) {
	return (
		<Text size="xs" tone="muted">
			{children}
		</Text>
	);
}
