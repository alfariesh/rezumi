import { cn } from "heroui-native";

/** Joins and de-duplicates Tailwind classes (tailwind-merge), always returning a string for `className` props. */
export function cx(...classes: Parameters<typeof cn>): string {
	return cn(...classes) ?? "";
}
