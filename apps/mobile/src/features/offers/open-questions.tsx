// What neither offer says yet, as questions to ask before deciding, led by what the user said matters (Preferences),
// with a button that copies the list.
import type { Offer } from "./queries";
import type { OfferTerms } from "@rezumi/schema/career";
import { useLingui } from "@lingui/react/macro";
import * as Clipboard from "expo-clipboard";
import { View } from "react-native";
import { companyOf } from "./cells";
import { Button, Card, Text, Typography, showToast } from "@/ui";

type OpenQuestionsProps = { offers: readonly Offer[]; priorities: string };

export function OpenQuestions({ offers, priorities }: OpenQuestionsProps) {
	const { t } = useLingui();
	const checks: [string, (terms: OfferTerms) => boolean][] = [
		[t`What is the base salary, and is it negotiable?`, (terms) => terms.base === null],
		[t`Is there a bonus, and what does it depend on?`, (terms) => terms.variable === null],
		[
			t`How is the bonus decided, and how much of it was paid out last year?`,
			(terms) => terms.variable !== null && terms.variableConditions.trim() !== "",
		],
		[t`Is equity part of the offer?`, (terms) => !terms.equity.trim()],
		[
			t`What is the equity worth today: strike price, latest valuation, vesting and exercise window?`,
			(terms) => terms.equity.trim() !== "",
		],
		[t`How many days a week are expected in the office?`, (terms) => terms.officeDays === null],
		[t`How many days of leave come with it?`, (terms) => !terms.leave.trim()],
		[t`Is there a learning budget?`, (terms) => terms.learning === null],
		[t`Which other benefits come with it, like pension or allowances?`, (terms) => !terms.other.trim()],
		[t`When do they need your answer?`, (terms) => terms.respondBy === null],
	];
	const questions = checks.flatMap(([question, open]) => {
		const who = offers.filter((offer) => open(offer.data));
		if (who.length === 0) return [];
		const ask = who.length > 1 && who.length === offers.length ? t`Ask both` : t`Ask ${companyOf(who[0] as Offer)}`;
		return [{ question, ask }];
	});
	const wanted = priorities.trim();
	// The first sentence keeps the lead-in short; the full text is in Preferences.
	const said = wanted.length > 160 ? (wanted.split(/(?<=[.!?])\s/)[0] ?? wanted) : wanted;

	const copy = async () => {
		try {
			await Clipboard.setStringAsync(
				questions.map((item, index) => `${index + 1}. ${item.question} · ${item.ask}`).join("\n"),
			);
			showToast({ title: t`Questions copied` });
		} catch {
			showToast({ title: t`Couldn't copy the questions. Try again.`, variant: "danger" });
		}
	};

	return (
		<Card>
			<Card.Body className="gap-3">
				<Typography.Heading type="h6" accessibilityRole="header">
					{t`Not in either offer yet`}
				</Typography.Heading>
				{questions.length === 0 ? (
					<Typography type="body-sm" color="muted">
						{t`Both offers cover everything compared here.`}
					</Typography>
				) : (
					<>
						<Typography type="body-sm" color="muted">
							{said
								? offers.length > 1
									? t`You said: “${said}” Ask both companies before deciding.`
									: t`You said: “${said}” Ask before deciding.`
								: t`Ask before deciding.`}
						</Typography>
						<View className="gap-2.5">
							{questions.map((item, index) => (
								<View key={item.question} className="flex-row gap-2">
									<Text size="sm" tone="muted" tabular className="w-6">{`${index + 1}.`}</Text>
									<Text size="sm" className="flex-1">
										{item.question}
										<Text size="xs" tone="muted">{` · ${item.ask}`}</Text>
									</Text>
								</View>
							))}
						</View>
						<Button variant="secondary" size="sm" className="self-start" onPress={() => void copy()}>
							<Button.Label>{t`Copy questions`}</Button.Label>
						</Button>
					</>
				)}
			</Card.Body>
		</Card>
	);
}
