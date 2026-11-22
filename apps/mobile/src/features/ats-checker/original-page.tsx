// The uploaded PDF as pages, rasterised on the device (modules/pdf-pages): what the checker read, beside its report.
import type { PageImage } from "../../../modules/pdf-pages";
import { useLingui } from "@lingui/react/macro";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { PixelRatio, View } from "react-native";
import { pdfPages } from "../../../modules/pdf-pages";
import { EmptyState, Skeleton, Text } from "@/ui";

// ponytail: rasterises up to 10 pages at once; page-by-page virtualisation if long files show up.
const MAX_PAGES = 10;

type OriginalPageProps = { uri: string };

export function OriginalPage({ uri }: OriginalPageProps) {
	const { t } = useLingui();
	const [width, setWidth] = useState(0);
	const [pages, setPages] = useState<PageImage[] | null>(null);
	const [pageCount, setPageCount] = useState(0);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (width <= 0) return;
		let id: string | undefined;
		let active = true;
		void (async () => {
			try {
				const document = await pdfPages.open(new Uint8Array(await new File(uri).arrayBuffer()));
				if (!active) return void pdfPages.close(document.id).catch(() => {});
				id = document.id;
				const first = document.pages[0];
				// A file with no pages has nothing to show: say so rather than load forever.
				if (!first) {
					if (active) setFailed(true);
					return;
				}
				const scale = Math.min(6, (width * PixelRatio.get()) / first.width);
				const indices = document.pages.slice(0, MAX_PAGES).map((_, index) => index);
				const images = await pdfPages.rasterize(document.id, indices, scale);
				if (active) {
					setPageCount(document.pages.length);
					setPages(images);
				}
			} catch {
				if (active) setFailed(true);
			}
		})();
		return () => {
			active = false;
			if (id) void pdfPages.close(id).catch(() => {});
		};
	}, [uri, width]);

	return (
		<View className="gap-4" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
			{failed ? (
				<EmptyState kind="inline" title={t`This file couldn't be shown as pages. The report still applies.`} />
			) : !pages ? (
				<Skeleton variant="none" className="aspect-[1/1.414] w-full rounded-lg" />
			) : (
				<>
					{pageCount > pages.length ? (
						<Text size="xs" tone="muted" className="text-center" testID="original-pages-limit">
							{t`Only the first ${MAX_PAGES} pages are shown.`}
						</Text>
					) : null}
					{pages.map((page) => (
						<View key={page.index} className="gap-2">
							<View className="overflow-hidden rounded-lg bg-paper shadow-surface">
								<Image
									source={{ uri: page.uri }}
									accessibilityLabel={t`Page ${page.index + 1} of the uploaded PDF`}
									style={[{ width, aspectRatio: page.width / page.height }]}
								/>
							</View>
							<Text size="xs" tone="muted" className="text-center">
								{t`Page ${page.index + 1}`}
							</Text>
						</View>
					))}
				</>
			)}
		</View>
	);
}
