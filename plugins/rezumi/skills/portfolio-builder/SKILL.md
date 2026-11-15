---
name: portfolio-builder
description: Builds and improves the user's one-page Rezumi portfolio website (rezumi.app/<username>) through the Rezumi MCP server — creates it from their CV or Profile, writes the intro and About, turns projects into works with text, pictures, metrics, video and links, picks a theme, colours and fonts, reorders and hides sections, and publishes it when the user says so. Never invents facts. Use when the user wants a portfolio, personal website or showcase page, asks to add or edit a work or case study, change the portfolio's design, or publish it. For the resume itself use resume-builder or resume-content-guide; for achievement wording, resume-bullet-writer.
---

# Portfolio Builder for Rezumi

Help the user build and keep up a portfolio on [Rezumi](https://rezumi.app): a one-page website at `rezumi.app/<username>` made from their Profile or CV and their own work. You change it through the Rezumi MCP server.

## Core principles

1. **Never invent.** Employers, clients, numbers, results, dates, links, prices and testimonials come only from the portfolio, the CV or Profile, files the user gives you and what they tell you. Ask for what's missing; leave a gap rather than fill it.
2. **Read before you write.** Call `get_portfolio` first and use the ids it returns. Its `guide` is the full reference for the edit language; follow it exactly.
3. **Small, reviewable steps.** One request → one `edit_portfolio` call with a clear `title`. Tell the user what changed in one or two sentences.
4. **Ask before going public.** `publish_portfolio` makes the page visible to everyone: only call it when the user asks, and confirm first.

## Workflow

### 1. Find or create the portfolio

- `get_portfolio`. If `exists` is false, offer `create_portfolio` (from a CV with `sourceResumeId`, found with `list_resumes`, or from the Profile when left out). If `enabled` is false, portfolios aren't open for this account yet: say so and stop.
- Read `view` to see what's there: theme, intro, About, works and their blocks, services, testimonials, clients, the career sections read live from the CV or Profile, images, limits and what the plan locks.

### 2. Content first

- **Intro**: a greeting of one or two sentences in the page's language; the name, headline, photo and location come from the CV unless overridden.
- **About**: three to five short paragraphs at most: what they do, for whom, how they work.
- **Works**: one per real project. A strong work has a title, a one-line summary, the role, a date, a cover picture, and blocks telling the story: the problem, what they did, the result (with numbers only the user gives you), pictures, and a link or video. Ask for anything missing, one question at a time.
- **Career sections** (experience, education, skills, …) are read live from the CV or Profile. You can hide items or whole sections, rename and reorder them, but not rewrite them: point the user to the CV or Profile for that.
- **Testimonials**: only the user's exact words from a real person, after they confirm that person agreed to be shown (`consent: true`). Never write one.

### 3. Pictures

`add_portfolio_image` stores a picture from a public URL or a file the user gives you and returns an image ref (`{ key, alt }`) to place with `edit_portfolio` (a work's `cover`, an images block, a custom section's image). Write alt text that says what the picture shows. The server can't resize: a picture over 2000 px or 2.5 MB is refused, so ask for a smaller one.

### 4. Design

Choose a theme from the view's catalog that suits the user's field, then an accent colour and fonts. Themes and intro effects marked Plus need a paid plan: suggest, don't apply, when the plan locks them.

### 5. Publish

Only when the user asks: confirm, then `publish_portfolio { published: true }`. It needs a verified email. Share the `url` from `get_portfolio`. Password protection, a custom domain and deleting the portfolio stay in the web editor.

## Editing tips

- Failed edits come back in the result with a reason (an unknown id, a field too long, a plan limit). Fix and resend only those.
- If `edit_portfolio` reports a version conflict because you sent `expectedUpdatedAt`, call `get_portfolio` again and redo the edits on the new ids.
- `get_portfolio_statistics` shows visits over 7, 30 or 90 days, which helps decide what to improve.
- The prompts `build_portfolio` and `improve_portfolio` start these workflows with the current portfolio included.

## Related skills

- **resume-builder** / **resume-content-guide**: the CV the portfolio reads its career sections from.
- **resume-bullet-writer**: digging out achievements and numbers for a work's story.
