import { Description, ErrorMessage, Label } from "@heroui/react";
import * as React from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";

/*
 * Wires a TanStack Form field to its label, description and error for any control: a HeroUI Input or TextArea, a
 * Switch, a Slider, a picker. HeroUI's own TextField does this only for text fields, so this keeps one pattern for
 * every control while the visuals come from HeroUI's Label, Description and ErrorMessage.
 */

type FormItemContextValue = {
	id: string;
	hasError: boolean;
};

const FormItemContext = React.createContext<FormItemContextValue>({ id: "", hasError: false });

function useFormItem() {
	return React.use(FormItemContext);
}

type FormControlContextValue = {
	id?: string;
	labelId?: string;
	hasError?: boolean;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false";
};

const FormControlContext = React.createContext<FormControlContextValue | null>(null);

function useFormControl(): FormControlContextValue {
	return React.use(FormControlContext) ?? {};
}

type FormItemProps = React.ComponentProps<"div"> & { hasError?: boolean };

function FormItem({ className, hasError = false, ...props }: FormItemProps) {
	const id = React.useId();
	const contextValue = React.useMemo<FormItemContextValue>(() => ({ id, hasError }), [hasError, id]);

	return (
		<FormItemContext.Provider value={contextValue}>
			<div data-slot="form-item" className={cn("grid gap-1.5", className)} {...props} />
		</FormItemContext.Provider>
	);
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
	const { id, hasError } = useFormItem();

	return (
		<Label
			id={`${id}-form-item-label`}
			data-slot="form-label"
			isInvalid={hasError}
			className={className}
			htmlFor={`${id}-form-item`}
			{...props}
		/>
	);
}

const LABELABLE_TAGS = new Set(["button", "input", "meter", "output", "progress", "select", "textarea"]);
const LABELABLE_ROLES = new Set([
	"button",
	"combobox",
	"gridcell",
	"listbox",
	"option",
	"progressbar",
	"radio",
	"searchbox",
	"slider",
	"spinbutton",
	"switch",
	"tab",
	"textbox",
	"treeitem",
]);

function isLabelableElement(element: Element) {
	if (LABELABLE_TAGS.has(element.tagName.toLowerCase())) return true;
	if (element.getAttribute("contenteditable") === "true") return true;
	const role = element.getAttribute("role");
	if (role && LABELABLE_ROLES.has(role)) return true;
	return false;
}

function useFormControlWarning(controlId: string) {
	React.useEffect(() => {
		if (process.env.NODE_ENV === "production") return;
		if (typeof document === "undefined") return;

		const element = document.getElementById(controlId);
		if (!element) {
			console.warn(
				`FormControl: no element in the document has the generated id "${controlId}". The <FormLabel for="${controlId}"> target is dangling.`,
			);
			return;
		}

		if (!isLabelableElement(element)) {
			console.warn(
				`FormControl: the element that carries the generated id "${controlId}" is not a labelable element. A <label for="${controlId}"> will not name the control.`,
			);
		}
	}, [controlId]);
}

type FormControlProps = Omit<React.ComponentProps<"div">, "children"> & {
	/**
	 * The control. It receives the field's `id`, `aria-describedby` and `aria-invalid`; a function gets them as props.
	 * Inside a HeroUI InputGroup, wrap the `InputGroup.Input`, not the group.
	 */
	render: React.ReactElement<Record<string, unknown>> | ((props: Record<string, unknown>) => React.ReactElement);
};

function FormControl({ render, ...props }: FormControlProps) {
	const { id, hasError } = useFormItem();
	const controlId = `${id}-form-item`;
	const labelId = `${id}-form-item-label`;
	const describedBy = hasError ? `${id}-form-item-description ${id}-form-item-message` : `${id}-form-item-description`;

	const contextValue = React.useMemo<FormControlContextValue>(
		() => ({
			id: controlId,
			labelId,
			hasError,
			"aria-describedby": describedBy,
			"aria-invalid": hasError,
		}),
		[controlId, describedBy, hasError, labelId],
	);

	useFormControlWarning(controlId);

	const controlProps: Record<string, unknown> = {
		id: controlId,
		"data-slot": "form-control",
		"aria-describedby": describedBy,
		"aria-invalid": hasError,
		...props,
	};
	const element =
		typeof render === "function"
			? render(controlProps)
			: React.cloneElement(render, { ...controlProps, ...render.props });

	return <FormControlContext.Provider value={contextValue}>{element}</FormControlContext.Provider>;
}

function FormDescription({ className, ...props }: React.ComponentProps<typeof Description>) {
	const { id } = useFormItem();

	return (
		<Description data-slot="form-description" id={`${id}-form-item-description`} className={className} {...props} />
	);
}

type FormMessageProps = Omit<React.ComponentProps<typeof ErrorMessage>, "children"> & {
	errors?: ReadonlyArray<unknown>;
};

function extractErrorMessage(errors: ReadonlyArray<unknown> | undefined): string | undefined {
	if (!errors || errors.length === 0) return undefined;

	for (const err of errors) {
		if (!err) continue;
		if (typeof err === "string") return err;
		if (typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
			return (err as { message: string }).message;
		}
	}

	return undefined;
}

function FormMessage({ className, errors, ...props }: FormMessageProps) {
	const { id, hasError } = useFormItem();
	const body = extractErrorMessage(errors);

	if (!body) return null;

	if (!hasError) {
		return (
			<Description id={`${id}-form-item-message`} data-slot="form-message" className={className}>
				{body}
			</Description>
		);
	}

	return (
		<ErrorMessage
			id={`${id}-form-item-message`}
			data-slot="form-message"
			className={cn("flex items-start gap-1", className)}
			{...props}
		>
			<Icon name="warning-circle" size={16} className="shrink-0" />
			<span>{body}</span>
		</ErrorMessage>
	);
}

export { FormControl, FormControlContext, FormDescription, FormItem, FormLabel, FormMessage, useFormControl };
