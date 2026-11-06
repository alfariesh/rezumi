# Draf panduan pengguna — portfolio

Bahan untuk `docs/guides/creating-a-portfolio.mdx` (bahasa Inggris, seperti panduan `docs/` lain), diterbitkan di Phase 12. Dibuat di Phase 03 (2026-11-06) dan dilengkapi phase berikutnya; setiap phase menambah atau memperbarui bagiannya sendiri. Teks di bawah ditulis dalam bahasa Inggris agar bisa langsung dipindah; label tombol mengikuti teks aplikasi (Inggris). Tangkapan layar memakai persona fiktif (`tooling/templates/personas`), diambil ulang saat terbit.

Yang belum ada di aplikasi ditandai _(Phase NN)_ dan dihapus atau dilengkapi oleh phase itu.

---

## Creating a portfolio website

Your portfolio is a one-page website at `rezumi.app/<your-username>`. It shows your work, results, services and contact details, and takes your career details from one of your resumes, so it stays up to date when the resume changes.

### Create it

1. In the sidebar, open **Portfolio**, then choose **Create portfolio**.
2. Choose what it starts from:
   - **A resume** (your primary resume is picked). Your name, photo, experience, education, skills and contact details follow that resume as it changes. Its summary becomes **About me** and its projects become your **work**; after that you edit both freely in the portfolio.
   - **Without a resume**: type your name and headline. You can link a resume later in **Publish → Source resume**.
3. Choose a theme. You can change it any time in **Design**. _(More themes: Phase 06.)_
4. Select **Create portfolio**. The editor opens with your content already filled in.

### The editor

The panel on the left has three tabs; the preview on the right shows the page as visitors will see it, at a computer's width or a phone's. On a phone, switch between the panel and **Preview** with the tabs at the bottom.

Changes save on their own (a cloud icon at the top shows the state). **Undo** and **Redo** sit beside it. If you edit the same portfolio in another tab or on another device, the editor tells you and asks you to reload, so neither copy overwrites the other.

#### Content

- **Intro** is always first. Your name, headline and location come from your resume; type in the fields to use different ones on the portfolio only, or leave them empty to follow the resume. Add a short **greeting**, choose whether your photo shows, turn on **Open to work** (with your own wording if you like), and add up to three buttons: _View resume_, _Download resume PDF_, _Send a message_, _WhatsApp_, _Email_, a profile or another link.
- **Sections**: drag a section by its handle, or use its arrows, to change the order. The eye hides a section; the pencil renames it (leave the name empty to use the default). Open a section to edit it:
  - **About me** and your own sections use a rich text editor: bold, italic, underline, strikethrough, headings, lists, quotes and links. Your own sections can have a picture too.
  - **Services**: name, description, an optional price ("From Rp1.5m"), an icon, and an order button (WhatsApp with a message naming the service, Contact, or a link).
  - **Testimonials**: add one by confirming it's genuine and that the person agreed to show it, then add the person's photo if you like.
  - **Clients**: names, with a logo you upload (PNG or WebP with a clear background; uploading it confirms you may show it) or a brand logo when one is known. Logos show grey until a visitor points at them. **Add from Experience** adds the companies on your resume.
  - **Sections from your resume** (Experience, Education, Skills…): switch individual entries off to hide them on the portfolio only; your resume doesn't change. **Edit on resume** opens the resume editor.
  - **Contact**: an invitation line, which details show (email and website on, phone off by default), a WhatsApp button, your profiles, and the **Location card**: find your city (the list starts from your resume's location), choose how precise to be (city, province or state, or country), how you work, open to relocating, and your local time (set from the city). **Show a map on my page** is off by default; turned on, it shows a map you can zoom, and at city precision you can drag the pin around your city (it's rounded to about a kilometre; don't put it on your home). Your page shows a picture of the map in light and dark mode, so visitors' browsers never contact a map service. There's no "use my location". _(Contact form: Phase 08.)_
  - **Work**: see [Work](#work) below.
- **Add a section** adds a section of your own (up to ten) with a title, text and an optional button.

#### Work

Each work has a **card** in the list and a **detail** that opens when a visitor taps it. **Add work** offers:

- **Empty**: fill in the card, then build the detail.
- **From my resume**: tick projects on your resume; their title, summary, dates and link come along. Projects already added are marked.
- **Upload pictures**: choose, drop or paste many pictures at once, then make **one work with all of them** (up to 12 per work) or **one work per picture** (good for photographers and illustrators).
- **Paste a link**: paste a link to Behance, Dribbble, GitHub, Figma, Medium, YouTube, Vimeo or any public page, then **Read the link**. The title, summary and a picture fill in; change them as you like. Tick **Use this picture as the cover** only if you may show it: it's copied into your portfolio. A YouTube or Vimeo link makes a work with a Video block; any other makes a Link block. When a site can't be read automatically, you fill the card in yourself.

Open a work to edit it; the preview shows its detail while you do.

- **Card**: a cover (tap the part to keep in view when the card crops it), title, a one- or two-sentence summary, your role, the year ("2024", "Jan–Mar 2025"), up to 12 tags, the **metric on the card** (a result from this work's Metrics blocks, shown as a chip), a main link, **Featured** and **Hide from the page**. The work's address (`rezumi.app/<username>#work-<title>`) follows its title.
- **Detail** is built from blocks. Use **Add block** between blocks, or type **/** in a text block, to add:
  - **Text**: paragraphs, headings, lists, quotes and links.
  - **Pictures**: 1 to 12 pictures, each with a description and an optional caption, shown full width, as a grid, or to swipe sideways. Visitors can open them full screen.
  - **Metrics**: 1 to 4 results as numbers, such as "+35% checkout conversion". Use numbers you can explain in an interview, and say where they come from.
  - **Video**: paste a YouTube or Vimeo link; the title fills in from the video. Visitors see the thumbnail (copied into your portfolio) and a play button; the player, and YouTube's or Vimeo's tracking, only load when they press play.
  - **PDF**: upload a PDF up to 10 MB, without a password (a design portfolio, report or article). Its first page becomes the card's picture; visitors see the title, page count and size, and **Open PDF** opens it in a new tab.
  - **Link**: paste a link and the card fills in (title, description, site name, the site's logo when known). The page's picture is only a suggestion: **Use this picture** copies it into your portfolio. You can also upload your own, or change any of the text.
- Drag a block by its handle or use its arrows to reorder; removing a block can be undone. An empty work can **Start from a case study outline**: headings for the problem, your role, the process and the result, and a Metrics block.

A portfolio holds up to 50 works, each with up to 30 blocks. _(Plan limits: Phase 07.)_

#### Metrics

A metric has a **value** (a number, or short text such as "Top 3"), how it's **written** (number, percent, rupiah, dollar, short number like 1.2k, times like 3×, a duration, or a rating out of 5), what goes before or after it ("+", "/month"), and a **label**. Optionally: a **change** (up, down or the same, its text such as "+35%", and whether it's good news: a fall can be good), the **value before** (shown as before → after bars), a **small chart** (3 to 12 values in order), **progress** (0–100), **context or source**, and an icon. Numbers are written the way the page's language writes them. The theme's **Metrics** layout in **Design** chooses KPI cards, big numbers, or before → after.

#### Pictures

Pictures are made smaller in your browser before they're uploaded: at most 2,000 pixels on the longest side (logos 600), as WebP, with a smaller copy for cards. This also removes the photo's hidden data, such as where it was taken. A 10 MB phone photo is usually stored at a few hundred kilobytes. JPG, PNG, WebP and still GIF pictures work; SVG files and animated GIFs don't. Every picture needs a short **description** for people who can't see it; it starts from the work's title or the person's name.

Pictures you remove or replace are deleted a day later, so **Undo** can still bring them back.

#### Design

Choose light, dark, or **Device** (each visitor's own setting), an accent colour (the same as your resume, one of eight, or your own; a colour that's hard to read as text is darkened or lightened for text automatically), a font pair, the intro's background (plain, a soft gradient, a subtle pattern, or a picture of your own under a darker layer), and the layout of each section the theme supports. _(Intro text effects: Phase 06.)_

#### Publish

- **Publish** shows your address and asks whether search engines may list your portfolio (on by default). If your short link opened your resume until now, it says where the resume moves (`rezumi.app/<username>/<resume-address>`); your portfolio links to it.
- You need a verified email address to publish.
- Once published, copy the address, open the page, or show a QR code. Turning **Published** off takes the page down; your short link opens your primary resume again.
- **Search engines**: turn listing on or off, and set the title and description search results show. New accounts are kept out of search engines for their first seven days, even with this on.
- **Page language** changes the page's own words (section titles, button labels), not your text. Empty follows your resume.
- **Source resume** chooses the resume your career sections come from, or none. If it's moved to Trash, your portfolio keeps its own content and asks you to choose another.

### Your short link and your resume

While your portfolio is published, `rezumi.app/<username>` (and your custom domain) open the portfolio. Your resume stays at its own address, and the resume's **Share** panel says so. Unpublish the portfolio and the short link opens your primary resume again.

### Delete it

On the **Portfolio** page, **Delete portfolio** removes its text, work, design and settings for good. Your resumes stay as they are.
