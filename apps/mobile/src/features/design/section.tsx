import type { IconName } from "@/ui";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Card, Icon, Text } from "@/ui";

type DesignSectionProps = { icon: IconName; title: string; children: ReactNode };

/** One Design group: its icon and name over a card, like the web panel's sections. */
export function DesignSection({ icon, title, children }: DesignSectionProps) {
	return (
		<View className="gap-2">
			<View className="flex-row items-center gap-2 px-1" accessibilityRole="header" accessible>
				<Icon name={icon} size={16} tone="muted" />
				<Text size="xs" weight="semibold" tone="muted">
					{title}
				</Text>
			</View>
			<Card>
				<Card.Body className="gap-4">{children}</Card.Body>
			</Card>
		</View>
	);
}

type FieldLabelProps = { label: string; value?: string | undefined; note?: string | undefined };

/** A control's label with its current value (or a short note) at the end, over the control. */
export function FieldLabel({ label, value, note }: FieldLabelProps) {
	return (
		<View className="flex-row items-baseline justify-between gap-2">
			<Text weight="medium">{label}</Text>
			{value ? (
				<Text mono tabular tone="muted">
					{value}
				</Text>
			) : note ? (
				<Text size="xs" tone="muted" numberOfLines={1} className="shrink">
					{note}
				</Text>
			) : null}
		</View>
	);
}
