// A card the person can pick up: a long press starts the drag, a plain tap still opens it. The original stays dimmed
// in its column while its copy follows the finger.
import type { BoardCardProps } from "./board-card";
import type { DragHandlers } from "./use-board-drag";
import { useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { BoardCard } from "./board-card";
import { cx } from "@/ui";

const LONG_PRESS_MS = 400;

type DraggableCardProps = BoardCardProps & { width: number; dragging: boolean; handlers: DragHandlers };

export function DraggableCard({ width, dragging, handlers, ...card }: DraggableCardProps) {
	const { application } = card;
	const { start, end, motion } = handlers;
	const pan = useMemo(() => {
		const liftCard = (point: { absoluteX: number; absoluteY: number; x: number; y: number }) =>
			start(application, point, width);
		return (
			Gesture.Pan()
				.activateAfterLongPress(LONG_PRESS_MS)
				.withTestId(`board-drag-${application.id}`)
				.onStart((event) => {
					motion.x.set(0);
					motion.y.set(0);
					motion.finger.set(event.absoluteX);
					motion.active.set(true);
					scheduleOnRN(liftCard, { absoluteX: event.absoluteX, absoluteY: event.absoluteY, x: event.x, y: event.y });
				})
				.onUpdate((event) => {
					motion.x.set(event.translationX);
					motion.y.set(event.translationY);
					motion.finger.set(event.absoluteX);
				})
				// `success` is true only for a drag that was active and ended normally (not cancelled).
				.onFinalize((event, success) => {
					const wasActive = motion.active.get();
					motion.active.set(false);
					if (wasActive) scheduleOnRN(end, success, event.absoluteX);
				})
		);
	}, [application, width, start, end, motion]);

	return (
		<GestureDetector gesture={pan}>
			<View className={cx(dragging && "opacity-40")}>
				<BoardCard {...card} />
			</View>
		</GestureDetector>
	);
}
