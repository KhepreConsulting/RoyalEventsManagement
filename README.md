# Royal Events Management

Wedding website plus a private client portal.

- **Public site** (`/`): hero, What We Do, How It Works, Previous Weddings gallery, testimonials, contact/enquiry form.
- **Client portal** (`/portal/login` → `/portal/client`): each couple sees a wedding countdown, event details, the items you've asked them to fill in, a planning timeline, shared documents, and a message thread with your team.
- **Planner dashboard** (`/portal/admin`): all clients at a glance, website enquiries (turn one into a client portal with one click), and a page per couple where you:
  - **request information** (short or long answer, number, date, multiple choice, yes/no, or a link such as a Google Sheet or Pinterest board), with due dates and ready-made templates
  - review and approve answers, or ask the couple to redo one
  - add timeline milestones, share document links, message the couple, keep staff-only notes, and reset their password

## Try it without a server (GitHub Pages demo)

`public/demo.js` is a pretend backend that runs in the browser and saves data to the visitor's `localStorage`. It turns on automatically on `*.github.io`, and anywhere else if you add `?demo` to the URL (`?demo=off` turns it off). When the real Node server is running it stays off.

- Demo logins (password `demo1234`): **planner@demo.com** (planner dashboard) and **couple@demo.com** (client portal). The sign-in page has one-click buttons for both.
- A gold bar at the top marks demo mode and has a **Reset demo data** button.
- Demo data is **not shared**: each browser has its own copy, so a couple's answers won't show up on your machine. Don't put real client details in it.

**Publish it:** in the repo on GitHub go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. After that, `.github/workflows/pages.yml` publishes `public/` on every push to `main`. You can also run it by hand from the Actions tab. The site appears at `https://<owner>.github.io/RoyalEventsManagement/`.

To preview the static demo locally:

```bash
python3 -m http.server 8000 --directory public
```

Then open http://localhost:8000/?demo

## Run it with the real backend

Requires Node.js 22.5 or newer (it uses the built-in SQLite module, so there's no database to install).

```bash
npm install
```

```bash
ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='choose-a-strong-password' npm start
```

Open http://localhost:3000. The admin account is created on first start (if `ADMIN_PASSWORD` isn't set, a random one is printed in the console). Data is stored in `data/royal.db`. Set `DATA_DIR` to change that location, and `PORT` to change the port.

## Edit the website content

Everything on the public site comes from **`public/content/site.json`**: business name, contact email/phone/location, Instagram link, services, process steps, previous weddings and testimonials. Add a wedding's unique `slug` and `media` array to make its gallery card open a scrollable detail page. Media items support Instagram posts/reels (`type: "instagram"`), local images (`type: "image"`), and local videos (`type: "video"`). Restart the server after editing it.

**Wedding photos:** put images in `public/images/weddings/` and set each wedding's `"image"`, e.g. `"image": "/images/weddings/priya-arjun.jpg"`. Weddings without a photo show a coloured monogram card in that wedding's `palette` colours. Add video files to `public/videos/`; they are served from `/videos/<filename>`.

> The contact details, wedding names and testimonials currently in `site.json` are **placeholders**. Replace them with your real ones before going live.

## Deploying

Any host that runs a persistent Node process with a writable disk works (Render, Railway, Fly.io, a VPS). Point `DATA_DIR` at a persistent volume so client data survives redeploys, and serve the site over HTTPS (session cookies are marked `Secure` automatically behind HTTPS).
