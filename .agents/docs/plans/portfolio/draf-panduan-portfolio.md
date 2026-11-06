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
  - **About me** and your own sections use a rich text editor: bold, italic, underline, strikethrough, headings, lists, quotes and links.
  - **Services**: name, description, an optional price ("From Rp1.5m"), an icon, and an order button (WhatsApp with a message naming the service, Contact, or a link).
  - **Testimonials**: add one by confirming it's genuine and that the person agreed to show it.
  - **Clients**: names (and a brand logo when one is known). **Add from Experience** adds the companies on your resume. _(Uploaded logos: Phase 04.)_
  - **Sections from your resume** (Experience, Education, Skills…): switch individual entries off to hide them on the portfolio only; your resume doesn't change. **Edit on resume** opens the resume editor.
  - **Contact**: an invitation line, which details show (email and website on, phone off by default), a WhatsApp button, your profiles, and the **Location card** (city, how you work, open to relocating, your local time). _(Contact form: Phase 08. Map: Phase 05.)_
  - **Work** lists the work copied from your resume's projects: rename, reorder or hide each one. _(Pictures, text blocks and results: Phase 04; video, PDF and links: Phase 05.)_
- **Add a section** adds a section of your own (up to ten) with a title, text and an optional button.

#### Design

Choose light, dark, or **Device** (each visitor's own setting), an accent colour (the same as your resume, one of eight, or your own; a colour that's hard to read as text is darkened or lightened for text automatically), a font pair, the intro's background, and the layout of each section the theme supports. _(Intro text effects: Phase 06.)_

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
