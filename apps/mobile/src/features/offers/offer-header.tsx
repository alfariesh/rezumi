// A column's head: the company, role and which offer it is (verbal or written, saved when), a menu to pick another
// saved offer for this side, and a link to the application the offer belongs to.
import type { OfferClock } from "./clock";
import type { Offer } from "./queries";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { companyOf, versionLabel } from "./cells";
import { routes } from "@/routes";
import { Button, Icon, Menu, Text, Typography } from "@/ui";

type OfferHeaderProps = {
	offer: Offer | undefined;
	offers: readonly Offer[];
	/** The offer in the other column, left out of this side's choices. */
	otherId: string | undefined;
	clock: OfferClock;
	onChoose: (id: string) => void;
};

export function OfferHeader({ offer, offers, otherId, clock, onChoose }: OfferHeaderProps) {
	const { t } = useLingui();
	const router = useRouter();
	const choices = offers.filter((item) => item.id !== otherId);
	return (
		<View className="flex-1 gap-2">
			{offer ? (
				<View className="gap-0.5">
					<Typography.Heading type="h6" numberOfLines={2}>
						{companyOf(offer)}
					</Typography.Heading>
					{offer.application?.role ? (
						<Text size="sm" numberOfLines={2}>
							{offer.application.role}
						</Text>
					) : null}
					<Text size="xs" tone="muted">
						{`${versionLabel(offer)} · ${clock.created(offer.createdAt)}`}
					</Text>
				</View>
			) : (
				<View className="gap-0.5 rounded-xl bg-surface-secondary p-3">
					<Text size="sm" weight="semibold">{t`Save another offer to compare`}</Text>
					<Text size="xs" tone="muted">{t`Paste an offer into an application's Messages section.`}</Text>
				</View>
			)}
			{choices.length > (offer ? 1 : 0) ? (
				<Menu>
					<Menu.Trigger asChild>
						<Button
							variant="secondary"
							size="sm"
							accessibilityLabel={offer ? t`Change offer: ${companyOf(offer)}` : t`Choose an offer`}
						>
							<Icon name="arrows-left-right" size={16} />
							<Button.Label>{offer ? t`Change` : t`Choose`}</Button.Label>
						</Button>
					</Menu.Trigger>
					<Menu.Portal>
						<Menu.Overlay />
						<Menu.Content presentation="popover" width={280}>
							{choices.map((item) => (
								<Menu.Item key={item.id} onPress={() => onChoose(item.id)}>
									{item.id === offer?.id ? <Icon name="check" size={16} /> : null}
									<View className="flex-1">
										<Menu.ItemTitle>{`${companyOf(item)} · ${item.application?.role ?? ""}`}</Menu.ItemTitle>
										<Menu.ItemDescription>{`${versionLabel(item)} · ${clock.created(item.createdAt)}`}</Menu.ItemDescription>
									</View>
								</Menu.Item>
							))}
						</Menu.Content>
					</Menu.Portal>
				</Menu>
			) : null}
			{offer?.applicationId && offer.application ? (
				<Button
					variant="ghost"
					size="sm"
					className="self-start"
					accessibilityLabel={t`Open the ${companyOf(offer)} application`}
					onPress={() => offer.applicationId && router.push(routes.applicationDetails(offer.applicationId))}
				>
					<Button.Label>{t`Open application`}</Button.Label>
				</Button>
			) : null}
		</View>
	);
}
