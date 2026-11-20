import { useState } from "react";
import { cn } from "@rezumi/utils/style";

type CompanyMarkProps = {
	company: string;
	/** The logo the browser extension copied into Rezumi's storage, if any. */
	logoUrl?: string | null | undefined;
	/** Size, corner and text classes (the box is a square grid). */
	className?: string;
};

/**
 * A company's logo when the browser extension saved one, else its initial; a logo that fails to load falls back to the
 * initial too. Decorative: the company's name is always written next to it.
 */
export function CompanyMark({ company, logoUrl, className }: CompanyMarkProps) {
	const [failed, setFailed] = useState<string | null>(null);
	const showLogo = Boolean(logoUrl) && failed !== logoUrl;

	return (
		<span
			aria-hidden="true"
			className={cn(
				"grid shrink-0 place-items-center overflow-hidden font-semibold text-muted",
				showLogo ? "bg-white" : "bg-control",
				className,
			)}
		>
			{showLogo && logoUrl ? (
				<img
					src={logoUrl}
					alt=""
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
					className="size-full object-contain p-0.5"
					onError={() => setFailed(logoUrl)}
				/>
			) : (
				company.slice(0, 1).toUpperCase()
			)}
		</span>
	);
}
