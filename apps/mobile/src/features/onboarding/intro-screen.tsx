// The intro (01-desain 3): three pages before Welcome on a fresh install, Skip on every page, dots to show where you
// are. Each picture is drawn with the app's own components and fictional data, so it follows the theme, the language
// and the text size; screen readers skip the pictures and read each page's title and sentence.
import type { ReactNode } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollViewInstance } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { markIntroSeen } from "./intro-seen";
import { routes } from "@/routes";
import { Avatar, Button, Card, Chip, Icon, StageLabel, Text, Typography, cx, haptics, useReducedMotion } from "@/ui";

type Page = { key: string; title: string; body: string; picture: ReactNode };

export function IntroScreen() {
	const { t } = useLingui();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const reduced = useReducedMotion();
	const scroll = useRef<ScrollViewInstance>(null);
	const [page, setPage] = useState(0);

	const pages: Page[] = [
		{
			key: "resume",
			title: t`A resume in minutes`,
			body: t`Bring your LinkedIn or an old resume, pick a template, and download a clean PDF.`,
			picture: <ResumePicture />,
		},
		{
			key: "applications",
			title: t`Track every application`,
			body: t`See where each one stands, get new roles that fit you, and never miss an interview.`,
			picture: <ApplicationsPicture />,
		},
		{
			key: "portfolio",
			title: t`A portfolio and a coach`,
			body: t`Share your work on your own page, and practise with a coach that knows your story.`,
			picture: <PortfolioPicture />,
		},
	];
	const last = page === pages.length - 1;

	const finish = () => {
		markIntroSeen();
		router.replace(routes.signIn());
	};
	const goTo = (index: number) => {
		haptics.selection();
		setPage(index);
		scroll.current?.scrollTo({ x: index * width, animated: !reduced });
	};
	const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const index = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
		if (index !== page) setPage(index);
	};
	const top = { paddingTop: insets.top };
	const bottom = { paddingBottom: Math.max(insets.bottom, 16) };
	const pageFrame = { width };

	return (
		<View className="flex-1 bg-background" testID="intro">
			<View className="min-h-11 flex-row items-center justify-end px-2" style={top}>
				<Button variant="ghost" size="sm" onPress={finish} testID="intro-skip">
					<Button.Label>{t`Skip`}</Button.Label>
				</Button>
			</View>
			<ScrollView
				ref={scroll}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={onScrollEnd}
				className="flex-1"
			>
				{pages.map((item) => (
					<View key={item.key} style={pageFrame} className="flex-1 justify-center gap-8 px-6">
						<View
							className="w-full max-w-[420px] self-center"
							pointerEvents="none"
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
						>
							{item.picture}
						</View>
						<View className="w-full max-w-[420px] gap-3 self-center">
							<Typography.Heading type="h2" accessibilityRole="header" className="text-center">
								{item.title}
							</Typography.Heading>
							<Typography type="body-sm" color="muted" className="text-center">
								{item.body}
							</Typography>
						</View>
					</View>
				))}
			</ScrollView>
			<View className="gap-5 px-6 pt-4" style={bottom}>
				<View className="flex-row justify-center gap-1" accessibilityRole="tablist">
					{pages.map((item, index) => (
						<Pressable
							key={item.key}
							accessibilityRole="tab"
							accessibilityLabel={t`Page ${index + 1} of ${pages.length}: ${item.title}`}
							accessibilityState={{ selected: index === page }}
							onPress={() => goTo(index)}
							hitSlop={8}
							className="h-11 justify-center px-1"
						>
							<View className={cx("h-2 rounded-full", index === page ? "w-6 bg-accent" : "w-2 bg-default")} />
						</Pressable>
					))}
				</View>
				<Button
					size="lg"
					className="w-full max-w-[420px] self-center"
					onPress={() => (last ? finish() : goTo(page + 1))}
					testID="intro-next"
				>
					<Button.Label>{last ? t`Get started` : t`Next`}</Button.Label>
				</Button>
			</View>
		</View>
	);
}

/** A first page of a resume in the making, with what the builder adds around it. */
function ResumePicture() {
	const { t } = useLingui();
	return (
		<View className="items-center">
			<Card className="w-4/5">
				<Card.Body className="gap-3">
					<View className="gap-0.5">
						<Typography.Heading type="h5">Ayu Pratiwi</Typography.Heading>
						<Text size="xs" tone="muted">
							{t`Data analyst · Bandung`}
						</Text>
					</View>
					<View className="h-px bg-separator" />
					<Text size="xs" weight="semibold" tone="accent">
						{t`Experience`}
					</Text>
					<View className="gap-1.5">
						<View className="h-2 w-11/12 rounded-full bg-default" />
						<View className="h-2 w-4/5 rounded-full bg-default" />
						<View className="h-2 w-2/3 rounded-full bg-default" />
					</View>
					<Text size="xs" weight="semibold" tone="accent">
						{t`Skills`}
					</Text>
					<View className="flex-row flex-wrap gap-1.5">
						{["SQL", "Python", "Looker"].map((skill) => (
							<Chip key={skill} size="sm" variant="secondary">
								<Chip.Label>{skill}</Chip.Label>
							</Chip>
						))}
					</View>
				</Card.Body>
			</Card>
			<View className="-mt-5 flex-row items-center gap-2 rounded-full bg-surface px-3 py-2 shadow-overlay">
				<Icon name="check-circle" size={16} tone="success" />
				<Text size="xs" weight="medium">
					{t`ATS-safe template`}
				</Text>
			</View>
		</View>
	);
}

/** Applications at a glance, by stage, with a new role found for the person. */
function ApplicationsPicture() {
	const { t } = useLingui();
	const rows = [
		{ role: t`Data analyst`, company: "Kopi Senja", stage: "interview", label: t`Interview` },
		{ role: t`BI analyst`, company: "Lumbung Data", stage: "applied", label: t`Applied` },
		{ role: t`Analytics lead`, company: "Sawah Labs", stage: "offer", label: t`Offer` },
	] as const;
	return (
		<View className="gap-3">
			<Card>
				<Card.Body className="gap-0 py-1">
					{rows.map((row, index) => (
						<View
							key={row.company}
							className={cx("flex-row items-center gap-3 py-2.5", index > 0 && "border-t border-separator")}
						>
							<View className="size-9 items-center justify-center rounded-lg bg-surface-secondary">
								<Icon name="briefcase" size={18} tone="muted" />
							</View>
							<View className="min-w-0 flex-1">
								<Text weight="medium" numberOfLines={1}>
									{row.role}
								</Text>
								<Text size="xs" tone="muted" numberOfLines={1}>
									{row.company}
								</Text>
							</View>
							<StageLabel stage={row.stage} label={row.label} size="xs" />
						</View>
					))}
				</Card.Body>
			</Card>
			<View className="flex-row items-center gap-2 self-center rounded-full bg-accent-soft px-3 py-2">
				<Icon name="bell" size={16} tone="accent-soft-foreground" />
				<Text size="xs" weight="medium" className="text-accent-soft-foreground">
					{t`3 new roles match you`}
				</Text>
			</View>
		</View>
	);
}

/** A portfolio page's header and a line from the coach. */
function PortfolioPicture() {
	const { t } = useLingui();
	return (
		<View className="gap-3">
			<Card>
				<Card.Body className="flex-row items-center gap-3">
					<Avatar alt="Ayu Pratiwi" size="lg" variant="soft" color="accent">
						<Avatar.Fallback>AP</Avatar.Fallback>
					</Avatar>
					<View className="min-w-0 flex-1 gap-0.5">
						<Text weight="semibold">Ayu Pratiwi</Text>
						<Text size="xs" tone="muted" mono numberOfLines={1}>
							rezumi.app/ayu
						</Text>
					</View>
					<Chip size="sm" variant="soft" color="success">
						<Chip.Label>{t`Live`}</Chip.Label>
					</Chip>
				</Card.Body>
			</Card>
			<View className="ms-8 rounded-2xl rounded-tr-sm bg-accent px-4 py-3">
				<Text className="text-accent-foreground">{t`Can you help me answer "Tell me about yourself"?`}</Text>
			</View>
			<View className="me-8 flex-row gap-2 rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
				<Icon name="sparkle" size={16} tone="accent" />
				<Text className="flex-1">{t`Start with your dashboard project at Kopi Senja: it cut report time by half.`}</Text>
			</View>
		</View>
	);
}
