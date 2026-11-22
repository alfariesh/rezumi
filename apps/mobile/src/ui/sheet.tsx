import type { DetentChangeEvent, SheetDetent } from "@lodev09/react-native-true-sheet";
// Sheets: the platform's own bottom sheet (UISheetPresentationController on iOS, the Material bottom sheet on Android)
// through TrueSheet, for a task beside the current screen: a short form, options, a detail. Dialogs and toasts render
// above an open sheet. Phones get a grabber and detents; tablets a centred form sheet.
//
// Controlled like HeroUI's Dialog (`isOpen` / `onOpenChange`), so a screen keeps the sheet's state with the rest of
// its state. TrueSheet itself is imperative and asynchronous; this wrapper owns that lifecycle (a close sent while the
// sheet is still presenting waits for it, a reopen waits for the previous dismissal, a late native callback never
// closes a sheet that was opened again).
import type { ComponentRef, ReactNode } from "react";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { useThemeColor } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { IconButton } from "./button";
import { haptics, useIsWide, useReducedMotion } from "./motion";
import { useWindowSafeAreaInsets } from "./safe-area";
import { Typography } from "./text";
import { size, space } from "./tokens";

/** `rounded-3xl`: the sheet's top corners. TrueSheet draws them natively, so it takes the number. */
const cornerRadius = 24;
/** A content-sized sheet stops at 90% of the screen under the status bar and scrolls past that. */
const maxHeight = 0.9;

export type SheetProps = {
	isOpen: boolean;
	/** Called with `false` when the person closes the sheet (drag, dim tap, Android back, the close button). */
	onOpenChange: (isOpen: boolean) => void;
	/** The heading in the title row; also the name screen readers announce for the sheet. */
	title?: string | undefined;
	/** Shows a close button at the end of the title row, read with this label (translated by the caller). */
	closeLabel?: string | undefined;
	/**
	 * Resting heights, smallest first, up to three: `"auto"` fits the content (default), a number is a fraction of
	 * the screen (`0.5`). Moving between detents plays the selection haptic.
	 */
	detents?: SheetDetent[] | undefined;
	children?: ReactNode;
	/** Pinned under the scrolling content and lifted above the keyboard: the sheet's primary action. */
	footer?: ReactNode;
	/** Scrolls the content (default). A list that scrolls itself passes false and its own `scrollableRef` stays out. */
	scroll?: boolean | undefined;
	/** Pads the content with the 16 pt gutter (default); full-width rows pass false. */
	padded?: boolean | undefined;
	/**
	 * False blocks dismissal by drag, Android back and the close button (a dirty form, a save in flight); the attempt
	 * calls `onDismissAttempt` instead, for example to ask "Discard changes?". Closing through `isOpen` still works.
	 */
	canDismiss?: boolean | undefined;
	onDismissAttempt?: (() => void) | undefined;
	/**
	 * Called once the sheet has finished sliding away, however it closed. Present the next screen or dialog from here:
	 * iOS can drop a presentation started while the sheet is still dismissing.
	 */
	onDidDismiss?: (() => void) | undefined;
	testID?: string | undefined;
};

type SheetHeaderProps = {
	title: string | undefined;
	closeLabel: string | undefined;
	onClose: () => void;
	onHeight: (height: number) => void;
};

function SheetHeader({ title, closeLabel, onClose, onHeight }: SheetHeaderProps) {
	return (
		<View
			onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
			className="min-h-14 flex-row items-center gap-2 ps-4 pe-2 pt-4"
		>
			<View className="flex-1">
				{title ? (
					<Typography.Heading type="h6" numberOfLines={2}>
						{title}
					</Typography.Heading>
				) : null}
			</View>
			{closeLabel ? <IconButton icon="x" label={closeLabel} onPress={onClose} /> : null}
		</View>
	);
}

export function Sheet({
	isOpen,
	onOpenChange,
	title,
	closeLabel,
	detents = ["auto"],
	children,
	footer,
	scroll = true,
	padded = true,
	canDismiss = true,
	onDismissAttempt,
	onDidDismiss: onDismissed,
	testID,
}: SheetProps) {
	const background = useThemeColor("overlay");
	const wide = useIsWide();
	const reduced = useReducedMotion();
	const insets = useWindowSafeAreaInsets();
	const { height } = useWindowDimensions();
	const ref = useRef<TrueSheet>(null);
	const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
	const [footerHeight, setFooterHeight] = useState(0);
	const [headerHeight, setHeaderHeight] = useState(0);
	const detentIndex = useRef(-1);
	const wantsOpen = useRef(false);
	const presented = useRef(false);
	const closing = useRef(false);
	const opening = useRef<Promise<void>>(Promise.resolve());

	const present = useCallback(() => {
		presented.current = true;
		opening.current = (ref.current?.present(0, !reduced) ?? Promise.resolve()).catch(() => {
			presented.current = false;
			onOpenChange(false);
		});
	}, [reduced, onOpenChange]);

	useEffect(() => {
		wantsOpen.current = isOpen;
		if (isOpen) {
			if (!closing.current && !presented.current) present();
		} else if (presented.current && !closing.current) {
			closing.current = true;
			// TrueSheet presents asynchronously; a fast close waits for the native sheet to exist.
			void opening.current
				.then(() => {
					if (wantsOpen.current || !presented.current) {
						closing.current = false;
						return;
					}
					return ref.current?.dismiss(!reduced);
				})
				.catch(() => {
					closing.current = false;
				});
		}
	}, [isOpen, reduced, present]);

	const onDidDismiss = () => {
		presented.current = false;
		detentIndex.current = -1;
		if (closing.current) {
			// A close the parent asked for finished; reopen if it changed its mind meanwhile.
			closing.current = false;
			if (wantsOpen.current) present();
		} else if (wantsOpen.current) {
			onOpenChange(false);
		}
		onDismissed?.();
	};

	const onDetentChange = ({ nativeEvent: { index } }: DetentChangeEvent) => {
		if (detentIndex.current >= 0 && index !== detentIndex.current) haptics.selection();
		detentIndex.current = index;
	};

	const requestClose = () => {
		if (canDismiss) onOpenChange(false);
		else onDismissAttempt?.();
	};

	const hasHeader = !!title || !!closeLabel;
	// The footer pads the home indicator itself; while the keyboard is up that padding tucks behind it.
	const footerView = footer ? (
		<View
			onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
			className="border-t border-separator bg-overlay px-4 pt-3"
			style={{ paddingBottom: insets.bottom + space[3] }}
		>
			{footer}
		</View>
	) : undefined;
	// A scrolling sheet's content is laid out at the sheet's full height, header included, so the header's height is
	// added under it: without it the last lines of a long sheet stay under the screen's edge.
	const headerSpace = hasHeader && scroll ? headerHeight : 0;
	const bottom = (footer ? (scroll ? space[4] : footerHeight + space[4]) : insets.bottom + space[4]) + headerSpace;
	const contentStyle = {
		gap: space[3],
		paddingTop: hasHeader ? space[2] : space[6],
		paddingHorizontal: padded ? space[4] : 0,
		paddingBottom: bottom,
	};

	return (
		<TrueSheet
			ref={ref}
			detents={detents}
			dismissible={canDismiss}
			draggable
			onDidDismiss={onDidDismiss}
			onDismissAttempt={() => onDismissAttempt?.()}
			onDetentChange={onDetentChange}
			presentation={wide ? "form" : "page"}
			maxContentWidth={size.formSheet}
			maxContentHeight={Math.round((height - insets.top) * maxHeight)}
			backgroundColor={background}
			cornerRadius={cornerRadius}
			grabber={!wide}
			accessibilityOptions={title ? { paneTitle: title } : {}}
			insetAdjustment="never"
			{...(scroll ? { scrollableRef: scrollRef, scrollableOptions: { contentInsetAdjustment: "footer" } } : {})}
			{...(hasHeader
				? {
						header: (
							<SheetHeader title={title} closeLabel={closeLabel} onClose={requestClose} onHeight={setHeaderHeight} />
						),
					}
				: {})}
			{...(footerView
				? {
						footer: footerView,
						footerOptions: { position: scroll ? "absolute" : "relative", keyboardOffset: -insets.bottom },
					}
				: {})}
		>
			<GestureHandlerRootView style={styles.root}>
				{scroll ? (
					<ScrollView
						ref={scrollRef}
						testID={testID}
						nestedScrollEnabled
						accessibilityViewIsModal
						onAccessibilityEscape={requestClose}
						keyboardShouldPersistTaps="handled"
						keyboardDismissMode="interactive"
						contentContainerStyle={contentStyle}
					>
						{children}
					</ScrollView>
				) : (
					<View
						testID={testID}
						accessibilityViewIsModal
						onAccessibilityEscape={requestClose}
						style={[styles.root, contentStyle]}
					>
						{children}
					</View>
				)}
			</GestureHandlerRootView>
		</TrueSheet>
	);
}

// Gesture-handler controls (Slider, swipeable rows) need their own root inside a native sheet on Android.
const styles = StyleSheet.create({ root: { flexGrow: 1 } });
