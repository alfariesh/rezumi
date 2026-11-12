# Draf panduan pengguna — portfolio

Bahan untuk `docs/guides/creating-a-portfolio.mdx` (bahasa Inggris, seperti panduan `docs/` lain), diterbitkan di Phase 12. Dibuat di Phase 03 (2026-11-06) dan dilengkapi phase berikutnya; setiap phase menambah atau memperbarui bagiannya sendiri. Teks di bawah ditulis dalam bahasa Inggris agar bisa langsung dipindah; label tombol mengikuti teks aplikasi (Inggris). Tangkapan layar memakai persona fiktif (`tooling/templates/personas`), diambil ulang saat terbit.

Yang belum ada di aplikasi ditandai _(Phase NN)_ dan dihapus atau dilengkapi oleh phase itu.

**Diselaraskan 2026-11-12 dengan Phase 13** (halaman karya, kartu nama dan Simpan kontak, kata sandi, sematan, Open to work, statistik lanjutan, tema Sintaks dan Warta). Panduan publik `docs/guides/creating-a-portfolio.mdx` ditulis agent lain dari fitur-fitur yang sama; bila berbeda dengan draf ini, panduan publik dan kode yang berlaku. Teks Kebijakan Privasi untuk sematan, vCard, dan kata sandi belum terbit: lihat `draf-privasi-phase-13.md`.

---

## Creating a portfolio website

Your portfolio is a one-page website at `rezumi.app/<your-username>`. It shows your work, results, services and contact details, and takes your career details from one of your resumes, so it stays up to date when the resume changes.

### Create it

1. In the sidebar, open **Portfolio**, then choose **Create portfolio**.
2. Choose what it starts from:
   - **A resume** (your primary resume is picked). Your name, photo, experience, education, skills and contact details follow that resume as it changes. Its summary becomes **About me** and its projects become your **work**; after that you edit both freely in the portfolio.
   - **Without a resume**: type your name and headline. You can link a resume later in **Publish → Source resume**.
3. Choose a theme from the gallery: **Lugas** (one calm column, suits every field), **Prima** (formal and structured, for finance, consulting and management), **Kanvas** (big pictures first, for designers, photographers and architects), **Mozaik** (playful tiles, for creators, freelancers and students), **Paper**, **Brutal**, **Sintaks** (a terminal window and repositories, for developers, data people and IT) or **Warta** (a magazine, for writers, PR, marketing and researchers). Every theme except Lugas and Prima is marked **Plus**. You can change the theme any time in **Design**; your content stays as it is.
4. From a resume, you can then **start with AI**: Rezumi writes your greeting, About me and the story of each work from your resume (3 credits on Rezumi AI, free on your own AI connection). Add a note if there's something to stress or leave out, or choose **Skip**.
5. Select **Write draft** or **Create portfolio**. The editor opens with your content already filled in. A draft goes in as one change, so **Undo** puts back what came from your resume.

AI only uses what's on your resume and in your note: it won't make up numbers, clients or results. Where a story needs a result it doesn't have, it writes a place for you to fill in, in square brackets, such as `[add the result]`. Publishing reminds you if any are left.

### The editor

The panel on the left has three tabs; the preview on the right shows the page as visitors will see it, at a computer's width or a phone's. On a phone, switch between the panel and **Preview** with the tabs at the bottom.

Changes save on their own (a cloud icon at the top shows the state). **Undo** and **Redo** sit beside it. If you edit the same portfolio in another tab or on another device, the editor tells you and asks you to reload, so neither copy overwrites the other.

#### Content

- **Intro** is always first. Your name, headline and location come from your resume; type in the fields to use different ones on the portfolio only, or leave them empty to follow the resume. Add a short **greeting**, choose whether your photo shows, turn on **Open to work** (off by default; with your own wording if you like, up to five **roles you're looking for** and the **kinds of work**: full-time, part-time, contract, freelance or internship, which show as one line under your intro; anyone who opens your page sees it, your current employer too), and add up to three buttons: _View resume_, _Download resume PDF_, _Send a message_, _WhatsApp_, _Email_, _Save contact_, a profile or another link.
- **Sections**: drag a section by its handle, or use its arrows, to change the order. The eye hides a section; the pencil renames it (leave the name empty to use the default). Open a section to edit it:
  - **About me** and your own sections use a rich text editor: bold, italic, underline, strikethrough, headings, lists, quotes and links. Your own sections can have a picture too.
  - **Services**: name, description, an optional price ("From Rp1.5m"), an icon, and an order button (WhatsApp with a message naming the service, Contact, or a link).
  - **Testimonials**: add one by confirming it's genuine and that the person agreed to show it, then add the person's photo if you like.
  - **Clients**: names, with a logo you upload (PNG or WebP with a clear background; uploading it confirms you may show it) or a brand logo when one is known. Logos show grey until a visitor points at them. **Add from Experience** adds the companies on your resume.
  - **Sections from your resume** (Experience, Education, Skills…): switch individual entries off to hide them on the portfolio only; your resume doesn't change. **Edit on resume** opens the resume editor.
  - **Contact**: an invitation line, which details show (email and website on, phone off by default), a WhatsApp button, a **Save contact** button (on by default; visitors save your name, headline and the contact details shown here to their phone, as a contact card without a photo or street address), your profiles, and the **Location card**: find your city (the list starts from your resume's location), choose how precise to be (city, province or state, or country), how you work, open to relocating, and your local time (set from the city). **Show a map on my page** is off by default; turned on, it shows a map you can zoom, and at city precision you can drag the pin around your city (it's rounded to about a kilometre; don't put it on your home). Your page shows a picture of the map in light and dark mode, so visitors' browsers never contact a map service. There's no "use my location". _(Contact form: Phase 08.)_
  - **Work**: see [Work](#work) below.
- **Add a section** adds a section of your own (up to ten) with a title, text and an optional button.

#### Work

Each work has a **card** in the list and its **own page** (`rezumi.app/<username>/work/<address>`, or `/work/<address>` on your own domain) that opens when a visitor taps the card. The page has its own link, link preview and search entry, so one project can be shared on its own. A hidden or untitled work has no page. **Add work** offers:

- **Empty**: fill in the card, then build the detail.
- **From my resume**: tick projects on your resume; their title, summary, dates and link come along. Projects already added are marked.
- **Upload pictures**: choose, drop or paste many pictures at once, then make **one work with all of them** (up to 12 per work) or **one work per picture** (good for photographers and illustrators).
- **Paste a link**: paste a link to Behance, Dribbble, GitHub, Figma, Medium, YouTube, Vimeo or any public page, then **Read the link**. The title, summary and a picture fill in; change them as you like. Tick **Use this picture as the cover** only if you may show it: it's copied into your portfolio. A YouTube or Vimeo link makes a work with a Video block; any other makes a Link block. When a site can't be read automatically, you fill the card in yourself.

Open a work to edit it; the preview shows its page while you do, and tapping a card or its previous/next link in the preview opens that work.

- **Card**: a cover (tap the part to keep in view when the card crops it), title, a one- or two-sentence summary, your role, the year ("2024", "Jan–Mar 2025"), up to 12 tags, the **metric on the card** (a result from this work's Metrics blocks, shown as a chip), a main link, **Featured** and **Hide from the page**. The **Page address** follows the title until you change it; type your own (lowercase letters, digits and single dashes). Old addresses keep working: up to five previous ones forward to the current one, so links you already shared don't break. **Open page** shows it once the portfolio is published.
- **Detail** is built from blocks. Use **Add block** between blocks, or type **/** in a text block, to add:
  - **Text**: paragraphs, headings, lists, quotes and links.
  - **Pictures**: 1 to 12 pictures, each with a description and an optional caption, shown full width, as a grid, or to swipe sideways. Visitors can open them full screen.
  - **Metrics**: 1 to 4 results as numbers, such as "+35% checkout conversion". Use numbers you can explain in an interview, and say where they come from.
  - **Video**: paste a YouTube or Vimeo link; the title fills in from the video. Visitors see the thumbnail (copied into your portfolio) and a play button; the player, and YouTube's or Vimeo's tracking, only load when they press play.
  - **PDF**: upload a PDF up to 10 MB, without a password (a design portfolio, report or article). Its first page becomes the card's picture; visitors see the title, page count and size, and **Open PDF** opens it in a new tab.
  - **Embed**: paste a link to Figma, Loom, Spotify, SoundCloud or Google Slides (a short SoundCloud link works too). The title and picture fill in when the service provides them (Google Slides doesn't: type a title and add a picture if you like). Visitors see the picture and a **Show … here** button with a note that the content loads from the service; nothing is loaded from it until they press, and after that the service may set its own cookies. Share a Google Slides presentation or a Figma file with "anyone with the link" first, or it won't show. A Link block with an embeddable address offers **Embed it instead**.
  - **Link**: paste a link and the card fills in (title, description, site name, the site's logo when known). The page's picture is only a suggestion: **Use this picture** copies it into your portfolio. You can also upload your own, or change any of the text.
- Drag a block by its handle or use its arrows to reorder; removing a block can be undone. An empty work can **Start from a case study outline**: headings for the problem, your role, the process and the result, and a Metrics block.

A portfolio holds up to 50 works, each with up to 30 blocks. _(Plan limits: Phase 07.)_

#### Metrics

A metric has a **value** (a number, or short text such as "Top 3"), how it's **written** (number, percent, rupiah, dollar, short number like 1.2k, times like 3×, a duration, or a rating out of 5), what goes before or after it ("+", "/month"), and a **label**. Optionally: a **change** (up, down or the same, its text such as "+35%", and whether it's good news: a fall can be good), the **value before** (shown as before → after bars), a **small chart** (3 to 12 values in order), **progress** (0–100), **context or source**, and an icon. Numbers are written the way the page's language writes them. The theme's **Metrics** layout in **Design** chooses KPI cards, big numbers, or before → after.

#### Pictures

Pictures are made smaller in your browser before they're uploaded: at most 2,000 pixels on the longest side (logos 600), as WebP, with a smaller copy for cards. This also removes the photo's hidden data, such as where it was taken. A 10 MB phone photo is usually stored at a few hundred kilobytes. JPG, PNG, WebP and still GIF pictures work; SVG files and animated GIFs don't. Every picture needs a short **description** for people who can't see it; it starts from the work's title or the person's name.

Pictures you remove or replace are deleted a day later, so **Undo** can still bring them back.

#### Design

Choose the theme (Lugas, Prima, Kanvas, Mozaik, Paper, Brutal, Sintaks or Warta, in the same gallery as when you created the portfolio), light, dark, or **Device** (each visitor's own setting), an accent colour (the same as your resume, one of eight, or your own; a colour that's hard to read as text is darkened or lightened for text automatically), a font pair, and the layout of each section the theme supports.

**Paper** uses a visible paper-fibre texture, fine borders, folded corners and alternating work stories. It starts with Google Sans and uses JetBrains Mono for figures and dates. Its accent follows your resume or your chosen colour; without a resume it starts in orange. Its default intro places a small optional portrait above the text and an isometric paper drawing beside it; you can also choose a larger portrait on either side.

**Brutal** uses bold headings, flat colour, thick outlines and hard offset shadows. Its default fonts are Space Grotesk and Inter, with work in two columns and a framed black-and-white portrait (or your initials). Without a resume it starts in yellow; your chosen accent and section order still apply. PDF and link cards use the same bold attachment style.

**Sintaks** is dark by default and reads like a code editor: your intro is a terminal window (`$ whoami`), work cards are repositories with your tags as languages, your career is a `git log`, and skills are a tech stack. It uses a monospaced face for labels and starts with Geist; the decorative code text is hidden from screen readers. **Warta** is light by default and reads like a magazine: a masthead with your name, a cover story and a grid of articles with a rubric and reading time, pull quotes, and a drop cap on your About text (not on right-to-left pages). It starts with Newsreader and Libre Franklin.

Under **Intro**, choose the intro's background (plain, a soft gradient, a subtle pattern, or a picture of your own under a darker layer) and an **intro effect** for your name or headline. Each card shows a live sample; point at it to play it again. The effects are **Gentle fade-in** (words appear one by one), **Shimmer** (a light in your accent colour sweeps across), **Living gradient** (your accent colours drift, then rest), **Typewriter** (your headline types itself, then up to two more roles you add, and ends on the headline), **Tech scramble** (random letters settle into your name) and **Vector outline** (letters turn into design-app outlines under the mouse; phones get the gentle fade-in). Each theme offers the ones that suit it and starts with its own (Lugas: Gentle fade-in, Prima: none, Kanvas: Vector outline, Mozaik: Living gradient, Paper and Brutal: none). Effects stop by themselves within five seconds, never hide your name from search engines or screen readers, and stay still for visitors who ask their device for less motion. The preview holds still while you edit; **Replay intro** above it plays the effect again.

#### Publish

- **Publish** shows your address and asks whether search engines may list your portfolio (on by default). If your short link opened your resume until now, it says where the resume moves (`rezumi.app/<username>/<resume-address>`); your portfolio links to it.
- You need a verified email address to publish.
- Once published, copy the address, open the page, or open the **Business card**: a QR code to your portfolio you can download (PNG or SVG), print as a sheet of ten cards on A4, or show full screen on your phone at a job fair. The QR adds `?utm_source=qr`, so your statistics show visits from it as **QR code**, without cookies or visitor data. Turning **Published** off takes the page down; your short link opens your primary resume again.
- **Password**: turn on **Protect with a password** (6 to 64 characters) to share the portfolio and all its works only with people you give the password to. Visitors see a plain page that asks for it, without your name or photo; a right password opens the page they asked for, for 12 hours in that browser. While it's on, search engines don't list the portfolio, link previews show a general picture, and Save contact isn't offered. **Change password** or **Remove the password** any time; changing it ends everyone's access. You aren't asked when you're signed in on rezumi.app (you are on your own domain). Files such as pictures and PDFs are only served to people who opened the portfolio.
- **Search engines**: turn listing on or off, and set the title and description search results show. New accounts are kept out of search engines for their first seven days, even with this on.
- **Page language** changes the page's own words (section titles, button labels), not your text. Empty follows your resume.
- **Source resume** chooses the resume your career sections come from, or none. If it's moved to Trash, your portfolio keeps its own content and asks you to choose another.

### What your plan includes

|                        | Free                                          | Plus and Pro AI                                                  |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Themes                 | Lugas and Prima                               | All eight themes                                                 |
| Intro effects          | Gentle fade-in and Shimmer                    | All effects                                                      |
| Made with Rezumi badge | Always shown                                  | Can be hidden                                                    |
| Works                  | Up to 6                                       | Up to 50                                                         |
| Pictures and PDFs      | 100 MB                                        | 1 GB                                                             |
| Your own domain        | No                                            | Yes                                                              |
| Visitor statistics     | Basic numbers, 7, 30 or 90 days, CSV download | Also countries, devices, linking sites and details for each work |

Every kind of block and section (embeds included) is on every plan, and so are work pages, the business card, Save contact, passwords, Open to work and the contact form. You can look at every theme before you choose. When a paid plan ends, nothing is deleted: your theme, effect, works and files stay on the page, you can't add more until you're within the limits, and the badge returns. Your own domain stops 7 days after the plan ends and works again when you subscribe again. Pictures you removed count toward your storage for one more day, until they're deleted.

### Visitors and messages

The Portfolio page in your dashboard shows the last 7, 30 or 90 days (your choice, kept in the address) once your portfolio has been published. Only you can see these numbers. Days are counted in your account's time zone.

- **Visitors**: visits per day, clicks on your buttons, messages, where visits came from (LinkedIn, WhatsApp, Google, direct, other sites) and your most opened works: the **Per work** table lists every work with how often its page was opened, and **Details** shows a daily chart for one work. A visitor counts once an hour. Opening a work counts when the work's page is opened. Visits from your business card's QR code show as **QR code**; the buttons also count **Embeds opened** and **Contacts saved**. Your own visits, search engines and previews don't count, and no tracking cookie is used.
- **With Plus**: visitors' countries on a map, their devices, the sites that link to you, and work opened per day, also for each work (its sources, linking sites, countries, devices and clicks). These figures are estimates and cover up to the last three months.
- **Download CSV**: the daily numbers and the works table on every plan, and the breakdown with Plus. Files are UTF-8 with commas; Excel in some languages expects semicolons, so if everything lands in one column, import it as text or open it in Google Sheets or Numbers.
- **Contact form**: turn on **Show a contact form** in the editor, under **Contact**. Visitors pass a quick anti-spam check. Each message arrives by email (reply to that email to answer the sender) and in **Messages** on the Portfolio page, where you can mark it as read or delete it. Messages are deleted automatically after 90 days. If several arrive close together, one email sums them up.
- The form needs JavaScript in the visitor's browser. Without it, visitors see your other contact options instead.
- On a custom domain, the form's button opens your portfolio on rezumi.app to send the message.

### Connecting your own domain

Plus and Pro AI accounts can open their portfolio at a domain they own, such as `www.yourname.com`. Go to **Publish → Your domain** in the editor, or **Your domain** on the Portfolio page.

1. Enter your domain. A name with `www` or another subdomain works with every domain company. A domain without `www` only works if your DNS provider allows a CNAME there; if it doesn't, use `www` and forward the plain domain to it where you manage the domain.
2. Add the two records shown (a CNAME and a TXT) where you manage your domain. If your DNS is on Cloudflare, set the CNAME to **DNS only**.
3. Select **Check DNS**. The steps tick off as your domain is set up, and HTTPS usually takes a few minutes.

Keep both records in place. You can have one domain per account. When a paid plan ends, your domain keeps working for 7 days, then goes to your rezumi.app address. Renew and it comes back by itself, with no DNS change.

### Your short link and your resume

While your portfolio is published, `rezumi.app/<username>` (and your custom domain) open the portfolio. Your resume stays at its own address, and the resume's **Share** panel says so. Unpublish the portfolio and the short link opens your primary resume again.

### Delete it

On the **Portfolio** page, **Delete portfolio** removes its text, work, design and settings for good. Your resumes stay as they are.

#### Writing with AI

- **Write a draft with AI** at the top of **Content** writes your greeting, About me and the works you pick from your resume. It replaces what's in those places; **Undo** takes it back.
- The small **AI** button on long fields (greeting, a work's summary, a service's description, About me, Text blocks and your own sections) makes the text shorter, more professional, or translates it to the page's language, for 1 credit. Testimonials don't have it: they're someone else's words.
- **Find numbers** beside a metric list reads your jobs and projects and suggests metrics, each with the sentence it comes from, for 1 credit. Only numbers written on your resume are suggested; you pick which to add.
- Failed or stopped requests give their credits back. On your own AI connection, nothing costs credits.

## Reports and takedowns (Phase 11)

- Every published portfolio has a **Report** link in its footer. A visitor picks a reason, describes the problem, and can leave an email if they'd like a reply. The portfolio's owner never sees who reported it.
- If the Rezumi team takes your portfolio down, visitors stop seeing it, your short link opens your primary resume if you have one, and you can't publish or delete it. Nothing is deleted. The **Publish** tab shows the reason; to appeal, email hi@rezumi.app.
- By adding a client logo you confirm you may show it. Testimonials must be genuine and shown with the person's permission.
- **Intro → Show my location** keeps your location off the page, including the one on your resume. An Email or WhatsApp button shows that address to visitors even if Contact hides it. Details saved inside a PDF, such as the author's name, are published with it.
