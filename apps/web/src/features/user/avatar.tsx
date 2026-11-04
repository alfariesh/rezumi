import { Avatar } from "@heroui/react";
import { getInitials } from "@rezumi/utils/string";
import { cn } from "@rezumi/utils/style";

type UserAvatarProps = {
	name: string;
	/** The uploaded photo; without one the placeholder image shows with the person's initials in white. */
	image?: string | null | undefined;
	size?: "sm" | "md" | "lg" | undefined;
	className?: string | undefined;
	/** Sizes the initials; they are white on the placeholder in every theme. */
	fallbackClassName?: string | undefined;
};

/** A person's avatar: their photo, or the avatar placeholder with white initials. */
export function UserAvatar(props: UserAvatarProps) {
	const { name, image, size, className, fallbackClassName } = props;

	return (
		<Avatar {...(size ? { size } : {})} className={className}>
			{image && <Avatar.Image src={image} alt="" />}
			<Avatar.Fallback
				className={cn("bg-[url(/gradients/blue.webp)] bg-cover bg-center font-semibold text-white", fallbackClassName)}
			>
				{getInitials(name)}
			</Avatar.Fallback>
		</Avatar>
	);
}
