import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { PortfolioLoadState, PortfolioPage } from "./layout";
import { previewNavigation } from "./preview-navigation";
import { openPortfolioLink, usePortfolio, usePortfolioAddress } from "./queries";
import { orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { IconButton, Screen, Segment, cx } from "@/ui";

type Width = "phone" | "desktop";

export function PortfolioPreviewScreen() {
	const { t } = useLingui();
	const online = useOnline();
	const portfolio = usePortfolio();
	const { server, url, live } = usePortfolioAddress(portfolio.data?.portfolio);
	const [width, setWidth] = useState<Width>("phone");
	const [workId, setWorkId] = useState<string>();
	const query = useQuery({
		...orpc.portfolio.preview.queryOptions({ input: { width, ...(workId ? { workId } : {}) } }),
		enabled: online,
		gcTime: 0,
		staleTime: 0,
		retry: false,
	});
	// Keep stored credentials, local data and the app's origin outside the preview document.
	const base = `${server.startsWith("http:") ? "http" : "https"}://portfolio-preview.invalid/`;
	const page = query.data;
	const view = useRef<WebView<object>>(null);

	const navigate = (address: string) => {
		if (!page) return false;
		const next = previewNavigation(address, base, page);
		if (next.kind === "preview") setWorkId(next.workId);
		if (next.kind === "external") void openPortfolioLink(next.url);
		return next.kind === "load";
	};

	return (
		<PortfolioPage
			title={t`Portfolio preview`}
			actions={
				live && url ? (
					<IconButton icon="arrow-square-out" label={t`Open public page`} onPress={() => void openPortfolioLink(url)} />
				) : undefined
			}
		>
			<View className="gap-2 px-4 pb-3">
				<Segment<Width>
					value={width}
					onValueChange={setWidth}
					accessibilityLabel={t`Preview size`}
					options={[
						{ value: "phone", label: t`Phone` },
						{ value: "desktop", label: t`Desktop` },
					]}
				/>
				{workId ? (
					<IconButton icon="arrow-left" label={t`Back to portfolio preview`} onPress={() => setWorkId(undefined)} />
				) : null}
			</View>
			{page ? (
				<Screen scroll={false} bare>
					<View className={cx("mx-auto w-full flex-1 overflow-hidden", width === "phone" && "max-w-sm")}>
						<WebView<object>
							ref={view}
							key={`${workId ?? "home"}-${width}-${query.dataUpdatedAt}`}
							testID="portfolio-webview"
							source={{ html: page.html, baseUrl: base }}
							originWhitelist={["*"]}
							onShouldStartLoadWithRequest={(request) =>
								request.url === base ||
								request.url === "about:blank" ||
								(request.isTopFrame !== false && navigate(request.url))
							}
							onOpenWindow={({ nativeEvent }) => {
								navigate(nativeEvent.targetUrl);
							}}
							onLoadStart={({ nativeEvent }) => {
								// Android may time out waiting for its navigation callback.
								if (nativeEvent.url !== base && nativeEvent.url !== "about:blank") view.current?.stopLoading();
							}}
							javaScriptEnabled
							javaScriptCanOpenWindowsAutomatically={false}
							setSupportMultipleWindows
							allowFileAccess={false}
							allowFileAccessFromFileURLs={false}
							allowUniversalAccessFromFileURLs={false}
							domStorageEnabled={false}
							sharedCookiesEnabled={false}
							thirdPartyCookiesEnabled={false}
							cacheEnabled={false}
							mixedContentMode="never"
							scalesPageToFit
						/>
					</View>
				</Screen>
			) : (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			)}
		</PortfolioPage>
	);
}
