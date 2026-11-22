// The resume and letter editor shell (plans/mobile Phase 07 step 8). It renders the editor's Stack itself.
//
// - Phone: the top bar (Back, the name that renames in place with the save state, undo/redo, actions, Download, the
//   document menu) is the header of each pane screen, and the mode bar (Write · Page · Design · Check · Share) sits at
//   the foot under pane screens. Pushed screens (an entry, History) have their own stack header and full height.
// - Tablet: one top bar over everything with the mode switch in the middle, the Stack in a 400 pt panel and the page
//   beside it. Opening the Page pane on a tablet switches to the first tablet pane.
// - Keyboard: everything under the top bar ends at the top of the keyboard and the mode bar hides, so a screen can put a
//   toolbar last in its layout without its own keyboard handling.
//
// The Stack keeps one place in the tree in both layouts, so rotating or resizing never resets navigation.
import type { PaneTab } from "./slots";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { Stack, useIsFocused, useNavigation, useRouter, useSegments } from "expo-router";
import { createContext, use, useEffect, useRef, useState } from "react";
import { I18nManager, Platform, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyCommands } from "../key-commands";
import { useIsTablet } from "../use-is-tablet";
import { slot } from "./slots";
import { EditorTopBar } from "./top-bar";
import { routes } from "@/routes";
import { ModeBar, Segment, size, useReducedMotion } from "@/ui";
import { KeyboardFrame, useKeyboardVisible } from "@/ui/keyboard";
import { setToastBarHeight } from "@/ui/toast";

export type BuilderChromeProps<T extends string> = {
	/** The modes, in order. */
	panes: PaneTab<T>[];
	/** Panes in the tablet mode switch. The others are phone-only: on a tablet the page sits beside the panel. */
	tabletPanes: T[];
	/** Tablet: shown beside the 400 pt panel. Without it the panel takes the full width. */
	page?: ReactNode;
	/** The top-bar name until a screen sets `title`. */
	title: string;
	/** What the Download button does unless a screen sets `onExport`. No Download button when neither is set. */
	onExport?: (() => void) | undefined;
	/** Child routes presented as modals (Download & history, the assistant). Every other child route pushes. */
	modals?: string[] | undefined;
	/** Child routes presented full screen without a header (the pages full screen). */
	fullScreenModals?: string[] | undefined;
	/**
	 * Rendered inside the chrome, outside the Stack, so a layout can fill slots once for every pane (`DraftChrome`).
	 */
	children?: ReactNode;
};

type FrameValue = {
	title: string;
	onExport: (() => void) | undefined;
	leave: () => void;
	/** The tablet mode switch. */
	modes: ReactNode;
};

const FrameContext = createContext<FrameValue | null>(null);

export function BuilderChrome<T extends string>(props: BuilderChromeProps<T>) {
	return (
		<slot.Provider>
			<Frame {...props} />
			{props.children}
		</slot.Provider>
	);
}

function Frame<T extends string>({
	panes,
	tabletPanes,
	page,
	title,
	onExport,
	modals = [],
	fullScreenModals = [],
}: BuilderChromeProps<T>) {
	const router = useRouter();
	const { t } = useLingui();
	const tablet = useIsTablet();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardVisible();
	const reduced = useReducedMotion();
	const current = useSegments().at(-1);
	const currentPane = panes.find(({ pane }) => pane === current);
	// The pane under a pushed screen or modal, so the switch and the bar keep showing it.
	const [lastPane, setLastPane] = useState(currentPane?.pane ?? panes[0]?.pane);
	if (currentPane && currentPane.pane !== lastPane) setLastPane(currentPane.pane);
	const activePane = currentPane ?? panes.find(({ pane }) => pane === lastPane);

	// The tablet has no Page pane: the page is always beside the panel.
	const firstTabletPane = panes.find(({ pane }) => tabletPanes.includes(pane));
	const redirect = tablet && currentPane && !tabletPanes.includes(currentPane.pane) ? firstTabletPane : undefined;
	useEffect(() => {
		if (redirect) router.replace(redirect.href);
	}, [redirect, router]);

	// Panes slide in from the side of the mode that was tapped, like a pager; set before each switch.
	const [paneAnimation, setPaneAnimation] = useState<"slide_from_right" | "slide_from_left">("slide_from_right");

	const switchPane = (next: PaneTab<T>) => {
		if (next.pane === currentPane?.pane) return;
		const after = panes.indexOf(next) > panes.findIndex(({ pane }) => pane === activePane?.pane);
		setPaneAnimation(after !== I18nManager.isRTL ? "slide_from_right" : "slide_from_left");
		if (!currentPane && activePane) router.dismissTo(activePane.href);
		router.replace(next.href);
	};

	// Hardware keyboard: ⌘1, ⌘2, … switch to the modes in the order shown.
	const shownPanes = tablet ? panes.filter(({ pane }) => tabletPanes.includes(pane)) : panes;
	useKeyCommands(
		shownPanes.map((pane, index) => ({
			id: `pane-${pane.pane}`,
			input: String(index + 1),
			title: pane.label,
			run: () => switchPane(pane),
		})),
	);

	// On iOS a modal slides over the pane, so its mode bar stays underneath. On Android it fills the screen like a push.
	const underModal = Platform.OS === "ios" && !!current && modals.includes(current);
	const barPane = currentPane ?? (underModal ? activePane : undefined);
	const paneNames = new Set<string>(panes.map(({ pane }) => pane));
	const pick = (value: T) => {
		const next = panes.find(({ pane }) => pane === value);
		if (next) switchPane(next);
	};

	// Run-time values: the side safe areas, and the page's bottom one until the keyboard covers it.
	const frameStyle = { flex: 1, paddingLeft: insets.left, paddingRight: insets.right };
	const pageStyle = { paddingBottom: keyboardVisible ? 0 : insets.bottom };

	const frame: FrameValue = {
		title,
		onExport,
		// Back leaves the editor (the root stack), even with an entry open in the tablet panel.
		leave: () => (navigation.canGoBack() ? navigation.goBack() : router.replace(routes.documents())),
		modes:
			tablet && activePane ? (
				<Segment
					size="sm"
					accessibilityLabel={t`Editor mode`}
					value={activePane.pane}
					options={shownPanes.map(({ pane, label, icon }) => ({ value: pane, label, icon }))}
					onValueChange={pick}
				/>
			) : null,
	};

	return (
		<FrameContext value={frame}>
			<View className="flex-1 bg-background">
				{tablet ? <ChromeTopBar /> : null}
				<KeyboardFrame behavior="padding" automaticOffset style={frameStyle}>
					{/* On a tablet the top bar has cleared the status bar, so headers inside the panel must not pad it again. */}
					<SafeAreaInsetsContext value={{ ...insets, left: 0, right: 0, top: tablet ? 0 : insets.top }}>
						<View className="flex-1 flex-row">
							<View
								className={tablet && page ? "border-e border-separator bg-surface" : "flex-1"}
								style={tablet && page ? { width: size.panel } : undefined}
							>
								<Stack
									screenOptions={({ route }) => {
										if (!paneNames.has(route.name))
											return {
												headerTransparent: false,
												unstable_nativeProps: { headerConfig: { disableTopInsetApplication: tablet } },
											};
										const animation = reduced ? "fade" : paneAnimation;
										return tablet ? { headerShown: false, animation } : { header: () => <ChromeTopBar />, animation };
									}}
								>
									{modals.map((name) => (
										<Stack.Screen
											key={name}
											name={name}
											options={{ presentation: "modal", headerShown: name !== "assistant" }}
										/>
									))}
									{fullScreenModals.map((name) => (
										<Stack.Screen
											key={name}
											name={name}
											options={{ presentation: "fullScreenModal", headerShown: false }}
										/>
									))}
								</Stack>
							</View>
							{tablet && page ? (
								<View className="flex-1" style={pageStyle}>
									{page}
								</View>
							) : null}
						</View>
						{!tablet && barPane && !keyboardVisible ? (
							<PaneBar panes={panes} active={barPane.pane} onPick={pick} label={t`Editor mode`} />
						) : null}
					</SafeAreaInsetsContext>
				</KeyboardFrame>
			</View>
		</FrameContext>
	);
}

/** The top bar from the frame and the slots. Slot changes re-render only this, never the Stack. */
function ChromeTopBar() {
	const frame = use(FrameContext);
	if (!frame) return null;
	return (
		<EditorTopBar
			fallbackTitle={frame.title}
			onBack={frame.leave}
			onExport={frame.onExport}
			center={frame.modes}
			safeTop
		/>
	);
}

type PaneBarProps<T extends string> = {
	panes: PaneTab<T>[];
	active: T;
	onPick: (pane: T) => void;
	label: string;
};

/** The phone mode bar, with the screens' counts. While it shows (the editor in front), toasts sit above it. */
function PaneBar<T extends string>({ panes, active, onPick, label }: PaneBarProps<T>) {
	const slots = slot.useSlot();
	const front = useIsFocused();
	const height = useRef(0);
	useEffect(() => {
		setToastBarHeight("editor", front ? height.current : 0);
		return () => setToastBarHeight("editor", 0);
	}, [front]);

	return (
		<ModeBar
			accessibilityLabel={label}
			value={active}
			onValueChange={onPick}
			items={panes.map(({ pane, label: name, icon }) => ({
				value: pane,
				label: name,
				icon,
				badge: slots.badges?.[pane],
			}))}
			onHeight={(next) => {
				height.current = next;
				if (front) setToastBarHeight("editor", next);
			}}
		/>
	);
}
