# Payo — Launch & Announcement Runbook

A self-contained playbook for taking Payo from **zero public presence** →
discoverable. Follow it top to bottom over a ~2-week window.

## Context

Payo (`@uge/payo`) is built and published to npm but has no announcement, no
inbound traffic, no discovery. It is a CLI that interviews a dev about their
stack and generates AI-assistant guidance files (`CLAUDE.md`, `.cursorrules`,
Copilot instructions, `AGENTS.md`, etc.) for Claude, Cursor, Copilot, Codex,
Windsurf, Antigravity.

**Goal:** drive a coordinated launch that produces a first wave of users, GitHub
stars, npm installs, and durable Google ranking for its niche keywords.

**Why this strategy:** Payo is a CLI / OSS / devtool. Research is consistent that
this category wins on **Hacker News + Reddit + niche directories**, *not*
primarily Product Hunt. An HN front-page spot = 10k–30k visitors in hours; a PH
Top-3 finish ≈ 1.5k–2.5k. Concentrating every channel into one 48h window spikes
star velocity, which triggers GitHub's Trending algorithm. Sources at the bottom.

---

## Phase 0 — Pre-launch readiness (do BEFORE announcing)

The single biggest lever: **a 10-second demo GIF/video at the top of the
README.** A CLI you can't *see* working converts poorly. Every source ranks a
"GIF/screenshot showing it working" + "install in under 2 minutes" as table
stakes.

- [ ] **Demo asset** — record an [asciinema](https://asciinema.org) or terminal
      GIF of a full `npx @uge/payo` run (questionnaire → generated files). Embed
      at the top of the README, above the fold. This is the hero asset reused
      everywhere (HN, PH, Reddit, Twitter).
- [ ] **One-sentence hook** — already strong: *"Generate project-tailored AI
      assistant rules & skills in under two minutes."* Keep it identical across
      every channel.
- [ ] **README polish** — add: the demo GIF, a "Why" paragraph (the pain:
      re-pasting "here's how this project works" into every chat), and a short
      comparison vs. hand-writing `CLAUDE.md`.
- [ ] **`npx @uge/payo` works clean on a fresh machine** — test in a clean
      container/VM. First-run friction kills launches. README says Bun >= 1.1.0
      is required — confirm the `npx` path works for Node-only users, or document
      it clearly. This is a common drop-off point.
- [ ] **Repo hygiene** — set GitHub topics (`ai`, `cli`, `claude`, `cursor`,
      `copilot`, `developer-tools`, `codegen`), a clear repo description, a
      social-preview image (Settings → Social preview), and pin a couple of
      "good first issue"s for contributors.
- [ ] **Landing surface for SEO** — enable GitHub Pages or a tiny one-page site
      (the repo already has `docs/`). This becomes the Google-rankable canonical
      URL. Even `uttam-gelot.github.io/payo` works to start.
- [ ] **CHANGELOG / launch tag** — bump to a "launch" version (e.g. `v0.2.0`) so
      the npm page and release notes look intentional, not mid-development.
- [ ] **Seed your network** — line up 5–15 people (friends, colleagues, dev
      Discords you're already in) ready to genuinely try it and star on launch
      day. The first ~100 stars come from people you know; early velocity matters.

---

## Phase 1 — Launch week (concentrated 48h push)

**Timing:** Tuesday or Wednesday. Post to **Hacker News at 8:00–10:00 AM PT** (its
busiest window). Concentrate every channel into the same 48h so simultaneous
traffic spikes star velocity → GitHub Trending.

### Day 1 — channel order

**1. Hacker News — "Show HN" (primary).**
- Title: `Show HN: Payo – generate AI-assistant rules for your project in 2 min`
- No superlatives (no "fastest / best / first"). Modest, builder-to-builder tone.
- Your first comment: the story — why you built it, the exact pain, what it does
  *not* do, what's next. Link the GitHub repo (not a marketing page).
- **Stay in the thread all day.** Answer every comment. Thank critics, ask for
  detail. Do NOT drive-by drop a link and vanish — response quality determines
  trajectory.

**2. Reddit — same morning, native posts (not link spam).** Tailor each post to
the sub's norms; lead with the problem, share as "I made this," invite feedback.
Best-fit subs:
- **r/ClaudeAI** — perfect fit (`CLAUDE.md` generation)
- **r/cursor** — `.cursorrules` generation
- **r/ChatGPTCoding** — broad AI-coding audience
- **r/vibecoding** — high engagement on coding tooling
- **r/webdev** — large, devtool-friendly (read rules; some restrict self-promo)
- **r/programming** — strict; only if the post reads as genuinely interesting,
  not promo, or it can backfire.
- Space these across Day 1–2, not all at once, to avoid spam-filter flags.

**3. Twitter/X + LinkedIn.** A thread: hook + demo GIF + "how it works" + link.
Tag the AI-tool ecosystem (Cursor, Anthropic dev community) where natural. Ask
your network for RTs. Pin the tweet.

### Day 2–3 — secondary directories (extend momentum)

- **Product Hunt** — launch as a *secondary* channel (Tue–Thu, 12:01 AM PT start).
  Good for a backlink + a different audience segment, not the main event.
- **DevHunt** (devhunt.org) — built specifically for dev tools, free.
- **Uneed**, **MicroLaunch**, **Peerlist Launchpad** — more free directory
  launches; each is a backlink + a small traffic burst.
- **dev.to / Hashnode** — publish the launch story as a blog post (see Phase 2).

---

## Phase 2 — Content & SEO (the durable, compounding layer)

Launch spikes decay within 48h; content + SEO keep discovery alive for months.
Payo's niche keywords are **uncontested** right now — own them early.

### Target keywords (build a page/post around each)
- "CLAUDE.md generator" / "how to write a CLAUDE.md"
- "cursor rules generator" / ".cursorrules generator"
- "copilot instructions generator"
- "AGENTS.md generator"
- "AI coding assistant rules / project context generator"

### Content to publish (dev.to, Hashnode, the Pages site — cross-post)
1. **Launch story** — "I built Payo: stop re-explaining your project to your AI."
2. **How-to / evergreen** — "How to write a great CLAUDE.md (and generate one in
   2 minutes)." Ranks for the keyword *and* demos the product.
3. **Comparison** — "CLAUDE.md vs .cursorrules vs AGENTS.md: one config, every AI
   tool" — captures people researching any of the formats.
4. Cross-post each with a canonical URL pointing to your own site to consolidate
   SEO juice.

### Technical SEO
- [ ] Set up **Google Search Console** + submit a sitemap for the Pages site.
- [ ] Title tags / meta descriptions on the landing page targeting the keywords
      above. Run **Lighthouse** (built into Chrome) for a technical pass.
- [ ] Ensure the README's first paragraph contains the target keywords naturally
      — GitHub repos rank well in Google on their own.

### Backlinks (highest-ROI for ranking)
- [ ] Submit Payo to **"awesome" lists** via PR — durable, high-authority
      backlinks *and* steady discovery:
  - awesome-claude / awesome-claude-code
  - awesome-cursor / awesome-cursorrules
  - awesome-ai-coding / awesome-ai-dev-tools
  - awesome-cli-apps
  - awesome-copilot
- [ ] HN, PH, dev.to, and directory listings all add backlinks — the launch
      itself seeds the link graph.

---

## Phase 3 — Sustain (weeks 2–8)

- **Engage, don't disappear.** Answer issues fast, label "good first issue," tag
  releases. Hitting 2 of 3 — usage / contributions / community — signals PMF.
- **Ship visible updates** (new framework / ORM / AI-tool support is the repo's
  whole pitch) and announce each as a small follow-up post. Steady cadence beats
  a single spike.
- **Re-launch on milestones** (v1.0, a new big-name AI tool added) — each is a
  fresh, legitimate HN/Reddit moment.
- **Track:** GitHub stars/velocity ([star-history.com](https://www.star-history.com)),
  npm weekly downloads, Search Console impressions/clicks. Rough week-4 targets
  from the playbooks: 1,000+ installs, 300+ weekly actives, a GitHub Trending
  appearance.

---

## Launch-morning checklist (paste-ready, prepare in advance)

- [ ] HN "Show HN" title written
- [ ] HN first comment (the story) written
- [ ] Reddit post drafts per sub written
- [ ] Tweet thread + demo GIF ready, account pinned
- [ ] PH / DevHunt / Uneed listings drafted
- [ ] Network pinged the night before
- [ ] You're free to sit in threads for ~6 hours after posting

---

## Sources

- [Lessons launching a dev tool: HN vs Product Hunt — Esteban Vargas](https://medium.com/@baristaGeek/lessons-launching-a-developer-tool-on-hacker-news-vs-product-hunt-and-other-channels-27be8784338b)
- [How to launch a dev tool on Hacker News — markepear](https://www.markepear.dev/blog/dev-tool-hacker-news-launch)
- [Launching developer tools on Product Hunt — fmerian gist](https://gist.github.com/fmerian/6c1bca82bcac3c3563d6d4d11051b2be)
- [Promote Your Open Source Project: Step-by-Step Launch Guide — daily.dev](https://business.daily.dev/resources/promote-open-source-project-step-by-step-launch-guide/)
- [How to Get Your First 1,000 GitHub Stars — dev.to](https://dev.to/iris1031/how-to-get-your-first-1000-github-stars-the-complete-open-source-growth-guide-4367)
- [The Playbook for Getting More GitHub Stars — star-history.com](https://www.star-history.com/blog/playbook-for-more-github-stars/)
- [Finding Users for Your Project — Open Source Guides](https://opensource.guide/finding-users/)
- [Marketing for maintainers — GitHub Blog](https://github.blog/open-source/maintainers/marketing-for-maintainers-how-to-promote-your-project-to-both-users-and-contributors/)
- [Best AI coding tools — what Reddit recommends](https://beginnersinai.org/best-ai-coding-tools-reddit-2026/)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Best Product Hunt Alternatives 2026 — startupbase.io](https://startupbase.io/blog/product-hunt-alternatives)
