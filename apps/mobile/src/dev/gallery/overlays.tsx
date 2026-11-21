// Gallery: layers above a screen (src/ui/overlays.tsx, sheet.tsx, toast.tsx): dialogs, menus, popovers, sheets and
// toasts, each with the states a screen uses.
import type { MenuKey } from "@/ui/overlays";
import { useState } from "react";
import { View } from "react-native";
import { Caption, GallerySection, Row } from "./section";
import { Button, Description, Input, Label, ListRow, ListSection, Text, TextField } from "@/ui";
import { ConfirmDialog, Dialog, Menu, Popover } from "@/ui/overlays";
import { Sheet } from "@/ui/sheet";
import { showToast, useAppToast } from "@/ui/toast";

const noop = () => undefined;

function FormDialog() {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Trigger asChild>
				<Button variant="secondary">Rename</Button>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay />
				<Dialog.Content>
					<Dialog.Close accessibilityLabel="Close" />
					<View className="mb-5 gap-1.5">
						<Dialog.Title>Rename resume</Dialog.Title>
						<Dialog.Description>Only you see this name.</Dialog.Description>
					</View>
					<TextField>
						<Label>Name</Label>
						<Input variant="secondary" defaultValue="Product designer" />
					</TextField>
					<View className="mt-5 gap-2">
						<Button onPress={() => setIsOpen(false)}>Save</Button>
						<Button variant="tertiary" onPress={() => setIsOpen(false)}>
							Cancel
						</Button>
					</View>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog>
	);
}

function Confirms() {
	const toast = useAppToast();
	const [destructive, setDestructive] = useState(false);
	const [plain, setPlain] = useState(false);
	return (
		<>
			<Row>
				<Button variant="danger-soft" onPress={() => setDestructive(true)}>
					Delete forever
				</Button>
				<Button variant="secondary" onPress={() => setPlain(true)}>
					Sign out everywhere
				</Button>
			</Row>
			<ConfirmDialog
				isOpen={destructive}
				onOpenChange={setDestructive}
				title="Delete “Product designer” forever?"
				message="The resume and its 3 versions are gone for good. Shared links stop working."
				confirmLabel="Delete forever"
				cancelLabel="Keep resume"
				destructive
				onConfirm={() => toast.show({ title: "Resume deleted", variant: "success" })}
			/>
			<ConfirmDialog
				isOpen={plain}
				onOpenChange={setPlain}
				title="Sign out on every device?"
				message="You stay signed in here. Other phones and browsers ask you to sign in again."
				confirmLabel="Sign out everywhere"
				cancelLabel="Stay signed in"
				onConfirm={noop}
			/>
		</>
	);
}

function Menus() {
	const [sort, setSort] = useState<Set<MenuKey>>(() => new Set(["updated"]));
	return (
		<Row>
			<Menu>
				<Menu.Trigger asChild>
					<Button variant="secondary">Actions</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={240}>
						<Menu.Item onPress={noop}>
							<Menu.ItemTitle>Duplicate</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item onPress={noop}>
							<Menu.ItemTitle>Share link</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item isDisabled>
							<Menu.ItemTitle>Export DOCX (Pro)</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item variant="danger" onPress={noop}>
							<Menu.ItemTitle>Move to trash</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
			<Menu>
				<Menu.Trigger asChild>
					<Button variant="secondary">Sort</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="popover" width={220}>
						<Menu.Label>Sort by</Menu.Label>
						<Menu.Group selectionMode="single" selectedKeys={sort} onSelectionChange={setSort}>
							<Menu.Item id="updated">
								<Menu.ItemIndicator />
								<Menu.ItemTitle>Last edited</Menu.ItemTitle>
							</Menu.Item>
							<Menu.Item id="created">
								<Menu.ItemIndicator />
								<Menu.ItemTitle>Created</Menu.ItemTitle>
							</Menu.Item>
							<Menu.Item id="name">
								<Menu.ItemIndicator />
								<Menu.ItemTitle>Name</Menu.ItemTitle>
							</Menu.Item>
						</Menu.Group>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
			<Menu presentation="bottom-sheet">
				<Menu.Trigger asChild>
					<Button variant="secondary">As a sheet</Button>
				</Menu.Trigger>
				<Menu.Portal>
					<Menu.Overlay />
					<Menu.Content presentation="bottom-sheet">
						<Menu.Item onPress={noop}>
							<Menu.ItemTitle>Duplicate</Menu.ItemTitle>
						</Menu.Item>
						<Menu.Item variant="danger" onPress={noop}>
							<Menu.ItemTitle>Move to trash</Menu.ItemTitle>
						</Menu.Item>
					</Menu.Content>
				</Menu.Portal>
			</Menu>
		</Row>
	);
}

function Popovers() {
	return (
		<Popover>
			<Popover.Trigger asChild>
				<Button variant="ghost">What is an ATS score?</Button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Overlay />
				<Popover.Content presentation="popover" width={300} className="gap-1">
					<Popover.Close accessibilityLabel="Close" />
					<Popover.Title>ATS score</Popover.Title>
					<Popover.Description>
						How well a hiring system can read this resume: headings, dates and keywords it recognizes.
					</Popover.Description>
				</Popover.Content>
			</Popover.Portal>
		</Popover>
	);
}

function Sheets() {
	const [options, setOptions] = useState(false);
	const [editor, setEditor] = useState(false);
	const [tall, setTall] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [discard, setDiscard] = useState(false);
	const closeEditor = () => {
		setEditor(false);
		setDirty(false);
	};
	return (
		<>
			<Row>
				<Button variant="secondary" onPress={() => setOptions(true)}>
					Options sheet
				</Button>
				<Button variant="secondary" onPress={() => setEditor(true)}>
					Form sheet
				</Button>
				<Button variant="secondary" onPress={() => setTall(true)}>
					Two detents
				</Button>
			</Row>

			<Sheet isOpen={options} onOpenChange={setOptions} title="Resume" closeLabel="Close">
				<ListSection>
					<ListRow icon="copy" title="Duplicate" onPress={() => setOptions(false)} chevron={false} />
					<ListRow icon="share-network" title="Share link" onPress={() => setOptions(false)} chevron={false} />
					<ListRow icon="trash" title="Move to trash" tone="danger" onPress={() => setOptions(false)} />
				</ListSection>
			</Sheet>

			<Sheet
				isOpen={editor}
				onOpenChange={(open) => (open ? setEditor(true) : closeEditor())}
				title="Edit experience"
				closeLabel="Close"
				detents={[0.9]}
				canDismiss={!dirty}
				onDismissAttempt={() => setDiscard(true)}
				footer={
					<Button onPress={closeEditor} isDisabled={!dirty}>
						Save
					</Button>
				}
			>
				<TextField>
					<Label>Role</Label>
					<Input variant="secondary" defaultValue="Product designer" onChangeText={() => setDirty(true)} />
				</TextField>
				<TextField>
					<Label>Company</Label>
					<Input variant="secondary" defaultValue="Northwind" onChangeText={() => setDirty(true)} />
					<Description>Type anything, then drag down: the sheet asks before discarding.</Description>
				</TextField>
			</Sheet>
			<ConfirmDialog
				isOpen={discard}
				onOpenChange={setDiscard}
				title="Discard changes?"
				message="Your edits to this experience are not saved."
				confirmLabel="Discard changes"
				cancelLabel="Keep editing"
				destructive
				onConfirm={closeEditor}
			/>

			<Sheet isOpen={tall} onOpenChange={setTall} title="Templates" closeLabel="Close" detents={[0.5, 1]}>
				{Array.from({ length: 16 }, (_, index) => (
					<View key={index} className="h-16 justify-center rounded-2xl bg-surface-secondary px-4">
						<Text>{`Template ${index + 1}`}</Text>
					</View>
				))}
			</Sheet>
		</>
	);
}

function Toasts() {
	const toast = useAppToast();
	return (
		<>
			<Row>
				<Button
					variant="secondary"
					onPress={() =>
						toast.show({
							title: "Moved to trash",
							undo: { label: "Undo", onUndo: () => toast.show({ title: "Restored" }) },
						})
					}
				>
					With Undo
				</Button>
				<Button variant="secondary" onPress={() => toast.show({ title: "Saved", variant: "success" })}>
					Success
				</Button>
				<Button
					variant="secondary"
					onPress={() =>
						toast.show({
							title: "Couldn't save",
							description: "Check your connection and try again.",
							variant: "danger",
						})
					}
				>
					Danger
				</Button>
				<Button
					variant="secondary"
					onPress={() =>
						toast.show({ title: "You're offline", description: "Changes save when you reconnect.", variant: "warning" })
					}
				>
					Warning
				</Button>
				<Button variant="secondary" onPress={() => showToast({ title: "Shown with showToast()" })}>
					Imperative
				</Button>
			</Row>
			<Caption>
				Success plays the success haptic, danger the error one. Imperative needs ToastBridge at the root.
			</Caption>
		</>
	);
}

export function OverlaysGallery() {
	return (
		<View className="gap-8">
			<GallerySection title="Dialog" note="A form or a decision, sized to its content.">
				<Row>
					<FormDialog />
				</Row>
			</GallerySection>

			<GallerySection
				title="ConfirmDialog"
				note="Only for what cannot be undone. Names what cancel keeps; destructive confirms play the warning haptic."
			>
				<Confirms />
			</GallerySection>

			<GallerySection title="Menu" note="Light choices from a trigger. Danger items last.">
				<Menus />
			</GallerySection>

			<GallerySection title="Popover" note="A short explanation or a few controls next to their trigger.">
				<Row>
					<Popovers />
				</Row>
			</GallerySection>

			<GallerySection
				title="Sheet"
				note="A task beside the screen. Title row with close, scrolling body, footer for the primary action."
			>
				<Sheets />
			</GallerySection>

			<GallerySection title="Toast" note="Bottom, one at a time, six seconds. Undo instead of asking first.">
				<Toasts />
			</GallerySection>
		</View>
	);
}
