import { buttonVariants } from "@heroui/react";
import { plural, t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@rezumi/ui/components/icon";
import { RollingNumber } from "@/components/ui/rolling-number";
import { orpc } from "@/libs/orpc/client";

export function GithubStarsButton() {
	const { data: starCount } = useQuery(orpc.statistics.github.getStarCount.queryOptions());

	const ariaLabel =
		starCount != null
			? plural(starCount, {
					one: "Star us on GitHub, currently # star (opens in new tab)",
					other: "Star us on GitHub, currently # stars (opens in new tab)",
				})
			: t`Star us on GitHub (opens in new tab)`;

	return (
		<a
			target="_blank"
			href="https://github.com/alfariesh/rezumi"
			aria-label={ariaLabel}
			rel="noopener noreferrer"
			className={buttonVariants({ variant: "secondary" })}
		>
			<Icon name="github-logo" size={16} />
			{starCount != null ? <RollingNumber value={starCount} className="font-bold" /> : null}
			<Icon name="star" size={16} />
		</a>
	);
}
