import type { Plan } from "./plans";
import { Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { getPlans, planCurrency } from "./plans";
import { Container, SectionHeading, SectionTitle } from "./ui";

type PlanPriceProps = { price: number; featured: boolean };

/** The price, with the currency set small beside the figure: "Rp 79.000" in Indonesian, "IDR 79,000" in English. */
function PlanPrice({ price, featured }: PlanPriceProps) {
	const { i18n } = useLingui();
	const parts = new Intl.NumberFormat(i18n.locale, {
		style: "currency",
		currency: planCurrency,
		maximumFractionDigits: 0,
	}).formatToParts(price);
	const currency = parts.find((part) => part.type === "currency")?.value ?? planCurrency;
	const amount = parts
		.filter((part) => part.type !== "currency" && part.type !== "literal")
		.map((part) => part.value)
		.join("");

	return (
		<p className="order-first flex items-start gap-1.5 font-bold">
			<span className={cn("mt-1 text-xl", featured ? "text-accent-foreground/70" : "text-muted")}>{currency}</span>
			<span className="text-5xl leading-none tracking-tight tabular-nums sm:text-6xl lg:text-5xl xl:text-6xl">
				{amount}
			</span>
		</p>
	);
}

type PlanCardProps = { plan: Plan; billingEnabled: boolean };

function PlanCard({ plan, billingEnabled }: PlanCardProps) {
	const featured = plan.featured === true;
	const period = plan.price === 0 ? t`No card needed` : t`For 30 days, no automatic renewal`;

	return (
		<div
			className={cn(
				"relative flex flex-col px-6 py-12 sm:rounded-[2rem] sm:px-8 lg:py-10",
				featured && "bg-accent text-accent-foreground sm:shadow-overlay",
			)}
		>
			<div className="relative flex flex-1 flex-col">
				<h3 className="mt-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
					{plan.name}
					{featured && (
						<Chip size="sm" className="bg-accent-foreground/15 text-accent-foreground">
							{t`Recommended`}
						</Chip>
					)}
				</h3>
				<p className={cn("mt-2 min-h-12 text-base text-pretty", featured ? "text-accent-foreground/80" : "text-muted")}>
					{plan.description}
				</p>
				<PlanPrice price={plan.price} featured={featured} />
				<p className={cn("order-first mt-3 min-h-10 text-sm", featured ? "text-accent-foreground/70" : "text-muted")}>
					{period}
				</p>
				<ul
					className={cn(
						"mt-8 flex flex-1 flex-col divide-y text-base",
						featured ? "divide-accent-foreground/15" : "divide-separator",
					)}
				>
					{plan.features.map((feature) => (
						<li key={feature} className="flex gap-3 py-2.5">
							<Icon
								name="check"
								size={20}
								className={cn("mt-0.5 shrink-0", featured ? "text-accent-foreground" : "text-muted")}
							/>
							<span>{feature}</span>
						</li>
					))}
				</ul>
				{plan.id !== "free" && !billingEnabled ? (
					<Button isDisabled fullWidth variant={featured ? "secondary" : "primary"} className="mt-8">
						{t`Coming soon`}
					</Button>
				) : (
					<Link
						to="/auth/register"
						// A paid plan goes on to the Plan page with it marked; signed-in visitors skip straight there.
						search={plan.id === "free" ? {} : { callbackURL: `/dashboard/settings/billing?plan=${plan.id}` }}
						className={cn(buttonVariants({ variant: featured ? "secondary" : "primary", fullWidth: true }), "mt-8")}
					>
						{plan.cta}
					</Link>
				)}
			</div>
		</div>
	);
}

/** 04 Pricing: three plans in one panel, Pro AI raised on the accent. Every price is a 30-day pass in Rupiah. */
type PricingProps = { billingEnabled?: boolean };

export function Pricing({ billingEnabled = false }: PricingProps) {
	const plans = getPlans();

	return (
		<section
			id="pricing"
			aria-labelledby="pricing-title"
			className="scroll-mt-[calc(var(--landing-nav-height,5rem)+1rem)] py-20 sm:py-28"
		>
			<Container>
				<SectionHeading section="pricing" id="pricing-title" />
				<SectionTitle>{t`Pay only while you are applying.`}</SectionTitle>
				<p className="mt-4 max-w-2xl text-lg text-pretty text-muted">
					{t`Start free. When you need more versions, formats or AI help, buy 30 days of access. Nothing renews on its own.`}
				</p>
				{!billingEnabled && (
					<p className="mt-3 text-sm text-muted">{t`Plus, Pro AI and trial credits are coming soon. Paid plan limits are not active yet.`}</p>
				)}
			</Container>

			<div className="mx-auto mt-16 max-w-6xl lg:px-8">
				<div className="grid bg-surface-secondary sm:p-6 md:rounded-[3rem] lg:grid-cols-3 lg:gap-4 lg:p-10">
					{plans.map((plan) => (
						<PlanCard key={plan.id} plan={plan} billingEnabled={billingEnabled} />
					))}
				</div>
				<p className="mx-auto mt-6 max-w-3xl px-4 text-center text-sm text-pretty text-muted">
					{t`Prices in Indonesian Rupiah. Access starts once payment is confirmed and lasts 30 days. When it ends, your account returns to Free and your documents stay. Your own AI key works on every plan.`}
				</p>
			</div>
		</section>
	);
}
