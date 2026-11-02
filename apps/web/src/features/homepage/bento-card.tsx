import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { cn } from "@rezumi/utils/style";

type BentoCardProps = {
	eyebrow: string;
	title: string;
	description: string;
	graphic: ReactNode;
	/** Fades the graphic into the card at its top or bottom edge, where the drawing runs out of the box. */
	fade?: ("top" | "bottom")[];
	className?: string;
};

/**
 * A bento tile: a drawing of the feature on top, then what it is in three lines. The grid rounds only its outer
 * corners, so each tile takes its corner radii from `className`.
 */
export function BentoCard({ eyebrow, title, description, graphic, fade = [], className }: BentoCardProps) {
	return (
		<Card className={cn("group relative gap-0 overflow-hidden rounded-lg p-0", className)}>
			<div aria-hidden="true" className="relative h-72 shrink-0 overflow-hidden select-none">
				{graphic}
				{fade.includes("top") && <div className="absolute inset-0 bg-linear-to-b from-surface to-40%" />}
				{fade.includes("bottom") && <div className="absolute inset-0 bg-linear-to-t from-surface to-40%" />}
			</div>
			<div className="relative p-8 pt-6 sm:p-10 sm:pt-6">
				<h3 className="text-sm font-semibold text-accent">{eyebrow}</h3>
				<p className="mt-1 text-2xl font-medium tracking-tight text-balance">{title}</p>
				<p className="mt-2 max-w-xl text-sm leading-6 text-pretty text-muted">{description}</p>
			</div>
		</Card>
	);
}
