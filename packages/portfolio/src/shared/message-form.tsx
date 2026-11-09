import { PORTFOLIO_MESSAGE_LIMITS, PORTFOLIO_MESSAGE_TRAP_FIELD } from "@rezumi/schema/portfolio/statistics";
import { fillPortfolioMessage } from "../messages";
import { useRender } from "./context";
import { linkAttributes } from "./primitives";

/**
 * The contact form (`01-desain.md` section 9). On a custom domain, whose hostname can't be on the Turnstile widget, a
 * button opens the form on the app's domain instead. The editor's preview draws it inert. Turnstile needs JavaScript,
 * so without it the form is hidden and a note points to the other ways to get in touch.
 */
export function MessageForm() {
	const { view, messages, live, nextId } = useRender();
	const wiring = live?.form;
	if (wiring?.kind === "link")
		return (
			<div className="pf-btns">
				<a
					className="pf-btn pf-btn--primary"
					data-pf-event="contact"
					{...linkAttributes(wiring.url, { external: true })}
				>
					{messages.sendMessage}
				</a>
			</div>
		);

	const nameId = nextId("pf-message-name");
	const emailId = nextId("pf-message-email");
	const bodyId = nextId("pf-message-body");
	const status =
		wiring?.status === "sent" ? messages.messageSent : wiring?.status === "failed" ? messages.messageFailed : "";

	return (
		<>
			<noscript>
				<style>{".pf-form{display:none}"}</style>
				<p className="pf-form__note">{messages.formNeedsScript}</p>
			</noscript>
			<form
				className="pf-form"
				method="post"
				action={wiring?.action}
				data-pf-contact=""
				data-sending={messages.messageSending}
				data-sent={messages.messageSent}
				data-failed={messages.messageFailed}
				data-invalid={messages.messageInvalid}
				data-turnstile={messages.messageBlocked}
				data-rate_limited={messages.messageLimited}
				data-unavailable={messages.messageClosed}
			>
				<fieldset disabled={!wiring}>
					<label htmlFor={nameId}>
						{messages.yourName}
						<input id={nameId} name="name" autoComplete="name" required maxLength={PORTFOLIO_MESSAGE_LIMITS.name} />
					</label>
					<label htmlFor={emailId}>
						{messages.yourEmail}
						<input
							id={emailId}
							name="email"
							type="email"
							autoComplete="email"
							required
							maxLength={PORTFOLIO_MESSAGE_LIMITS.email}
						/>
					</label>
					<label htmlFor={bodyId}>
						{messages.yourMessage}
						<textarea id={bodyId} name="message" required rows={5} maxLength={PORTFOLIO_MESSAGE_LIMITS.body} />
					</label>
					{/* People never see this field, so only a bot fills it in. */}
					<div className="pf-form__trap" aria-hidden="true">
						<input name={PORTFOLIO_MESSAGE_TRAP_FIELD} tabIndex={-1} autoComplete="off" />
					</div>
					<input type="hidden" name="serviceId" />
					{wiring && <div className="pf-form__turnstile" data-pf-turnstile="" data-sitekey={wiring.siteKey} />}
					<button className="pf-btn pf-btn--primary" type="submit">
						{messages.sendMessageNow}
					</button>
					<p className="pf-form__status" role="status">
						{status}
					</p>
					<p className="pf-form__note">{fillPortfolioMessage(messages.formNote, { name: view.basics.name })}</p>
				</fieldset>
			</form>
		</>
	);
}
