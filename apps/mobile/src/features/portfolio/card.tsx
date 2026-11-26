import type Svg from "react-native-svg";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { businessCardAddress, cardFileName } from "@rezumi/portfolio/sharing";
import { sharePortfolioFile } from "./export";
import { PortfolioLoadState, PortfolioPage } from "./layout";
import { openPortfolioLink, usePortfolio, usePortfolioAddress } from "./queries";
import { useOnline } from "@/api/online";
import { Button, EmptyState, ListRow, ListSection, Screen, Text, showToast, size, space } from "@/ui";

export function PortfolioCardScreen() {
	const { t } = useLingui();
	const query = usePortfolio();
	const online = useOnline();
	const { url, live, server, username } = usePortfolioAddress(query.data?.portfolio);
	const qrRef = useRef<Svg | null>(null);
	const [busy, setBusy] = useState(false);
	const { width } = useWindowDimensions();
	const address = live && url ? businessCardAddress(url) : null;
	const share = () => {
		const svg = qrRef.current;
		if (!svg || busy) return;
		setBusy(true);
		svg.toDataURL((data) => {
			void sharePortfolioFile(cardFileName(username ?? "", "png"), data, "image/png")
				.catch(() => showToast({ title: t`Couldn't share the QR image. Try again.`, variant: "danger" }))
				.finally(() => setBusy(false));
		});
	};
	return (
		<PortfolioPage title={t`Business card`}>
			{!query.data ? (
				<PortfolioLoadState offline={!online} error={query.isError} retry={() => void query.refetch()} />
			) : (
				<Screen>
					{address ? (
						<>
							<View className="items-center gap-4 py-4">
								<View
									accessible
									accessibilityLabel={t`QR code for ${address.shown}`}
									accessibilityRole="image"
									className="rounded-xl bg-paper p-3"
								>
									<QRCode
										value={address.qr}
										size={Math.min(size.hit * 8, width - 2 * (space[4] + space[3]))}
										quietZone={space[4]}
										getRef={(svg: Svg | null) => {
											qrRef.current = svg;
										}}
									/>
								</View>
								<Text mono selectable>
									{address.shown}
								</Text>
							</View>
							<Button isDisabled={busy} onPress={share}>{t`Save or share PNG`}</Button>
							<ListSection>
								<ListRow
									title={t`A4 print sheet`}
									description={t`Set up on the web`}
									icon="arrow-square-out"
									isDisabled={!online}
									onPress={() => void openPortfolioLink(`${server}/dashboard/portfolio`)}
								/>
							</ListSection>
						</>
					) : (
						<EmptyState kind="page" icon="qr-code" title={t`Publish to share your QR code.`} />
					)}
				</Screen>
			)}
		</PortfolioPage>
	);
}
