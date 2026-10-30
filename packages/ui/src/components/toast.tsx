import type { ReactNode } from "react";
import { Spinner, Toast, toast as heroToast } from "@heroui/react";

/*
 * Toasts render with HeroUI's Toast region and queue. HeroUI's toast() has no id, so this keeps the app's
 * `toast.add({ … id })` / `toast.close(id)` calls: a toast added with the id of one still on screen updates it in
 * place (a loading toast becoming its result, a repeated "auto-save" notice), and `close` takes that id.
 */

type ToastType = "error" | "success" | "info" | "warning" | "loading";

type ToastActionProps = {
	children: ReactNode;
	onClick?: (() => void) | undefined;
	onPress?: (() => void) | undefined;
};

type ToastOptions = {
	title?: ReactNode;
	description?: ReactNode;
	type?: ToastType | undefined;
	/** Milliseconds before it dismisses itself; 0 keeps it until closed. Loading toasts stay until replaced. */
	timeout?: number | undefined;
	/** Usually Undo. */
	actionProps?: ToastActionProps | undefined;
	onClose?: (() => void) | undefined;
	/** Replaces the toast on screen with the same id instead of adding another. */
	id?: string | undefined;
};

const DEFAULT_TIMEOUT = 6000;

const VARIANTS = {
	error: "danger",
	success: "success",
	info: "accent",
	warning: "warning",
	loading: "default",
} as const;

/** App ids → HeroUI queue keys, for toasts still on screen. */
const live = new Map<string, string>();

function add({ title, description, type, timeout, actionProps, onClose, id }: ToastOptions): string {
	const isLoading = type === "loading";
	const message = title ?? description;
	const action = actionProps?.onPress ?? actionProps?.onClick;
	const existing = id ? live.get(id) : undefined;
	let key = existing;
	const options = {
		...(title ? { description } : {}),
		variant: type ? VARIANTS[type] : ("default" as const),
		isLoading,
		timeout: timeout ?? (isLoading ? 0 : DEFAULT_TIMEOUT),
		...(actionProps ? { actionProps: { children: actionProps.children, ...(action ? { onPress: action } : {}) } } : {}),
		onClose: () => {
			if (id && live.get(id) === key) live.delete(id);
			onClose?.();
		},
	};

	if (existing && heroToast.update(existing, message, options)) return id ?? existing;

	// One toast at a time: a new one replaces whatever is showing.
	heroToast.clear();
	key = heroToast(message, options);
	if (id) live.set(id, key);
	return id ?? key;
}

function close(id: string) {
	heroToast.close(live.get(id) ?? id);
	live.delete(id);
}

const toast = { add, close };

type ToasterProps = {
	/** Accessible name of each toast's close button; pass a translated string. */
	closeLabel?: string;
	children?: ReactNode;
};

/** The toast region: one toast at a time, bottom center. Mount it once at the root. */
function Toaster({ closeLabel = "Close notification", children }: ToasterProps) {
	return (
		<>
			{children}
			<Toast.Provider placement="bottom" maxVisibleToasts={1}>
				{({ toast: item }) => {
					const { title, description, variant, isLoading, actionProps } = item.content ?? {};
					return (
						<Toast toast={item} variant={variant} placement="bottom">
							{isLoading ? (
								<Toast.Indicator variant={variant}>
									<Spinner size="sm" color="current" />
								</Toast.Indicator>
							) : (
								<Toast.Indicator variant={variant} />
							)}
							<Toast.Content>
								{!!title && <Toast.Title>{title}</Toast.Title>}
								{!!description && <Toast.Description>{description}</Toast.Description>}
							</Toast.Content>
							{actionProps?.children ? <Toast.ActionButton {...actionProps} /> : null}
							<Toast.CloseButton aria-label={closeLabel} />
						</Toast>
					);
				}}
			</Toast.Provider>
		</>
	);
}

export { Toaster, toast, type ToastOptions };
