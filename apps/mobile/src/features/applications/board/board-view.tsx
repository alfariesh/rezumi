// Applications → All → Board. Phones show one stage per screen and page between stages (swipe, the pager, or holding
// a dragged card at the edge); tablets show every stage side by side. A long press lifts a card to drag it to another
// stage; each card's menu and screen-reader actions do the same without dragging. Closing asks for the reason.
import type { Board } from "./use-board";
import type { ApplicationSummary } from "@/features/applications/types";
import type { ComponentRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import { CloseReasonSheet } from "./close-reason-sheet";
import { useLoadState } from "./load-states";
import { StagePager } from "./stage-pager";
import { useBoard } from "./use-board";
import { useBoardDrag } from "./use-board-drag";
import { ApplicationsFrame, useOpenApplication } from "@/features/applications/frame";
import { useIsTablet } from "@/shell/use-is-tablet";
import { Skeleton, space } from "@/ui";

/** Tablet columns: width and the gap between them; the board's side padding. */
const COLUMN = 280;
const GAP = space[3];
const PAD = space[4];

export function BoardScreen() {
	return (
		<ApplicationsFrame view="board">
			<BoardBody />
		</ApplicationsFrame>
	);
}

export function BoardBody() {
	const { t } = useLingui();
	const board = useBoard();
	const tablet = useIsTablet();
	const state = useLoadState({
		query: board.query,
		skeleton: <BoardSkeleton />,
		emptyDescription: t`Save a job and it shows here in its stage. Move it along as you hear back.`,
	});
	return (
		<>
			{state ?? (tablet ? <TabletBoard board={board} /> : <PhoneBoard board={board} />)}
			<CloseReasonSheet application={board.closing} onPick={board.close} onCancel={board.cancelClose} />
		</>
	);
}

function BoardSkeleton() {
	return (
		<View className="gap-3 p-4">
			<Skeleton variant="none" className="h-10 rounded-xl" />
			<Skeleton variant="none" className="h-24 rounded-2xl" />
			<Skeleton variant="none" className="h-24 rounded-2xl" />
		</View>
	);
}

type LayoutProps = { board: Board };

function PhoneBoard({ board }: LayoutProps) {
	const open = useOpenApplication();
	const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
	const [width, setWidth] = useState(0);
	const [page, setPageState] = useState(0);
	const pageRef = useRef(0);
	const setPage = (next: number, animated = true) => {
		const clamped = Math.min(board.columns.length - 1, Math.max(0, next));
		pageRef.current = clamped;
		setPageState(clamped);
		scroll.current?.scrollTo({ x: clamped * width, animated });
	};
	const { boardRef, onBoardLayout, lifted, handlers, liftedStyle } = useBoardDrag({
		onEdge: (direction) => setPage(pageRef.current + direction),
		onDrop: (application) => {
			const target = board.columns[pageRef.current]?.status;
			if (target) board.moveTo(application, target);
		},
	});
	const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		if (!width) return;
		const next = Math.round(event.nativeEvent.contentOffset.x / width);
		pageRef.current = next;
		setPageState(next);
	};
	const pageStyle = { width };
	return (
		<View className="flex-1 gap-2 pt-2">
			<StagePager columns={board.columns} page={page} onPage={setPage} />
			<View
				ref={boardRef}
				className="flex-1"
				onLayout={(event) => {
					setWidth(event.nativeEvent.layout.width);
					onBoardLayout();
				}}
			>
				<ScrollView
					ref={scroll}
					horizontal
					pagingEnabled
					bounces={false}
					showsHorizontalScrollIndicator={false}
					scrollEnabled={!lifted}
					onMomentumScrollEnd={onScrollEnd}
					testID="board-pages"
				>
					{board.columns.map((column, index) => (
						<View key={column.status} className="px-4 pb-4" style={pageStyle}>
							<BoardColumn
								stage={column.status}
								applications={column.data}
								cardWidth={Math.max(0, width - space[4] * 2 - space[3] * 2)}
								highlighted={!!lifted && index === page && board.stageOf(lifted.application) !== column.status}
								draggingId={lifted?.application.id ?? null}
								handlers={handlers}
								header={false}
								onOpen={(application) => open(application.id)}
								onMove={board.moveTo}
								onRefresh={board.query.refetch}
								className="flex-1"
							/>
						</View>
					))}
				</ScrollView>
				<LiftedCard lifted={lifted} style={liftedStyle} stageOf={board.stageOf} />
			</View>
		</View>
	);
}

function TabletBoard({ board }: LayoutProps) {
	const open = useOpenApplication();
	const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
	const scrollX = useRef(0);
	const { boardRef, onBoardLayout, lifted, handlers, liftedStyle } = useBoardDrag({
		onEdge: (direction) =>
			scroll.current?.scrollTo({ x: Math.max(0, scrollX.current + direction * (COLUMN + GAP)), animated: true }),
		onDrop: (application, absoluteX, boardX) => {
			const index = Math.floor((absoluteX - boardX + scrollX.current - PAD + GAP / 2) / (COLUMN + GAP));
			const target = board.columns[index]?.status;
			if (target) board.moveTo(application, target);
		},
	});
	return (
		<View ref={boardRef} className="flex-1" onLayout={onBoardLayout}>
			<ScrollView
				ref={scroll}
				horizontal
				showsHorizontalScrollIndicator={false}
				scrollEnabled={!lifted}
				scrollEventThrottle={16}
				onScroll={(event) => {
					scrollX.current = event.nativeEvent.contentOffset.x;
				}}
				contentContainerClassName="gap-3 p-4"
			>
				{board.columns.map((column) => (
					<BoardColumn
						key={column.status}
						stage={column.status}
						applications={column.data}
						cardWidth={COLUMN - space[3] * 2}
						highlighted={false}
						draggingId={lifted?.application.id ?? null}
						handlers={handlers}
						header
						onOpen={(application) => open(application.id)}
						onMove={board.moveTo}
						onRefresh={board.query.refetch}
						className="w-70"
					/>
				))}
			</ScrollView>
			<LiftedCard lifted={lifted} style={liftedStyle} stageOf={board.stageOf} />
		</View>
	);
}

type LiftedCardProps = {
	lifted: ReturnType<typeof useBoardDrag>["lifted"];
	style: ReturnType<typeof useBoardDrag>["liftedStyle"];
	stageOf: Board["stageOf"];
};

/** The copy of the dragged card under the finger, above the columns. */
function LiftedCard({ lifted, style, stageOf }: LiftedCardProps) {
	if (!lifted) return null;
	const application: ApplicationSummary = lifted.application;
	return (
		<Animated.View
			pointerEvents="none"
			className="absolute"
			style={[{ left: lifted.left, top: lifted.top, width: lifted.width }, style]}
		>
			<BoardCard
				application={application}
				stage={stageOf(application)}
				onOpen={() => undefined}
				onMove={() => undefined}
				preview
			/>
		</Animated.View>
	);
}
