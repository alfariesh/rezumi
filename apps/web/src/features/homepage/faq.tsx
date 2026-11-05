import { Accordion } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Link } from "@tanstack/react-router";
import { PLANS, TRIAL_CREDITS } from "@rezumi/schema/billing";
import { Icon } from "@rezumi/ui/components/icon";
import { freeTemplates } from "./plans";
import { Container, SectionHeading, SectionTitle } from "./ui";
import { serializeJsonLd } from "@/libs/seo";

type Question = {
	id: string;
	question: string;
	/** Plain text: it is also the structured data's answer, which has to match what the page shows. */
	answer: string;
	link?: { label: string; to: "/ats-checker" };
};

const getQuestions = (): Question[] => {
	const freeTemplateCount = freeTemplates.length;
	const freeResumes = PLANS.free.limits.activeResumes;
	const freeCoverLetters = PLANS.free.limits.activeCoverLetters;
	const proCredits = PLANS["pro-ai"].creditsPerMonth;
	const trialCredits = TRIAL_CREDITS.amount;
	const trialDays = TRIAL_CREDITS.validDays;
	return [
		{
			id: "free",
			question: t`Is there a free plan?`,
			answer: t`Yes. The free plan covers ${freeResumes} active resumes and ${freeCoverLetters} cover letters, ${freeTemplateCount} templates, PDF downloads without a watermark, the ATS check and the job tracker. No card is needed to sign up.`,
		},
		{
			id: "access",
			question: t`How does a subscription work?`,
			answer: t`Plus and Pro AI are billed monthly or yearly and renew until you cancel. Cancel any time from your plan page; you keep access until the end of the period you paid for, and nothing more is charged. Then your account returns to Free. All your resumes and letters stay editable, shareable and downloadable as PDF. The Free limits only apply when creating another document.`,
		},
		{
			id: "payment",
			question: t`How can I pay?`,
			answer: t`With a debit or credit card, Apple Pay or Google Pay, on a secure checkout by Polar, our merchant of record. Polar handles payment, invoices and sales tax. Visitors from Indonesia pay in Rupiah; everyone else in US dollars.`,
		},
		{
			id: "credits",
			question: t`What is an AI credit?`,
			answer: t`Credits pay for the AI work Rezumi runs for you, with no API key to set up. Each action shows its cost before it starts, and a request that fails gives its credits back. Pro AI includes ${proCredits} credits every month; unused credits don't carry over. The Free plan includes a one-time trial of ${trialCredits} credits, valid for ${trialDays} days.`,
		},
		{
			id: "own-key",
			question: t`Can I use my own AI key?`,
			answer: t`Yes, on every plan. Add a key from OpenAI, Anthropic, Google Gemini, OpenRouter or another provider and you pay that provider directly; it doesn’t use Rezumi credits. Without a key or credits, nothing is sent to an AI service.`,
		},
		{
			id: "ats",
			question: t`Will my resume get past applicant tracking systems?`,
			answer: t`Templates export text-based PDFs. Parsing varies between applicant tracking systems (ATS), so check the exported file for your chosen layout. To test any PDF, including one made elsewhere, the free ATS checker shows the text software extracts and what to fix.`,
			link: { label: t`Try the ATS checker`, to: "/ats-checker" },
		},
		{
			id: "privacy",
			question: t`Who can see my resume?`,
			answer: t`Only you, until you share it. A resume can stay private, go live at a public link, or be protected with a password, and you can change that at any time. Deleting your account deletes your resumes with it.`,
		},
		{
			id: "import",
			question: t`Can I import a resume I already have?`,
			answer: t`Yes. Import a PDF, a LinkedIn data export or a JSON Resume file, then pick up where it left off.`,
		},
		{
			id: "export",
			question: t`What formats can I download?`,
			answer: t`PDF on every plan, along with Markdown and JSON. Word (DOCX) and ODT come with Plus and Pro AI. You can export all of your data at any time, whatever your plan.`,
		},
	];
};

/**
 * 05 FAQ: the answers people look for before they start, one open at a time. The same answers go out as FAQPage
 * structured data, so search engines and assistants can quote them.
 */
export function Faq() {
	const questions = getQuestions();
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: questions.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: { "@type": "Answer", text: item.answer },
		})),
	};

	return (
		<section
			id="faq"
			aria-labelledby="faq-title"
			className="scroll-mt-[calc(var(--landing-nav-height,5rem)+1rem)] py-20 sm:py-28"
		>
			<Container className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
				<div className="lg:sticky lg:top-32 lg:self-start">
					<SectionHeading section="faq" id="faq-title" />
					<SectionTitle className="sm:text-4xl">{t`Asked and answered.`}</SectionTitle>
					<p className="mt-4 text-lg text-pretty text-muted">
						{t`Something else on your mind? Write to us at`}{" "}
						<a href="mailto:hi@rezumi.app" className="font-medium text-accent hover:underline hover:underline-offset-4">
							hi@rezumi.app
						</a>
					</p>
				</div>

				<Accordion variant="surface">
					{questions.map((item) => (
						<Accordion.Item key={item.id} id={item.id}>
							<Accordion.Heading>
								<Accordion.Trigger className="text-start text-base font-medium">
									{item.question}
									<Accordion.Indicator />
								</Accordion.Trigger>
							</Accordion.Heading>
							<Accordion.Panel>
								<Accordion.Body className="text-pretty text-muted">
									<p>{item.answer}</p>
									{item.link && (
										<Link
											to={item.link.to}
											className="mt-3 inline-flex items-center gap-1.5 font-medium text-accent hover:underline hover:underline-offset-4"
										>
											{item.link.label}
											<Icon name="arrow-right" size={16} />
										</Link>
									)}
								</Accordion.Body>
							</Accordion.Panel>
						</Accordion.Item>
					))}
				</Accordion>
			</Container>

			{/* oxlint-disable-next-line react/no-danger -- structured data, serialized so no answer can close the script. */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
		</section>
	);
}
