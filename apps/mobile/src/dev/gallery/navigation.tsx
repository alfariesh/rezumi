// Gallery: the push drawer, tabs, segments, steps and the floating action.
import { useState } from "react";
import { View } from "react-native";
import { Caption, GallerySection, Row } from "./section";
import { Button, PushDrawer, Text } from "@/ui";
import { Fab, Segment, Stepper, Tabs } from "@/ui/navigation";

const noop = () => undefined;

const onboarding = [
	{ title: "Sign in", description: "Your account on rezumi.app" },
	{ title: "Your profile", description: "Import LinkedIn or a resume" },
	{ title: "First resume", description: "Pick a template" },
	{ title: "Notifications" },
];

export function NavigationGallery() {
	const [tab, setTab] = useState("overview");
	const [view, setView] = useState<"list" | "board">("list");
	const [range, setRange] = useState<"week" | "month" | "year">("week");
	const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
	const [section, setSection] = useState<"basics" | "experience" | "education" | "skills">("basics");
	const [step, setStep] = useState(1);
	const [drawer, setDrawer] = useState(false);
	return (
		<View className="gap-8">
			<GallerySection
				title="PushDrawer"
				note="The phone's main menu, behind the screen: the screen slides aside, rounded and dimmed. Tap the dimmed screen, swipe it back, or press Android Back to close."
			>
				<View className="h-72 overflow-hidden rounded-2xl border border-border">
					<PushDrawer
						open={drawer}
						onOpenChange={setDrawer}
						closeLabel="Close menu"
						drawer={
							<View className="gap-2 p-4">
								<Text weight="semibold">Menu</Text>
								<Caption>Sections, account, appearance</Caption>
							</View>
						}
					>
						<View className="flex-1 items-start gap-2 p-4">
							<Text weight="medium">A section&apos;s screen</Text>
							<Button size="sm" variant="secondary" onPress={() => setDrawer(true)}>
								<Button.Label>Open the drawer</Button.Label>
							</Button>
						</View>
					</PushDrawer>
				</View>
			</GallerySection>

			<GallerySection title="Tabs" note="Panels of one screen. Secondary variant under a title; primary in a card.">
				<Tabs value={tab} onValueChange={setTab} variant="secondary">
					<Tabs.List>
						<Tabs.Indicator />
						{(["overview", "notes", "contacts"] as const).map((value) => (
							<Tabs.Trigger key={value} value={value}>
								<Tabs.Label className="capitalize">{value}</Tabs.Label>
							</Tabs.Trigger>
						))}
					</Tabs.List>
					<Tabs.Content value="overview">
						<Caption>Overview panel</Caption>
					</Tabs.Content>
					<Tabs.Content value="notes">
						<Caption>Notes panel</Caption>
					</Tabs.Content>
					<Tabs.Content value="contacts">
						<Caption>Contacts panel</Caption>
					</Tabs.Content>
				</Tabs>
			</GallerySection>

			<GallerySection title="Segment" note="Pro. Two to four options; a selection haptic on change.">
				<Segment
					options={[
						{ value: "list", label: "List", icon: "rows" },
						{ value: "board", label: "Board", icon: "kanban" },
					]}
					value={view}
					onValueChange={setView}
					accessibilityLabel="View"
				/>
				<Segment
					options={[
						{ value: "week", label: "Week" },
						{ value: "month", label: "Month" },
						{ value: "year", label: "Year", isDisabled: true },
					]}
					value={range}
					onValueChange={setRange}
					accessibilityLabel="Range"
					size="sm"
				/>
				<Row>
					<Segment
						options={[
							{ value: "light", label: "Light", icon: "sun" },
							{ value: "dark", label: "Dark", icon: "moon" },
							{ value: "system", label: "System", icon: "device-mobile" },
						]}
						value={theme}
						onValueChange={setTheme}
						accessibilityLabel="Theme"
						hideLabel
					/>
					<Caption>icon-only (labels read aloud)</Caption>
				</Row>
				<Segment
					options={[
						{ value: "basics", label: "Basics" },
						{ value: "experience", label: "Experience" },
						{ value: "education", label: "Education" },
						{ value: "skills", label: "Skills" },
					]}
					value={section}
					onValueChange={setSection}
					accessibilityLabel="Section"
					size="lg"
				/>
				<Segment
					options={[
						{ value: "list", label: "List" },
						{ value: "board", label: "Board" },
					]}
					value="list"
					onValueChange={noop}
					accessibilityLabel="Disabled"
					isDisabled
				/>
				<Caption>md with icons · sm with a disabled item · icon-only · lg, four options · disabled</Caption>
			</GallerySection>

			<GallerySection
				title="Stepper"
				note="Pro. Onboarding steps; finished steps go back, steps ahead wait for Continue."
			>
				<Stepper
					steps={onboarding}
					currentStep={step}
					onStepChange={setStep}
					stepLabel={(index, total) => `Step ${index} of ${total}`}
				/>
				<Row>
					<Button size="sm" variant="secondary" isDisabled={step === 0} onPress={() => setStep(step - 1)}>
						Back
					</Button>
					<Button size="sm" isDisabled={step === onboarding.length} onPress={() => setStep(step + 1)}>
						Continue
					</Button>
					<Caption>{`current: ${step}`}</Caption>
				</Row>
				<Stepper steps={onboarding.slice(0, 3)} currentStep={1} orientation="horizontal" />
				<Caption>horizontal, not pressable</Caption>
			</GallerySection>

			<GallerySection title="Fab" note="Pro. The one floating action of a list screen, in accent, above the safe area.">
				<Row>
					<Fab icon="plus" label="New application" onPress={noop} floating={false} />
					<Fab icon="plus" label="New" extended={false} onPress={noop} floating={false} />
					<Fab icon="plus" label="New" isDisabled onPress={noop} floating={false} />
				</Row>
				<Row>
					<Fab
						icon="plus"
						label="New"
						floating={false}
						actions={[
							{ key: "resume", label: "Resume", icon: "file-text", onPress: noop },
							{ key: "letter", label: "Cover letter", icon: "envelope-simple", onPress: noop },
							{ key: "application", label: "Application", icon: "briefcase", onPress: noop },
						]}
					/>
					<Caption>speed dial: opens three actions</Caption>
				</Row>
				<View className="h-40 overflow-hidden rounded-2xl border border-border bg-background">
					<View className="gap-1 p-4">
						<Text weight="medium">A list screen</Text>
						<Caption>Floating at the bottom end, as on a screen (safe area off here).</Caption>
					</View>
					<Fab icon="plus" label="New application" onPress={noop} safeArea={false} />
				</View>
			</GallerySection>
		</View>
	);
}
