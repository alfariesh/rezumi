> [!IMPORTANT]
> Rezumi lives at **[`alfariesh/rezumi`](https://github.com/alfariesh/rezumi)** on GitHub.  
> This fork deploys only to Cloudflare Workers. See the [Cloudflare guide](https://docs.rezumi.app/self-hosting/cloudflare).

<div align="center">
  <a href="https://rezumi.app">
    <img src="apps/web/public/opengraph/banner.jpg" alt="Rezumi" />
  </a>

  <h1>Rezumi</h1>

  <p>Rezumi is a free and open-source resume builder for writing resumes and cover letters, checking your work, and tracking job applications.</p>

  <p>
    <a href="https://rezumi.app"><strong>Get Started</strong></a>
    ·
    <a href="https://docs.rezumi.app"><strong>Learn More</strong></a>
  </p>

  <p>
    <img src="https://img.shields.io/github/package-json/v/alfariesh/rezumi?style=flat-square" alt="Rezumi Version">
    <img src="https://img.shields.io/github/stars/alfariesh/rezumi?style=flat-square" alt="GitHub Stars">
    <img src="https://img.shields.io/github/license/alfariesh/rezumi?style=flat-square" alt="License" />
  </p>
</div>

---

Create a free account, import an existing resume or start fresh, and see the finished page as you write. Download a PDF, Word, Markdown, or JSON file, or share your resume with a public link. You can also run the whole application on your own infrastructure.

You own your data. The codebase is open source under the MIT license, with no tracking, no ads, and no paid tier. Optional AI features use a provider you connect; hosting and provider usage may have their own costs.

![Rezumi v6 editor with Write, Design, and Check modes and a live PDF preview](docs/images/getting-started/editor-overview.webp)

## Features

**Write, Design, and Check**

- Redesigned editor with inline content editing and click-to-select on the page
- Live PDF preview and browser downloads powered by Forme, rendered in a background worker
- Rich text, custom sections, drag-and-drop ordering, and structured dates with consistent formatting
- Autosave, local recovery of unsaved resume drafts, and up to 200 undo steps
- Phone and tablet layouts, keyboard shortcuts, and a searchable command bar

**Templates and Customization**

- 18 templates, including the new Porygon and Smeargle, previewed with your own content
- One-column, two-column, and ATS-safe template filters
- Font presets, custom fonts, colors, spacing, A4 and Letter paper, and left or right sidebars
- Fit overflowing content by adjusting density, margins, and text size
- Custom Styles written as Semantic CSS, with an element picker on the page

**Resume Checks**

- Readability checks with findings pinned to the relevant lines
- Job-posting keyword matching and a view of the text hiring software reads
- Checks on the exported PDF, plus an optional AI writing review
- A public [ATS checker](https://rezumi.app/ats-checker) that reads PDFs in your browser without an account

**Documents and Cover Letters**

- One searchable library for resumes and letters, with tags, sorting, and grid or list views
- Standalone cover letters with their own editor, exports, and version history
- Link a letter to a resume to keep its sender details and design in sync, or customize it independently
- Automatic and named versions you can preview and restore
- Trash with Undo and a 30-day recovery window

**Job Applications**

- List, Board, Insights, and Calendar views for tracking applications from Saved to Offer
- Save jobs from a URL or pasted posting; optional keyword search through Firecrawl, Tavily, or Exa
- Tailor a resume and draft a cover letter for a saved job
- Track contacts, notes, follow-ups, application outcomes, and the documents you sent
- Schedule interviews, export calendar events, and import or export applications as CSV

**AI Assistant**

- Assistant beside your resume or letter, with conversations tied to that document
- Proposed edits show what changes and why; accept or reject each suggestion
- Improve selected text, review writing, and draft letters from a resume and job posting
- Connect OpenAI, Anthropic, Google Gemini, OpenRouter, Ollama, or other supported providers and compatible endpoints
- Optional web search and page reading; self-hosters can configure shared AI and web-access providers

**Import, Export, and Sharing**

- Import Rezumi JSON, JSON Resume, LinkedIn data exports, PDF, and Word files
- JSON, LinkedIn, and readable PDF imports work without AI; Word imports require a connected provider
- Export resumes and letters as PDF, Word (DOCX), Markdown, or JSON
- Share resumes through public links with optional password protection and view/download statistics
- REST API and MCP server for document management, imports, exports, checks, and application workflows

**Privacy and Control**

- Self-host on Cloudflare Workers with R2 storage and PostgreSQL through Hyperdrive
- No tracking or ads; export your account data or delete your account
- Passkeys, two-factor authentication, and linked sign-in providers
- Multiple interface languages, light/dark/system themes, and reduced-motion support

## Templates

<table>
  <tr>
    <td align="center">
      <img src="apps/web/public/templates/jpg/azurill.jpg" alt="Azurill" width="150" />
      <br /><sub><b>Azurill</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/bronzor.jpg" alt="Bronzor" width="150" />
      <br /><sub><b>Bronzor</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/chikorita.jpg" alt="Chikorita" width="150" />
      <br /><sub><b>Chikorita</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/ditto.jpg" alt="Ditto" width="150" />
      <br /><sub><b>Ditto</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="apps/web/public/templates/jpg/gengar.jpg" alt="Gengar" width="150" />
      <br /><sub><b>Gengar</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/glalie.jpg" alt="Glalie" width="150" />
      <br /><sub><b>Glalie</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/kakuna.jpg" alt="Kakuna" width="150" />
      <br /><sub><b>Kakuna</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/lapras.jpg" alt="Lapras" width="150" />
      <br /><sub><b>Lapras</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="apps/web/public/templates/jpg/leafish.jpg" alt="Leafish" width="150" />
      <br /><sub><b>Leafish</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/onyx.jpg" alt="Onyx" width="150" />
      <br /><sub><b>Onyx</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/persian.jpg" alt="Persian" width="150" />
      <br /><sub><b>Persian</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/pikachu.jpg" alt="Pikachu" width="150" />
      <br /><sub><b>Pikachu</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/rhyhorn.jpg" alt="Rhyhorn" width="150" />
      <br /><sub><b>Rhyhorn</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="apps/web/public/templates/jpg/ditgar.jpg" alt="Ditgar" width="150" />
      <br /><sub><b>Ditgar</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/meowth.jpg" alt="Meowth" width="150" />
      <br /><sub><b>Meowth</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/scizor.jpg" alt="Scizor" width="150" />
      <br /><sub><b>Scizor</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/porygon.jpg" alt="Porygon" width="150" />
      <br /><sub><b>Porygon</b></sub>
    </td>
    <td align="center">
      <img src="apps/web/public/templates/jpg/smeargle.jpg" alt="Smeargle" width="150" />
      <br /><sub><b>Smeargle</b></sub>
    </td>
  </tr>
</table>

## Quick Start

Use the [hosted app](https://rezumi.app) to start writing, or run this checkout locally. Local development uses Docker Compose only for PostgreSQL, Redis, and SeaweedFS (`compose.dev.yml`); the app itself runs on your host:

```bash
# Clone the repository
git clone --depth=1 https://github.com/alfariesh/rezumi.git rezumi
cd rezumi

# Install dependencies and create your local configuration
pnpm install --frozen-lockfile
cp .env.example .env.local
# Edit .env.local: set AUTH_SECRET and a separate ENCRYPTION_SECRET, and use localhost hostnames.
# Generate each secret with: openssl rand -hex 32

# Start local PostgreSQL, Redis, and SeaweedFS
docker compose -f compose.dev.yml up -d postgres redis seaweedfs seaweedfs_create_bucket

# Start the app and open http://localhost:3000 in your browser
pnpm dev
```

To deploy, follow the [Cloudflare guide](https://docs.rezumi.app/self-hosting/cloudflare). For source development, see the [development setup guide](https://docs.rezumi.app/contributing/development).

## Tech Stack

| Category         | Technology                              |
| ---------------- | --------------------------------------- |
| Web app          | React 19 SPA, TanStack Router, and Vite |
| Server           | Hono on Cloudflare Workers              |
| Language         | TypeScript                              |
| Monorepo         | pnpm and Turborepo                      |
| Database         | PostgreSQL with Drizzle ORM             |
| API              | oRPC, OpenAPI REST, and MCP             |
| Auth             | Better Auth                             |
| Styling          | Tailwind CSS                            |
| UI Components    | Base UI + shared UI package             |
| State Management | Zustand + TanStack Query                |
| PDF rendering    | Forme, with PDF.js for the viewer       |
| Rich text        | TipTap                                  |
| Localization     | Lingui                                  |

## Documentation

The full documentation lives at [docs.rezumi.app](https://docs.rezumi.app):

| Guide                                                                                                              | Description                                  |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [Getting started](https://docs.rezumi.app/getting-started)                                                         | First-time setup and basic usage             |
| [What's new in v6](https://docs.rezumi.app/guides/whats-new-in-v6)                                                 | Changes and where familiar features moved    |
| [Checking your resume](https://docs.rezumi.app/guides/checking-your-resume)                                        | Readability, job match, and writing reviews  |
| [Using the assistant](https://docs.rezumi.app/guides/using-the-assistant)                                          | Ask for changes and review proposed edits    |
| [Writing a cover letter](https://docs.rezumi.app/guides/writing-a-cover-letter)                                    | Create a letter and link it to a resume      |
| [Tracking job applications](https://docs.rezumi.app/guides/tracking-job-applications)                              | Saved jobs, stages, interviews, and insights |
| [Exporting your resume](https://docs.rezumi.app/guides/exporting-your-resume)                                      | PDF, Word, Markdown, and JSON downloads      |
| [API](https://docs.rezumi.app/guides/using-the-api) and [MCP](https://docs.rezumi.app/guides/using-the-mcp-server) | Connect scripts and external assistants      |
| [Self-hosting](https://docs.rezumi.app/self-hosting/cloudflare)                                                    | Deploy on Cloudflare Workers                 |
| [Development setup](https://docs.rezumi.app/contributing/development)                                              | Local development environment                |
| [Project architecture](https://docs.rezumi.app/contributing/architecture)                                          | Codebase structure and package boundaries    |

## Self-Hosting

This fork deploys only to Cloudflare Workers: PostgreSQL through Hyperdrive for data, private R2 for uploads, Static Assets for the web app, and SQLite Durable Objects for coordination.

> **PDF generation in v6** uses Forme in the browser and on the server. No Browserless, Chromium, or external print service is needed. Legacy `PRINTER_*` and `BROWSERLESS_*` environment variables can be removed.

### Cloudflare Workers

Cloudflare deployment requires **Workers Paid** and uses Static Assets, private R2 storage, SQLite Durable Objects, and PostgreSQL through Hyperdrive. Supply an existing PostgreSQL database and apply migrations before deployment. See the [Cloudflare guide](https://docs.rezumi.app/self-hosting/cloudflare) for setup and runtime limits.

Deploy manually with `pnpm deploy:cloudflare`, or let GitHub Actions do it: every push to `main` runs `.github/workflows/deploy-cloudflare.yml`, which applies migrations (when the optional `DATABASE_URL` secret is set) and then deploys the Worker. Add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The application needs:

- **PostgreSQL** — Accounts, documents, applications, and assistant conversations (through Hyperdrive)
- **Upload storage** — A private R2 bucket
- **SMTP** (optional) — Verification and password-reset emails. Use port 465 or 587; Cloudflare blocks port 25

### Configuration

Every setting is listed in the [environment variables reference](https://docs.rezumi.app/self-hosting/environment-variables). Self-hosters can also configure [shared AI and job-search services](https://docs.rezumi.app/self-hosting/job-search-and-ai) and [single sign-on](https://docs.rezumi.app/self-hosting/sso).

## Support

Rezumi is and always will be free and open source. Ways to help:

- Star this repository
- Report reproducible bugs and suggest actionable features
- Help other users in [GitHub Discussions](https://github.com/alfariesh/rezumi/discussions/categories/q-a)
- Improve documentation

## Contributing

Every contribution helps, whether it is a typo fix or a new feature.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using Conventional Commits (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See the [development setup guide](https://docs.rezumi.app/contributing/development) for how to run the project locally.

Maintainers review the [`status: needs triage` queue](https://github.com/alfariesh/rezumi/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+needs+triage%22)
weekly. Triaged bugs become `status: confirmed`; feature proposals become `status: accepted`; reports that need details become
`status: needs info`.

## License

[MIT](./LICENSE) — do whatever you want with it.
