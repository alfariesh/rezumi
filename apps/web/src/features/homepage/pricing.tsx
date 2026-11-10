import type { Plan } from "./plans";
import type { BillingCurrency } from "@rezumi/schema/billing";
import { Button, buttonVariants, Chip } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { PLANS, toMajorUnits } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { cn } from "@rezumi/utils/style";
import { currencyForLocale, getPlans } from "./plans";
import { Container, SectionHeading, SectionTitle } from "./ui";

type PlanPriceProps = { amount: number; currency: BillingCurrency; featured: boolean };

/** The price, with the currency set small beside the figure: "$ 4.99" in English, "Rp 59.000" in Indonesian. */
function PlanPrice({ amount, currency, featured }: PlanPriceProps) {
	const { i18n } = useLingui();
	const value = toMajorUnits(amount, currency);
	const parts = new Intl.NumberFormat(i18n.locale, {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: currency === "idr" || Number.isInteger(value) ? 0 : 2,
		maximumFractionDigits: currency === "idr" ? 0 : 2,
	}).formatToParts(value);
	const symbol = parts.find((part) => part.type === "currency")?.value ?? currency.toUpperCase();
	const figure = parts
		.filter((part) => part.type !== "currency" && part.type !== "literal")
		.map((part) => part.value)
		.join("");

	return (
		<p className="order-first flex items-start gap-1.5 font-bold">
			<span className={cn("mt-1 text-xl", featured ? "text-accent-foreground/70" : "text-muted")}>{symbol}</span>
			<span className="text-5xl leading-none tracking-tight tabular-nums sm:text-6xl lg:text-5xl xl:text-6xl">
				{figure}
			</span>
		</p>
	);
}

/** A yearly price as words under the monthly one: "or $39 a year". */
function useYearly(amount: number, currency: BillingCurrency) {
	const { i18n } = useLingui();
	const value = toMajorUnits(amount, currency);
	return new Intl.NumberFormat(i18n.locale, {
		style: "currency",
		currency: currency.toUpperCase(),
		minimumFractionDigits: currency === "idr" || Number.isInteger(value) ? 0 : 2,
		maximumFractionDigits: currency === "idr" ? 0 : 2,
	}).format(value);
}

type PlanCardProps = { plan: Plan; billingEnabled: boolean };

function PlanCard({ plan, billingEnabled }: PlanCardProps) {
	const { i18n } = useLingui();
	const featured = plan.featured === true;
	const currency = currencyForLocale(i18n.locale);
	const yearly = useYearly(plan.prices?.year[currency] ?? 0, currency);
	// Rupiah is paid by QRIS: a pass for 30 days or a year, with no free trial (that comes with a card).
	const qris = currency === "idr";
	const period =
		plan.prices === null
			? t`No card needed`
			: qris
				? t`for 30 days, or ${yearly} a year`
				: t`per month, or ${yearly} a year`;
	const trialDays = qris ? null : PLANS[plan.id].trialDays;
	const cta = qris && plan.id === "plus" ? t`Choose Plus` : plan.cta;

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
				<PlanPrice amount={plan.prices?.month[currency] ?? 0} currency={currency} featured={featured} />
				<p className={cn("order-first mt-3 min-h-10 text-sm", featured ? "text-accent-foreground/70" : "text-muted")}>
					{period}
					{trialDays !== null && (
						<span className={cn("block font-medium", featured ? "text-accent-foreground" : "text-success")}>
							{t`First ${trialDays} days free`}
						</span>
					)}
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
						{cta}
					</Link>
				)}
			</div>
		</div>
	);
}

/** 04 Pricing: three plans in one panel, Pro AI raised on the accent. Paid plans are monthly or yearly subscriptions. */
type PricingProps = { billingEnabled?: boolean; portfolioEnabled?: boolean };

export function Pricing({ billingEnabled = false, portfolioEnabled = false }: PricingProps) {
	const plans = getPlans(portfolioEnabled);
	const { i18n } = useLingui();
	const qris = currencyForLocale(i18n.locale) === "idr";

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
					{qris
						? t`Start free. When you need more versions, formats or AI help, pay with QRIS for 30 days or a year at a time. Nothing renews on its own.`
						: t`Start free. When you need more versions, formats or AI help, subscribe monthly or yearly, and cancel any time.`}
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
					{qris
						? t`Prices in Rupiah, paid with QRIS from any bank or e-wallet app. They are final: no tax is added. A plan runs for 30 days or a year and doesn't renew on its own: pay again whenever you like and the time is added after your current plan. Prefer a card that renews by itself? Pay in US dollars by card instead, with 7 free days on a first Plus subscription. When a plan ends, your account returns to Free and your documents stay. Your own AI key works on every plan.`
						: t`Prices in US dollars, or in Rupiah for visitors from Indonesia, before tax: the checkout adds the tax for where you live. A first Plus subscription starts with 7 free days. Subscriptions renew until you cancel, and you keep access until the period you paid for ends. Then your account returns to Free and your documents stay. Your own AI key works on every plan.`}
				</p>
			</div>
		</section>
	);
}
