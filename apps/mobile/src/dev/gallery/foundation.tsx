// Gallery: tokens (color, type, icons) and the base controls (buttons, rows, bars).
import type { IconName } from "@/ui";
import { View } from "react-native";
import { Caption, GallerySection, Row } from "./section";
import { Button, Icon, IconButton, ListRow, ListSection, Switch, Text, TopBar, Typography, cx } from "@/ui";

const noop = () => undefined;

const swatches = [
	["bg-background", "background"],
	["bg-surface", "surface"],
	["bg-surface-secondary", "surface-secondary"],
	["bg-surface-tertiary", "surface-tertiary"],
	["bg-default", "default"],
	["bg-overlay", "overlay"],
	["bg-accent", "accent"],
	["bg-accent-soft", "accent-soft"],
	["bg-success", "success"],
	["bg-success-soft", "success-soft"],
	["bg-warning", "warning"],
	["bg-warning-soft", "warning-soft"],
	["bg-danger", "danger"],
	["bg-danger-soft", "danger-soft"],
	["bg-paper", "paper"],
] as const;

const stages = [
	["bg-stage-saved", "Saved"],
	["bg-stage-applied", "Applied"],
	["bg-stage-screening", "Screening"],
	["bg-stage-interview", "Interview"],
	["bg-stage-offer", "Offer"],
	["bg-stage-closed", "Closed"],
] as const;

const icons: IconName[] = [
	"house",
	"file-text",
	"briefcase",
	"user-circle",
	"sparkle",
	"magnifying-glass",
	"plus",
	"gear-six",
	"bell",
	"calendar-blank",
	"chat-text",
	"trash",
	"share-network",
	"download-simple",
	"check-circle",
	"warning-circle",
	"arrow-left",
	"caret-right",
	"x",
	"dots-three",
];

export function FoundationGallery() {
	return (
		<View className="gap-8">
			<GallerySection title="Color" note="HeroUI's web theme. Accent only for the main action, selection and progress.">
				<View className="flex-row flex-wrap gap-2">
					{swatches.map(([className, name]) => (
						<View key={name} className="w-[30%] gap-1">
							<View className={cx("h-12 rounded-xl border border-border", className)} />
							<Caption>{name}</Caption>
						</View>
					))}
				</View>
				<Row>
					{stages.map(([className, name]) => (
						<View key={name} className="flex-row items-center gap-1.5 pe-2">
							<View className={cx("size-2.5 rounded-full", className)} />
							<Text size="xs">{name}</Text>
						</View>
					))}
				</Row>
			</GallerySection>

			<GallerySection title="Type" note="Google Sans. Titles and paragraphs: Typography; one-line labels: Text.">
				<Typography.Heading type="h2">Page title 30</Typography.Heading>
				<Typography.Heading type="h4">Section title 20</Typography.Heading>
				<Typography.Heading type="h6">Card or row title 16</Typography.Heading>
				<Typography type="body-sm">
					A paragraph at 14 with 24 leading wraps comfortably over several lines, the way descriptions and helper text
					read on the web.
				</Typography>
				<Text weight="medium">Label 14 medium</Text>
				<Text size="xs" weight="semibold" tone="muted">
					Group label 12 semibold
				</Text>
				<Text mono>rezumi.app/salman · 1,240</Text>
			</GallerySection>

			<GallerySection
				title="Icons"
				note="Hugeicons from @rezumi/icons. Stroke at rest, duotone for the selected state."
			>
				<Row>
					{icons.map((name) => (
						<View key={name} className="size-11 items-center justify-center rounded-lg bg-surface">
							<Icon name={name} size={24} />
						</View>
					))}
				</Row>
				<Row>
					{(["house", "file-text", "briefcase", "user-circle"] as const).map((name) => (
						<View key={name} className="size-11 items-center justify-center rounded-lg bg-accent-soft">
							<Icon name={name} size={24} variant="duotone" tone="accent" />
						</View>
					))}
					<Caption>duotone (selected)</Caption>
				</Row>
			</GallerySection>

			<GallerySection title="Button" note="One primary per screen; secondary for the rest; danger only to confirm.">
				<Row>
					<Button onPress={noop}>Primary</Button>
					<Button variant="secondary" onPress={noop}>
						Secondary
					</Button>
					<Button variant="tertiary" onPress={noop}>
						Tertiary
					</Button>
				</Row>
				<Row>
					<Button variant="outline" onPress={noop}>
						Outline
					</Button>
					<Button variant="ghost" onPress={noop}>
						Ghost
					</Button>
					<Button variant="danger-soft" onPress={noop}>
						Delete
					</Button>
					<Button variant="danger" onPress={noop}>
						Delete forever
					</Button>
				</Row>
				<Row>
					<Button size="sm" onPress={noop}>
						Small
					</Button>
					<Button size="lg" onPress={noop}>
						Large
					</Button>
					<Button isDisabled onPress={noop}>
						Disabled
					</Button>
				</Row>
				<Button onPress={noop}>
					<Icon name="plus" size={16} tone="accent-foreground" />
					<Button.Label>New resume</Button.Label>
				</Button>
			</GallerySection>

			<GallerySection title="IconButton" note="Icon-only controls always carry a label for screen readers.">
				<Row>
					<IconButton icon="magnifying-glass" label="Search" onPress={noop} />
					<IconButton icon="sparkle" label="Coach" variant="secondary" onPress={noop} />
					<IconButton icon="plus" label="New" variant="primary" onPress={noop} />
					<IconButton icon="trash" label="Delete" variant="danger-soft" onPress={noop} />
					<IconButton icon="star" label="Favourite" isSelected onPress={noop} />
					<IconButton icon="x" label="Close" size="sm" onPress={noop} />
				</Row>
			</GallerySection>

			<GallerySection title="ListSection · ListRow" note="Settings-style rows: icon tile, text, control.">
				<ListSection title="Account" footer="Changes save as you go.">
					<ListRow icon="user-circle" title="Account" description="Name, email, password" onPress={noop} />
					<ListRow icon="globe" title="Language" value="English" onPress={noop} />
					<ListRow icon="bell" title="Notifications" trailing={<Switch isSelected onSelectedChange={noop} />} />
					<ListRow icon="sign-out" title="Sign out" tone="danger" onPress={noop} />
				</ListSection>
			</GallerySection>

			<GallerySection title="TopBar">
				<View className="overflow-hidden rounded-2xl border border-border">
					<TopBar
						title="Documents"
						large
						safeTop={false}
						actions={
							<>
								<IconButton icon="sparkle" label="Coach" onPress={noop} />
								<IconButton icon="magnifying-glass" label="Search" onPress={noop} />
							</>
						}
					/>
				</View>
				<View className="overflow-hidden rounded-2xl border border-border">
					<TopBar title="Resume settings" safeTop={false} back={{ label: "Back", onPress: noop }} />
				</View>
			</GallerySection>
		</View>
	);
}
