import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioHeroEffect } from "@rezumi/schema/portfolio/themes";
import { useLingui } from "@lingui/react/macro";
import { Image, Pressable, View } from "react-native";
import { portfolioThemePicture } from "@rezumi/portfolio/sharing";
import { isFreePortfolioHeroEffect } from "@rezumi/schema/billing";
import { PORTFOLIO_HERO_BACKGROUNDS } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_THEME_INFO, portfolioThemeLineup, themeEffect } from "@rezumi/schema/portfolio/themes";
import { Group, Order } from "./fields";
import { AddPictures, PicturePreview } from "./pictures";
import { useEdit } from "./store";
import { useSession } from "@/auth/session";
import { hasPlanFeature, usePlan } from "@/features/billing/plan";
import { ChipInput, ListGroup, ListRow, Screen, Segment, Text, cx } from "@/ui";

const effectPictures = {
	none: require("../../../../assets/portfolio-effects/none.webp"),
	"fade-up": require("../../../../assets/portfolio-effects/fade-up.webp"),
	shimmer: require("../../../../assets/portfolio-effects/shimmer.webp"),
	gradient: require("../../../../assets/portfolio-effects/gradient.webp"),
	typewriter: require("../../../../assets/portfolio-effects/typewriter.webp"),
	scramble: require("../../../../assets/portfolio-effects/scramble.webp"),
	"vector-hover": require("../../../../assets/portfolio-effects/vector-hover.webp"),
} satisfies Record<PortfolioHeroEffect, number>;

type DesignProps = { data: PortfolioData };

export function Design({ data }: DesignProps) {
	const { t, i18n } = useLingui();
	const edit = useEdit();
	const { server } = useSession();
	const plan = usePlan();
	const theme = PORTFOLIO_THEME_INFO[data.theme];
	const current = themeEffect(data.theme, data.hero.effect.id);
	const effects = {
		none: t`No effect`,
		"fade-up": t`Gentle fade-in`,
		shimmer: t`Shimmer`,
		gradient: t`Living gradient`,
		typewriter: t`Typewriter`,
		scramble: t`Tech scramble`,
		"vector-hover": t`Vector outline`,
	} satisfies Record<PortfolioHeroEffect, string>;
	const backgrounds = { plain: t`Plain`, "soft-gradient": t`Soft gradient`, pattern: t`Pattern`, image: t`Image` };
	return (
		<Screen testID="portfolio-editor-design">
			<Group title={t`Theme`}>
				<View className="flex-row flex-wrap justify-between gap-y-3">
					{portfolioThemeLineup.map((item) => {
						const selected = item.id === data.theme;
						const locked = item.plan === "plus" && !hasPlanFeature(plan, "premiumPortfolioThemes") && !selected;
						return (
							<Pressable
								key={item.id}
								accessibilityRole="radio"
								accessibilityState={{ checked: selected, disabled: locked }}
								accessibilityLabel={locked ? t`${item.name}, available with Plus` : item.name}
								testID={`portfolio-editor-theme-${item.id}`}
								disabled={locked}
								onPress={() =>
									edit((draft) => {
										draft.theme = item.id;
									})
								}
								className={cx(
									"w-[48%] overflow-hidden rounded-xl border bg-surface",
									selected ? "border-accent" : "border-border",
								)}
							>
								<Image
									source={{ uri: `${server}${portfolioThemePicture(item.id, data.locale ?? i18n.locale).thumb}` }}
									resizeMode="cover"
									className="aspect-video w-full bg-surface-secondary"
								/>
								<View className="gap-1 p-3">
									<Text weight="semibold">{item.name}</Text>
									{locked ? <Text tone="muted">{t`Plus`}</Text> : null}
								</View>
							</Pressable>
						);
					})}
				</View>
				<Segment
					accessibilityLabel={t`Page color scheme`}
					value={data.design.scheme ?? theme.defaultScheme}
					onValueChange={(scheme) =>
						edit((draft) => {
							draft.design.scheme = scheme;
						})
					}
					options={[
						{ value: "light", label: t`Light` },
						{ value: "dark", label: t`Dark` },
						{ value: "auto", label: t`Automatic` },
					]}
				/>
			</Group>
			<Group title={t`Intro background`}>
				<ListGroup>
					{PORTFOLIO_HERO_BACKGROUNDS.map((kind) => (
						<ListRow
							key={kind}
							title={backgrounds[kind]}
							chevron={false}
							trailing={data.hero.background.kind === kind ? <Text tone="accent">{t`Selected`}</Text> : null}
							onPress={() =>
								edit((draft) => {
									draft.hero.background.kind = kind;
								})
							}
						/>
					))}
				</ListGroup>
				{data.hero.background.kind === "image" ? (
					<>
						{data.hero.background.image ? (
							<>
								<PicturePreview picture={data.hero.background.image} />
								<Order
									remove={() =>
										edit((draft) => {
											delete draft.hero.background.image;
											draft.hero.background.kind = "plain";
										})
									}
								/>
							</>
						) : null}
						<AddPictures
							label={t`Choose background picture`}
							onPictures={([picture]) => {
								if (picture)
									edit((draft) => {
										draft.hero.background = { kind: "image", image: picture };
									});
							}}
						/>
					</>
				) : null}
			</Group>
			<Group title={t`Intro effect`}>
				<View className="flex-row flex-wrap justify-between gap-y-3">
					{theme.effects.map((effect) => {
						const locked =
							effect !== current && !isFreePortfolioHeroEffect(effect) && !hasPlanFeature(plan, "premiumHeroEffects");
						return (
							<Pressable
								key={effect}
								accessibilityRole="radio"
								accessibilityState={{ checked: current === effect, disabled: locked }}
								accessibilityLabel={locked ? t`${effects[effect]}, available with Plus` : effects[effect]}
								disabled={locked}
								onPress={() =>
									edit((draft) => {
										draft.hero.effect.id = effect;
									})
								}
								className={cx(
									"w-[48%] overflow-hidden rounded-lg border bg-surface-secondary",
									current === effect ? "border-accent" : "border-border",
								)}
							>
								<Image source={effectPictures[effect]} resizeMode="cover" className="aspect-[2.6] w-full" />
								<View className="px-3 py-2">
									<Text>{effects[effect]}</Text>
								</View>
							</Pressable>
						);
					})}
				</View>
				{current === "typewriter" ? (
					<ChipInput
						label={t`Additional roles for the effect`}
						values={data.hero.effect.phrases}
						max={PORTFOLIO_LIMITS.typewriterPhrases}
						maxLength={PORTFOLIO_LIMITS.text.phrase}
						removeLabel={(role) => t`Remove ${role}`}
						onChange={(phrases) =>
							edit((draft) => {
								draft.hero.effect.phrases = phrases;
							})
						}
					/>
				) : null}
				{current !== "none" ? (
					<Segment
						accessibilityLabel={t`Animate`}
						value={data.hero.effect.target}
						onValueChange={(target) =>
							edit((draft) => {
								draft.hero.effect.target = target;
							})
						}
						options={[
							{ value: "name", label: t`Name` },
							{ value: "headline", label: t`Headline` },
						]}
					/>
				) : null}
			</Group>
		</Screen>
	);
}
