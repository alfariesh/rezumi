// Gallery: chips, tags, avatars, stages, swipeable rows and date fields.
import type { Stage } from "@/ui/stage";
import { Fragment, useState } from "react";
import { View } from "react-native";
import { Caption, GallerySection, Row } from "./section";
import { BarList, ColumnChart, Separator, Text } from "@/ui";
import { Avatar, Chip, DatePicker, SwipeableRow, TagGroup } from "@/ui/data";
import { StageDot, StageLabel } from "@/ui/stage";

const noop = () => undefined;
// A bundled picture, so the gallery loads no remote image.
const avatarPlaceholder = require("../../../assets/avatar-placeholder.webp") as number;

const stages: [Stage, string][] = [
	["saved", "Saved"],
	["applied", "Applied"],
	["screening", "Screening"],
	["interview", "Interview"],
	["offer", "Offer"],
	["closed", "Closed"],
];

const applications = [
	{ id: "1", role: "Product designer", company: "Acme", stage: "interview" as const, label: "Interview" },
	{ id: "2", role: "UX researcher", company: "Globex", stage: "applied" as const, label: "Applied" },
	{ id: "3", role: "Design engineer", company: "Initech", stage: "saved" as const, label: "Saved" },
];

export function DataGallery() {
	const [skills, setSkills] = useState(["Figma", "Prototyping", "User research", "Accessibility"]);
	const [filters, setFilters] = useState<Set<string | number>>(new Set(["remote"]));
	const [rows, setRows] = useState(applications);
	const [deadline, setDeadline] = useState<string | null>(null);
	const [start, setStart] = useState<string | null>("2026-12-01");
	return (
		<View className="gap-8">
			<GallerySection title="Chip" note="Short status or metadata. Soft for status, secondary for neutral tags.">
				<Row>
					<Chip>
						<Chip.Label>Primary</Chip.Label>
					</Chip>
					<Chip variant="secondary">
						<Chip.Label>Secondary</Chip.Label>
					</Chip>
					<Chip variant="tertiary">
						<Chip.Label>Tertiary</Chip.Label>
					</Chip>
					<Chip variant="soft">
						<Chip.Label>Soft</Chip.Label>
					</Chip>
				</Row>
				<Row>
					<Chip variant="soft" color="success" size="sm">
						<Chip.Label>Verified</Chip.Label>
					</Chip>
					<Chip variant="soft" color="warning" size="sm">
						<Chip.Label>Expires soon</Chip.Label>
					</Chip>
					<Chip variant="soft" color="danger" size="sm">
						<Chip.Label>Closed</Chip.Label>
					</Chip>
					<Chip variant="soft" color="default" size="sm">
						<Chip.Label>Draft</Chip.Label>
					</Chip>
					<Chip variant="secondary" size="lg">
						<Chip.Label>Large</Chip.Label>
					</Chip>
				</Row>
			</GallerySection>

			<GallerySection title="TagGroup" note="Removable tags (skills) and filter tags (single or multiple selection).">
				<TagGroup
					onRemove={(keys) => setSkills((current) => current.filter((skill) => !keys.has(skill)))}
					variant="surface"
				>
					<TagGroup.List renderEmptyState={() => <Caption>No skills</Caption>}>
						{skills.map((skill) => (
							<TagGroup.Item key={skill} id={skill}>
								<TagGroup.ItemLabel>{skill}</TagGroup.ItemLabel>
								<TagGroup.ItemRemoveButton aria-label={`Remove ${skill}`} />
							</TagGroup.Item>
						))}
					</TagGroup.List>
				</TagGroup>
				<TagGroup
					selectionMode="multiple"
					selectedKeys={filters}
					onSelectionChange={setFilters}
					disabledKeys={["visa"]}
				>
					<TagGroup.List>
						<TagGroup.Item id="remote">
							<TagGroup.ItemLabel>Remote</TagGroup.ItemLabel>
						</TagGroup.Item>
						<TagGroup.Item id="full-time">
							<TagGroup.ItemLabel>Full time</TagGroup.ItemLabel>
						</TagGroup.Item>
						<TagGroup.Item id="senior">
							<TagGroup.ItemLabel>Senior</TagGroup.ItemLabel>
						</TagGroup.Item>
						<TagGroup.Item id="visa">
							<TagGroup.ItemLabel>Visa sponsor</TagGroup.ItemLabel>
						</TagGroup.Item>
					</TagGroup.List>
				</TagGroup>
				<Caption>{`selected: ${[...filters].join(", ") || "none"} · Visa sponsor disabled`}</Caption>
			</GallerySection>

			<GallerySection title="Avatar" note="Photo with initials as the fallback; alt names the person.">
				<Row>
					<Avatar size="sm" alt="Salma Putri">
						<Avatar.Fallback>SP</Avatar.Fallback>
					</Avatar>
					<Avatar alt="Salma Putri">
						<Avatar.Image source={avatarPlaceholder} />
						<Avatar.Fallback>SP</Avatar.Fallback>
					</Avatar>
					<Avatar size="lg" variant="soft" color="success" alt="Budi Santoso">
						<Avatar.Fallback>BS</Avatar.Fallback>
					</Avatar>
					<Avatar size="lg" color="default" alt="Unknown contact">
						<Avatar.Fallback />
					</Avatar>
				</Row>
			</GallerySection>

			<GallerySection title="Stage" note="The stage color is always beside its name, never alone.">
				<Row>
					{stages.map(([stage, label]) => (
						<StageLabel key={stage} stage={stage} label={label} className="pe-2" />
					))}
				</Row>
				<Row>
					{stages.map(([stage, label]) => (
						<StageLabel key={stage} stage={stage} label={label} size="xs" tone="muted" className="pe-2" />
					))}
				</Row>
				<View className="flex-row items-center gap-2">
					<StageDot stage="offer" />
					<Text weight="medium">Offer</Text>
					<Caption>· StageDot beside a heading that names the stage</Caption>
				</View>
			</GallerySection>

			<GallerySection
				title="SwipeableRow"
				note="Pro. Swipe toward the leading edge for actions; a long swipe performs the first (Delete here)."
			>
				<View className="overflow-hidden rounded-2xl bg-surface">
					{rows.map((row, index) => (
						<Fragment key={row.id}>
							{index > 0 ? <Separator className="ms-4" /> : null}
							<SwipeableRow
								variant="inline"
								openActionsLabel="Show actions"
								closeActionsLabel="Hide actions"
								actions={[
									{
										key: "delete",
										label: "Delete",
										icon: "trash",
										variant: "danger",
										onPress: () => setRows((current) => current.filter((item) => item.id !== row.id)),
									},
									{ key: "archive", label: "Archive", icon: "tray", onPress: noop },
								]}
							>
								<View className="min-h-16 justify-center gap-1 bg-surface px-4 py-3">
									<Text weight="medium">{row.role}</Text>
									<View className="flex-row items-center gap-2">
										<Text size="xs" tone="muted">
											{row.company}
										</Text>
										<StageLabel stage={row.stage} label={row.label} size="xs" tone="muted" />
									</View>
								</View>
							</SwipeableRow>
						</Fragment>
					))}
					{rows.length === 0 ? (
						<View className="p-4">
							<Caption>All rows deleted. Leave and reopen the group to reset.</Caption>
						</View>
					) : null}
				</View>
				<SwipeableRow
					openActionsLabel="Show actions"
					closeActionsLabel="Hide actions"
					fullSwipe={false}
					actions={[{ key: "pin", label: "Favourite", icon: "star", variant: "accent", onPress: noop }]}
				>
					<View className="gap-1 p-4">
						<Text weight="medium">Standalone card</Text>
						<Caption>One accent action, no full swipe</Caption>
					</View>
				</SwipeableRow>
				<SwipeableRow
					openActionsLabel="Show actions"
					closeActionsLabel="Hide actions"
					isDisabled
					actions={[{ key: "delete", label: "Delete", variant: "danger", onPress: noop }]}
				>
					<View className="gap-1 p-4">
						<Text weight="medium">Disabled</Text>
						<Caption>Does not swipe</Caption>
					</View>
				</SwipeableRow>
			</GallerySection>

			<GallerySection
				title="DatePicker"
				note="System picker: Android's date dialog, iOS's inline calendar under the field. Values are YYYY-MM-DD."
			>
				<DatePicker
					label="Deadline"
					value={deadline}
					onChange={setDeadline}
					placeholder="Add a date"
					description="When applications close."
					clearLabel="Clear deadline"
				/>
				<DatePicker
					label="Start date"
					value={start}
					onChange={setStart}
					placeholder="Add a date"
					minimumDate="2026-11-21"
					isRequired
				/>
				<DatePicker
					label="Offer reply by"
					value={null}
					onChange={noop}
					placeholder="Add a date"
					isInvalid
					errorMessage="Pick a date after today."
				/>
				<DatePicker label="Interview" value="2026-12-03" onChange={noop} placeholder="Add a date" isDisabled />
				<View className="rounded-2xl bg-surface p-4">
					<DatePicker
						label="On a white surface"
						value={null}
						onChange={noop}
						placeholder="Add a date"
						variant="secondary"
					/>
				</View>
				<Caption>{`deadline: ${deadline ?? "null"} · start: ${start ?? "null"}`}</Caption>
			</GallerySection>
			<GallerySection
				title="Charts"
				note="ColumnChart (Pro bar-chart, Skia) for a series over time; BarList for categories, stage colors beside names."
			>
				<ColumnChart
					accessibilityLabel="Applications per week: 2, 5, 3, 0, 4"
					data={[
						{ label: "Oct 27", value: 2 },
						{ label: "Nov 3", value: 5 },
						{ label: "Nov 10", value: 3 },
						{ label: "Nov 17", value: 0 },
						{ label: "Nov 24", value: 4 },
					]}
				/>
				<BarList
					items={[
						{ key: "applied", label: "Applied", value: 12, stage: "applied" },
						{ key: "screening", label: "Screening", value: 6, note: "50%", stage: "screening" },
						{ key: "interview", label: "Interview", value: 3, note: "50%", stage: "interview" },
						{ key: "linkedin", label: "LinkedIn", value: 7 },
					]}
				/>
			</GallerySection>
		</View>
	);
}
