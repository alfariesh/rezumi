import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { PortfolioLoadState, PortfolioPage } from "./layout";
import { previewNavigation } from "./preview-navigation";
import { openPortfolioLink, usePortfolio, usePortfolioAddress } from "./queries";
import { orpc } from "@/api/client";
import { useOnline } from "@/api/online";
import { useSession } from "@/auth/session";
import { Button, IconButton, Screen, Segment, cx } from "@/ui";

type Width = "phone" | "desktop";

export function PortfolioPreviewScreen() {
	const { t } = useLingui();
	const { workId } = useLocalSearchParams<{ workId?: string }>();
	const portfolio = usePortfolio();
	const { url, live } = usePortfolioAddress(portfolio.data?.portfolio);
	return (
		<PortfolioPage
			title={t`Portfolio preview`}
			actions={
				live && url ? (
					<IconButton icon="arrow-square-out" label={t`Open public page`} onPress={() => void openPortfolioLink(url)} />
				) : undefined
			}
		>
			<PortfolioPreview key={workId ?? "home"} initialWorkId={workId} />
		</PortfolioPage>
	);
}

type PreviewProps = { initialWorkId?: string | undefined; version?: number | undefined; compact?: boolean };

export function PortfolioPreview({ initialWorkId, version, compact = false }: PreviewProps) {
	const { t } = useLingui();
	const online = useOnline();
	const { server } = useSession();
	const [width, setWidth] = useState<Width>("phone");
	const [workId, setWorkId] = useState(initialWorkId);
	const [replay, setReplay] = useState(0);
	const options = orpc.portfolio.preview.queryOptions({ input: { width, ...(workId ? { workId } : {}) } });
	const query = useQuery({
		...options,
		queryKey: [...options.queryKey, server, version],
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
		<View className="flex-1">
			<View className="gap-2 px-4 pb-3">
				{!compact ? (
					<Segment<Width>
						value={width}
						onValueChange={setWidth}
						accessibilityLabel={t`Preview size`}
						options={[
							{ value: "phone", label: t`Phone` },
							{ value: "desktop", label: t`Desktop` },
						]}
					/>
				) : null}
				<View className="flex-row gap-2">
					{page && !workId ? (
						<Button
							size="sm"
							variant="secondary"
							onPress={() => setReplay((value) => value + 1)}
						>{t`Replay intro`}</Button>
					) : null}
					{workId ? (
						<IconButton icon="arrow-left" label={t`Back to portfolio preview`} onPress={() => setWorkId(undefined)} />
					) : null}
					{!compact && online ? (
						<Button
							size="sm"
							variant="secondary"
							onPress={() => void openPortfolioLink(`${server}/builder/portfolio`)}
						>{t`Reorder in the web preview`}</Button>
					) : null}
				</View>
			</View>
			{page ? (
				<Screen scroll={false} bare>
					<View className={cx("mx-auto w-full flex-1 overflow-hidden", width === "phone" && "max-w-sm")}>
						<WebView<object>
							ref={view}
							key={`${workId ?? "home"}-${width}-${query.dataUpdatedAt}-${replay}`}
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
		</View>
	);
}
