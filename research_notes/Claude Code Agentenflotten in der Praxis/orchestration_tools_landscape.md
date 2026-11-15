# Orchestration tools landscape: third-party and open-source layers for running many coding/work agents in parallel (state: 14 November 2026)

Method notes for the report writer (apply to every section):

- All GitHub numbers (stars, forks, open issues, created, last push, commits in the last 30 days, latest release, archived flag) were pulled by me from the GitHub REST API on 2026-11-14. "Commits 30d" is capped at 100 by the query, so "100+" means at least 100 on the default branch since 2026-10-15. The cited URL is the repository itself.
- Several repositories have been renamed or moved; the API redirects. I give the name the API returned and the old name in brackets.
- Stars are weak evidence. Where a second, independent signal exists (mentions by practitioners, named users, funding, shutdown notices) I list it. Where it does not, I say so.
- One independent usage signal is my own crude keyword count over all 713 comments of the Hacker News thread "Ask HN: What's your current AI agentic setup?" (2026-11-04, 572 points). It counts comments that mention a term at least once. It is noisy (short words such as "pi", "amp", "orca", "hermes", "cursor" can match unrelated uses) and it only describes HN commenters. Treat it as an order-of-magnitude signal, not a survey.
- Sources older than 12 months (before 2025-11-14) are marked "[older than 12 months]".
- Model and product names (Opus 4.7/4.8, Fable 5, GPT-5.5/6.x, Composer 2.5, Grok 4.5) are reproduced as they appear in the sources.

## Key question 1: Which orchestrators and "agent fleet" tools exist around Claude Code, what is each one's architecture, and which have real adoption?

### Takeaway
Almost every third-party orchestrator is the same pattern (one git worktree plus one terminal/tmux session per agent, with a board or sidebar on top); the differences are in coordination depth, and the tools with the most stars are often not the ones practitioners report using. In the November 2026 HN setup thread, plain Claude Code and Codex with worktrees, tmux and built-in subagents dominate, the always-on personal agents (Hermes, OpenClaw) and newer desktop orchestrators (Orca, Paseo, cmux) get real mentions, while Gas Town, ruflo, Paperclip, Vibe Kanban and Claude Squad are barely mentioned or absent.

### Cited Findings

Independent usage signal (my keyword count, see method notes):

- HN thread "Ask HN: What's your current AI agentic setup?" posted 2026-11-04, 572 points, 714 comments. Comments mentioning each term: Claude Code 153, Codex 144, opencode 99, pi 92 (noisy), Hermes 57, OpenClaw 43, Cursor 36, subagents 33, local models/Ollama 33, Copilot 27, Amp 23, worktree 21, tmux 18, Zed 16, Gemini CLI/Antigravity 13, Orca 12, Paseo 11, Aider 11, Gas Town or Gas City 7, Cline 7, Kilo 6, cmux 5, Goose 5, Devin 4, Conductor 4, Beads 2, ruflo/claude-flow 2, Paperclip 2, Superpowers 2, OpenHands 2, Warp 2, Superset/Paradev 1, n8n 1, Mastra 1; zero for Vibe Kanban, Claude Squad, Emdash, Happy, Jules, Factory/Droid, Ralph, BMAD, spec-kit, LangGraph, CrewAI, Pydantic AI, Roo, Nimbalyst/Crystal — [HN thread](https://news.ycombinator.com/item?id=50366117)

Common architecture:

- A July 2026 comparison of nine orchestrators (written by the author of a competing tool, agentproto, so commercially interested) states that the open-source orchestrators it tested all solve parallel execution through git worktrees and differ mainly in coordination depth — [dev.to, Agentik, 2026-07-14](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
- Peter Steinberger reported the opposite choice for his own work: 3 to 8 agents in a 3x3 terminal grid, most in the same folder, having tried worktrees and gone back to a single folder because it was fastest [older than 12 months, post dated 2025-10-14] — [Simon Willison link blog](https://simonwillison.net/2025/Oct/14/agentic-engineering/)

Gas Town, Beads, Gas City (Steve Yegge):

- Gas Town architecture as described by Maggie Appleton: a "Mayor" that assigns work and never writes code, short-lived worker agents ("Polecats"), a "Witness" that supervises them, a "Refinery" that runs the merge queue and resolves conflicts, maintenance agents ("Deacon", "dogs"), and Beads as git-stored task and identity state so that agent sessions are disposable — [Maggie Appleton, "Gas Town's agent patterns, design bottlenecks, and vibecoding at scale", Jan 2026](https://maggieappleton.com/gastown)
- Gas Town repo: 18,801 stars, 1,700 forks, 525 open issues, created 2025-12-16, MIT. Only 13 commits in the last 30 days, all recent ones dependency and security fixes by one maintainer (julianknutsen); latest release v1.2.1 on 2026-06-06. The README claims "4-10 agents become chaotic" without it and that it lets you "scale comfortably to 20-30 agents" (author claim) — [gastownhall/gastown, formerly steveyegge/gastown](https://github.com/gastownhall/gastown)
- Yegge, quoted by Simon Willison on 2026-08-04 from the essay "The Shape of Things to Come": "Gas Town fell apart at the seams with Opus 4.7"; "The Opus tic never went away, so Gas Town effectively burned down"; it "was intended to be reusable, but I only ever wound up using it to build itself" — [Simon Willison, 2026-08-04](https://simonwillison.net/2026/Aug/4/steve-yegge/)
- A commentary on the same essays quotes Yegge: "I have given up on building reusable harnesses" and says Gas Town was replaced by "Wheelhouse", a closed-source harness he built for himself — [Vanja Petreski, undated, approx. Nov 2026](https://vanja.io/yegge-agent-city-four-claims/)
- Appleton's verdict: Gas Town is "entirely vibecoded, hastily designed with off-the-cuff solutions", not "a serious, working tool for today's developers", and Yegge "warned me not to seriously use Gas Town multiple times"; she had not used it on serious work herself — [Maggie Appleton](https://maggieappleton.com/gastown)
- Beads architecture: "Distributed graph issue tracker for AI agents, powered by Dolt"; agents create beads, query `bd ready` for claimable work, claim, close, and sync via Dolt push/pull. 28,733 stars, 1,942 forks, 1,797 open issues, created 2025-10-12, 100+ commits in the last 30 days, release v1.3.4 on 2026-11-04 — [gastownhall/beads, formerly steveyegge/beads](https://github.com/gastownhall/beads)
- Yegge on Beads: "The complicated Beads CLI isn't for humans; it's for agents"; it has over 100 subcommands — [Simon Willison, 2026-01-30](https://simonwillison.net/2026/Jan/30/steve-yegge/)
- Counter-signal on Beads: a Show HN for a simpler Markdown-based replacement ("I replaced Beads with a faster, simpler Markdown-based task tracker") reached 84 points on 2026-01-04 — [HN](https://news.ycombinator.com/item?id=46487580)
- Gas City: "Orchestration-builder SDK for multi-agent coding workflows", MIT, "stewarded by Gas City, Inc."; installs `gc`, `bd`, `dolt`, `tmux`; work is defined as "formulas" with review gates. 1,529 stars, 475 forks, 1,769 open issues, created 2026-02-22, actively pushed — [gastownhall/gascity](https://github.com/gastownhall/gascity)
- Every's hands-on review of Gas City (2026-05-19, Katie Parrott, with Every's head of tech consulting Mike Taylor): verdict "Learn from the ideas. Skip the toolkit for now."; a room of experienced engineers needed a full day to get it running with instructor help; each task starts a fresh session with no memory of earlier steps; "A six-step job can cost six times the cost of one Claude session"; production teams pair CLI-only Beads with Jira or Linear — [Every, Context Window](https://every.to/context-window/inside-the-100-agent-software-factory)

Claude Squad:

- Architecture per README: a terminal app that manages multiple Claude Code, Codex, Gemini and Aider instances, using "tmux to create isolated terminal sessions for each agent" and "git worktrees to isolate codebases so each session works on its own branch"; has an experimental auto-accept flag. 8,810 stars, 634 forks, 52 open issues, AGPL-3.0, created 2025-03-09; 1 commit in the last 30 days; latest release v1.0.20 on 2026-08-20 — [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad)
- A competitor's comparison says it has no API, "caps at roughly 2-5 agents" in practice and stops working when the screen locks (commercially interested author) — [dev.to, Agentik, 2026-07-14](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)

Conductor (Melty Inc.):

- Closed-source Mac app that runs Claude Code, Codex and Cursor side by side in git-worktree workspaces; launched July 2025; company claims more than 100,000 users (company claim on its website, relayed by SiliconANGLE via the article); raised a $22M Series A in March 2026 led by Spark Capital and Matrix (per TechCrunch, relayed) — [Let's Data Science, 2026-11-06](https://letsdatascience.com/blog/meta-openai-bought-coding-tools-same-day-one-shutting-down)
- Meta acquired Conductor, announced 2026-11-04; new sign-ups stopped; Conductor Cloud read-only from 2026-11-13 and shut down from 2026-11-20; the local app gets model updates and critical fixes until early 2027 and then winds down; terms undisclosed — [InfoWorld, 2026-11-05](https://www.infoworld.com/article/4245065/meta-acquires-conductor-as-ai-coding-shifts-toward-multi-agent-development.html)

Vibe Kanban (Bloop):

- Kanban board that dispatches tasks to coding agents in isolated workspaces. 28,689 stars, 3,063 forks, 536 open issues, Apache-2.0, created 2025-06-14; latest release v0.1.44 on 2026-04-24; 11 commits in the last 30 days, almost all by a single contributor — [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)
- Company shutdown notice of 2026-04-10 signed by co-founder Louis Knight-Webb: "we couldn't find a business model that we could get excited about"; "Thousands of software engineers use Vibe Kanban every day" (company claim), the vast majority free users; remote services ended after 30 days; "The Vibe Kanban project will live on, open source and community maintained" — [vibekanban.com](https://vibekanban.com/blog/shutdown)

Crystal and Nimbalyst:

- Crystal: 3,128 stars, last commit and last release (v0.3.5) both 2026-02-26, zero commits in the last 30 days — [stravu/crystal](https://github.com/stravu/crystal)
- Crystal was deprecated in February 2026 with Nimbalyst as its successor (per a competitor's comparison) — [dev.to, Agentik, 2026-07-14](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
- Nimbalyst: "open-source visual workspace for Claude Code, Codex, and OpenCode", 2,071 stars, 842 open issues, created 2025-10-30, active — [nimbalyst/nimbalyst](https://github.com/nimbalyst/nimbalyst)

claude-flow / ruflo:

- 81,692 stars, 9,627 forks, 591 open issues, MIT, created 2025-06-02, 100+ commits in the last 30 days, release v3.77.1 on 2026-11-13 — [ruvnet/ruflo, formerly ruvnet/claude-flow](https://github.com/ruvnet/ruflo)
- Independent source-code audit (gist by roman-rr, created 2026-04-03, updated 2026-07-01, 12 comments), titled "300+ MCP Tools — 99% Theater, 1% Real, 5x Token Waste": of 300+ MCP tools "~10 are real. The rest are JSON state stubs with no execution backend"; the "hive-mind" is `child_process.spawn('claude', ['--dangerously-skip-permissions', '<big prompt>'])`; "neural training" returns `Math.random()` accuracy; `agent_spawn` only creates a map entry and five spawned agents stayed idle. Single-author audit, not independently replicated by me — [gist](https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6)
- Security issue "Security Audit Summary: Multiple Critical Concerns" (opened 2026-03-17, closed) reports that MCP tool descriptions contained hidden instructions directing the model to add the repository owner as a contributor to users' repositories — [ruvnet/ruflo issue 1375](https://github.com/ruvnet/ruflo/issues/1375)
- The maintainer responded in a GitHub discussion — [ruvnet/ruflo discussion 1513](https://github.com/ruvnet/ruflo/discussions/1513)

Claude Code Agent Farm and tmux-based orchestrators:

- Agent Farm architecture per README: a batch runner that launches Claude Code agents in tmux with `--dangerously-skip-permissions`, coordinated through a `/coordination/` directory with a work registry and per-agent lock files; claims "Run 20+ Claude Code agents simultaneously (up to 50 with `max_agents` config)" (author claim). 923 stars, no commits in the last 30 days, last commit 2026-09-21, no formal releases — [Dicklesworthstone/claude_code_agent_farm](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- Tmux-Orchestrator: 1,817 stars, last push 2025-07-14 [older than 12 months], effectively abandoned — [Jedward23/Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator)
- cmux: Ghostty-based terminal with vertical tabs and notifications for agent sessions; 28,794 stars, 6,906 open issues, created 2026-01-28, 100+ commits in the last 30 days; Show HN reached 198 points on 2026-02-19 — [manaflow-ai/cmux](https://github.com/manaflow-ai/cmux); [HN](https://news.ycombinator.com/item?id=47079718)
- A practitioner write-up of the do-it-yourself approach ("Parallel coding agents with tmux and Markdown specs") reached 189 points and 131 comments on HN on 2026-03-02 — [HN](https://news.ycombinator.com/item?id=47218318); [post](https://schipper.ai/posts/parallel-coding-agents/)
- Other small tmux/worktree managers: ccmanager 1,278 stars; ccswarm 157 stars; multiclaude 567 stars with last push 2026-01-28 — [kbwo/ccmanager](https://github.com/kbwo/ccmanager); [nwiizo/ccswarm](https://github.com/nwiizo/ccswarm); [dlorenc/multiclaude](https://github.com/dlorenc/multiclaude)

Desktop and mobile orchestrators that became prominent in 2026:

- Orca (Stably AI): desktop app that runs Claude Code, Codex and other agents in parallel, each in its own worktree, with an orchestrating agent that splits work and starts workers, remote server/SSH/cloud-VM options and a mobile app. 124,879 stars, 7,913 forks, 8,468 open issues, created 2026-03-17. The star count is extraordinary for an 8-month-old project and I could not verify its authenticity; the 12 HN mentions are an independent sign of real use — [stablyai/orca](https://github.com/stablyai/orca)
- Paseo: local daemon with desktop, mobile, web and CLI clients; agents in worktrees; agents can launch and message other agents across providers; no telemetry. 24,052 stars, 2,081 open issues, created 2025-10-13 — [getpaseo/paseo](https://github.com/getpaseo/paseo)
- Paradev (formerly Superset, YC): "open-source Codex App and Conductor alternative". 16,301 stars, 1,298 open issues, created 2025-10-21. Show HN "Terminal to run 10 parallel coding agents" on 2025-12-23 (96 points); Launch HN "Superset (YC P26) – IDE for the agents era" on 2026-05-22 (108 points, 135 comments) — [ParadevAI/Paradev, formerly superset-sh/superset](https://github.com/ParadevAI/Paradev); [HN launch](https://news.ycombinator.com/item?id=48236770)
- Orchestrator.inc agent-orchestrator: local desktop workspace where a main agent plans, starts one worker per piece in its own worktree, and routes failed CI checks, review comments and merge conflicts back to the worker that owns the branch; optional reviewer agent. 14,664 stars, 995 open issues, created 2026-02-13, release v0.15.1 on 2026-11-14 — [OrchestratorInc/agent-orchestrator, formerly ComposioHQ/agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator)
- Emdash: 6,251 stars, Apache-2.0, active; Show HN 206 points on 2026-02-24 — [generalaction/emdash](https://github.com/generalaction/emdash); [HN](https://news.ycombinator.com/item?id=47140322)
- Happy (mobile/remote client for Claude Code and Codex): 24,641 stars, active — [slopus/happy](https://github.com/slopus/happy)
- Smaller or niche: coder's desktop app for isolated parallel agents 2,077 stars (API now returns the name coder/xum for coder/mux); Dagger container-use 4,092 stars; HumanLayer 12,879 stars; Imbue Sculptor 246 stars; Omnara 3,396 stars, now positioned as a self-hostable managed-agent platform — [coder/mux](https://github.com/coder/mux); [dagger/container-use](https://github.com/dagger/container-use); [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer); [imbue-ai/sculptor](https://github.com/imbue-ai/sculptor); [omnara-ai/omnara](https://github.com/omnara-ai/omnara)
- A community index of the category exists with 2,424 stars — [andyrewlee/awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)

Always-on personal agents (OpenClaw style):

- OpenClaw: 394,447 stars, 82,889 forks, 8,326 open issues, MIT, created 2025-11-24, 100+ commits in the last 30 days — [openclaw/openclaw](https://github.com/openclaw/openclaw)
- Peter Steinberger joined OpenAI in February 2026 to work on personal agents; OpenClaw was to move to an independent foundation with OpenAI support — [Decrypt](https://decrypt.co/358141/openai-openclaw-founder-lead-push-personal-ai-agents)
- Provider conflict: "Tell HN: Anthropic no longer allowing Claude Code subscriptions to use OpenClaw" (2026-04-03, 1,099 points, 827 comments); "Google restricting Google AI Pro/Ultra subscribers for using OpenClaw" (2026-02-22, 802 points); "Claude Code refuses requests or charges extra if your commits mention 'OpenClaw'" (2026-04-30, 1,349 points) — [HN 47633396](https://news.ycombinator.com/item?id=47633396); [HN 47115805](https://news.ycombinator.com/item?id=47115805); [HN 47963204](https://news.ycombinator.com/item?id=47963204)
- Security: privilege escalation vulnerability CVE-2026-33579 (HN 2026-04-03, 514 points) — [NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-33579); [HN](https://news.ycombinator.com/item?id=47628608). Press coverage reports a Gartner advisory calling the risks "unacceptable" and the design "insecure by default" (secondary report) — [SlashGear](https://www.slashgear.com/2095067/openclaw-ai-agent-popularity-security-concerns)
- Hermes Agent (Nous Research): 263,342 stars, 59,353 forks, 53,349 open issues, created 2025-07-22; publishes a "Migrate from OpenClaw" guide that reached 122 points on HN on 2026-06-18 — [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent); [HN](https://news.ycombinator.com/item?id=48586005)
- Container-isolated or minimal clones: NanoClaw 31,116 stars; ZeroClaw 33,365 stars; PicoClaw 30,131 stars — [nanocoai/nanoclaw](https://github.com/nanocoai/nanoclaw); [zeroclaw-labs/zeroclaw](https://github.com/zeroclaw-labs/zeroclaw); [sipeed/picoclaw](https://github.com/sipeed/picoclaw)
- Pi, the minimal harness underneath many of these setups: 121,999 stars — [earendil-works/pi, formerly badlogic/pi-mono](https://github.com/earendil-works/pi)

"AI company" orchestrators (Paperclip):

- Paperclip architecture per README: "a Node.js server and React UI that orchestrates a team of AI agents to run a business"; org charts, per-agent budgets, governance, heartbeats; adapters for OpenClaw, Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Pi, Hermes; tagline "If OpenClaw is an employee, Paperclip is the company"; headline now reads "the app people use to manage AI agents for work"; a hosted "Paperclip Cloud" is on a waitlist. 113,886 stars, 18,899 forks, 6,655 open issues, MIT, created 2026-03-02, 100+ commits in the last 30 days — [paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- Reviews found by search (blogs, not long-running case studies) say the "zero-human" framing is aspirational, that governance "catches structure, not quality", that output needed human review at every step, and that the most-cited complaint is token burn from agents checking in with each other. I did not fetch each review, so the mapping of each statement to a specific page is unverified — [eesel.ai review](https://www.eesel.ai/blog/paperclip-ai-review); [preuve.ai review](https://preuve.ai/blog/paperclip-ai-review); [fast.io review](https://fast.io/resources/paperclip-ai-review-2026/)

Methodology and skill packs often confused with orchestrators (they shape one agent's workflow or its subagents, they do not run a fleet):

- obra/superpowers 317,547 stars; github/spec-kit 149,781; BMAD-METHOD 55,366; wshobson/agents 42,507; oh-my-claudecode 40,824; oh-my-openagent (formerly oh-my-opencode) 70,911; snarktank/ralph 22,228 with last push 2026-02-02; ralph-orchestrator 3,203; ccpm 8,448 — [obra/superpowers](https://github.com/obra/superpowers); [github/spec-kit](https://github.com/github/spec-kit); [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD); [wshobson/agents](https://github.com/wshobson/agents); [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode); [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent); [snarktank/ralph](https://github.com/snarktank/ralph); [mikeyobrien/ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator); [automazeio/ccpm](https://github.com/automazeio/ccpm)
- get-shit-done: 64,136 stars, repository archived, last push 2026-05-31 — [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)

Alternative harnesses that the orchestrators drive:

- opencode 226,834 stars; openai/codex 135,284; anthropics/claude-code 155,659; cline 71,627; goose 56,608; aider 50,120 with last push 2026-05-22 — [anomalyco/opencode, formerly sst/opencode](https://github.com/anomalyco/opencode); [openai/codex](https://github.com/openai/codex); [anthropics/claude-code](https://github.com/anthropics/claude-code); [cline/cline](https://github.com/cline/cline); [aaif-goose/goose](https://github.com/aaif-goose/goose); [Aider-AI/aider](https://github.com/Aider-AI/aider)

### Inferences

Ranked comparison (my synthesis; the ranking is an inference from the evidence above, weighting independent usage signals over stars):

| Rank | Tool or pattern | Evidence of real use | Maturity and main caveat |
|---|---|---|---|
| 1 | No third-party orchestrator: Claude Code or Codex with worktrees, tmux and built-in subagents | Dominant in the Nov 2026 HN thread (Claude Code 153, Codex 144, subagents 33, worktree 21, tmux 18) | Mature; ceiling is the human, see key question 6 |
| 2 | Always-on personal agents: Hermes, OpenClaw (plus Pi as base) | 57 and 43 HN mentions; 263k and 394k stars | Widely used but security record is poor (CVE, "insecure by default") and Anthropic and Google restricted subscription use in 2026 |
| 3 | Desktop/mobile worktree orchestrators: Orca, Paseo, cmux, Paradev (ex-Superset), Orchestrator.inc, Emdash | 12, 11 and 5 HN mentions for the first three; YC backing for Superset; very active repos | Young (most created 2025-10 to 2026-03), thousands of open issues; Orca's star count unverifiable |
| 4 | Conductor | Company claims 100,000+ users; $22M Series A | Acquired by Meta 2026-11-04; cloud shut down this month, app winds down early 2027. Not a choice for new adoption |
| 5 | Beads | 28.7k stars, 100+ commits/30d, used as the memory layer of Gas City | Real, but CLI-only and agent-oriented; 1,797 open issues; simpler replacements exist |
| 6 | Gas City | Its builders run about 100 agents (see key question 4); 1.5k stars | Independent reviewer: "Skip the toolkit for now"; a full day of setup for experienced engineers |
| 7 | Vibe Kanban | 28.7k stars; "thousands" of daily users claimed in April 2026 | Company shut down 2026-04-10; one main contributor now; zero HN mentions in Nov 2026 |
| 8 | Claude Squad | 8.8k stars | 1 commit in 30 days; practical cap of 2 to 5 agents per a competitor; zero HN mentions |
| 9 | Paperclip | 114k stars, very active repo | Only 2 HN mentions; no audited production case found; token burn and quality complaints |
| 10 | ruflo / claude-flow | 82k stars, daily releases | An independent code audit calls most of it stubs; a reported prompt-injection issue; 2 HN mentions. Strongest stars-versus-substance gap in the field |
| 11 | Gas Town | 18.8k stars | Declared "effectively burned down" by its author in Aug 2026; repo in security-fix maintenance |
| 12 | Claude Code Agent Farm, Tmux-Orchestrator, Crystal, GSD | 0.9k to 64k stars | Stalled, abandoned, deprecated or archived |

- Star counts and practitioner mentions diverge sharply: the three most-starred orchestration-adjacent projects that are not harnesses or personal agents (Superpowers 318k, Paperclip 114k, ruflo 82k) have 2 mentions each in a 713-comment practitioner thread, while tmux and worktrees have 18 and 21.
- The business model for a standalone orchestration layer looks fragile: Bloop shut down for lack of one, Conductor was absorbed by Meta, Terragon shut down (see key question 5). The surviving open-source projects are either community-run or have a hosted product on a waitlist.
- Gas Town's failure after a model upgrade suggests that orchestrators built around the quirks of one model generation (heavy supervision, check-ins, review loops) age quickly; the Every review makes the same point about Gas City's hand-holding assumptions.

### Gaps
- No independent download, install or telemetry numbers for any open-source orchestrator. All user counts (Conductor 100,000+, Vibe Kanban "thousands daily") are company claims.
- I could not verify whether star counts of Orca, Paperclip, ruflo, OpenClaw or Hermes are organic. A CMU study on fake GitHub stars is referenced in a secondary article I did not verify, and nothing I found ties any named project to bought stars.
- Funding for Orca (Stably AI), Paseo, Orchestrator.inc, Paperclip and Gas City, Inc. was not found.
- I did not find the reason the get-shit-done repository was archived, or the date and reason for the Superset to Paradev and ComposioHQ to OrchestratorInc renames.
- Claims that a meme coin tied to Gas Town crashed appeared only in secondary commentary and HN comments; unverified.
- An earlier statement attributed to Yegge that he moved all workflows from Gas Town to Gas City in May 2026 came from a mirror page I did not fetch; it sits uneasily with the later report that he now uses a private harness ("Wheelhouse"). The sequence is not confirmed from primary text.
- Claude's own first-party fleet features (agent teams, managed agents, cloud sessions) were out of scope here and are not assessed.

## Key question 2: Which competing first-party fleet products exist, and how do they compare for running many agents at once (concurrency limits, pricing)?

### Takeaway
Only Google Jules and Devin publish hard concurrency caps (Jules 3/15/60 by plan; Devin "up to 10" on lower plans, unlimited on higher ones); Cursor explicitly publishes no cap and bills by usage; Codex publishes allowances but no concurrency limit. In practice the binding limit for all of them is the usage allowance or the token bill, and GitHub had to pause Copilot sign-ups in April 2026 because parallel agent sessions broke flat-rate economics.

### Cited Findings
- Google Jules (official limits page, fetched 2026-11-14): daily tasks 15 / 100 / 300 and concurrent tasks 3 / 15 / 60 for Jules free / Jules in Google AI Pro / Jules in Google AI Ultra; paid plans only for individual Google accounts — [jules.google docs](https://jules.google/docs/usage-limits/)
- Devin (official pricing page, fetched 2026-11-14): Free $0; Pro $20/month; Max $200/month; Teams $80/month plus $40/month per full dev seat (up to 100 users); Enterprise on request. A "Concurrent sessions limit" row lists "Up to 10", "Up to 10", "Unlimited", "Unlimited" (mapping to the five plans not unambiguous in the fetched page); "2 concurrent sessions in Free mode per user"; extra usage "consumed at API pricing". Third-party guides still quote older ACU-based prices ($2.25 per ACU, $500 Team plan), which conflict with the current page — [devin.ai/pricing](https://devin.ai/pricing)
- Cursor cloud agents (official docs, fetched 2026-11-14): "You can run as many agents as you want in parallel"; agents run in "isolated VMs in the cloud"; "Cloud Agents use your plan's usage like other agent work"; users are asked to set a spend limit on first use; "You need a plan that includes Cloud Agents: Premium and higher, Teams, Enterprise, or a legacy paid plan" — [cursor.com docs](https://cursor.com/docs/cloud-agent)
- OpenAI Codex (official pricing page, fetched 2026-11-14): Free $0; Go $8/month; Plus $20/month; Pro "from $100/month" (tiers at $100, $200, $500); Business $20/user/month billed annually; Enterprise/Edu by contract; API key at API prices. Usage is given as estimated ranges per five-hour window for Plus/Business and by credits per million tokens; "Cloud tasks may use more of your allowance than local messages"; no concurrency limit for cloud tasks is published — [Codex pricing](https://learn.chatgpt.com/docs/pricing)
- The Codex desktop app runs several independent tasks per project in Codex-managed git worktrees — [OpenAI Codex docs, worktrees](https://developers.openai.com/codex/app/worktrees)
- GitHub Copilot: "mission control" in Agent HQ lets users assign, steer and track many coding-agent tasks from one view (changelog 2025-11-27); GitHub's own guidance warns that parallel agents touching the same files cause merge conflicts and that work must be partitioned — [GitHub changelog](https://github.blog/changelog/2025-11-27-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/); [GitHub blog](https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/)
- GitHub paused new sign-ups for Copilot Pro, Pro+ and Student plans and tightened usage limits in April 2026, citing compute demand from long-running, parallel agent sessions — [GitHub blog](https://github.blog/news-insights/company-news/changes-to-github-copilot-individual-plans/); [InfoWorld](https://www.infoworld.com/article/4161278/github-s-new-copilot-sign-ups-as-agentic-ai-strains-infrastructure.html)
- Factory: "Missions" is a multi-agent layer in which Mission Control coordinates orchestrator, worker and validator agents; Missions draw on the same rolling rate limits as normal sessions, require Extra Usage to be enabled and pause when a rate limit is hit; plans listed as Pro, Plus, Max, Teams, Business, Enterprise (third-party price figures conflict, e.g. Teams at $46 or $60 per seat) — [Factory pricing docs](https://docs.factory.ai/pricing.md)
- Amp was spun out of Sourcegraph into an independent company in December 2025 and describes itself as profitable (company claim) — [ampcode.com](https://ampcode.com/news/amp-inc)
- OpenHands: 93,465 stars, 12,510 forks, MIT, active — [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)
- Relative mindshare among practitioners in the Nov 2026 HN thread: Codex 144, Cursor 36, Copilot 27, Amp 23, Devin 4, OpenHands 2, Warp 2, Jules 0, Factory 0 — [HN thread](https://news.ycombinator.com/item?id=50366117)

### Inferences
- For "many at once", the first-party products split into two models: capped concurrency inside a subscription (Jules, Devin) and uncapped concurrency that is metered by usage (Cursor, Codex credits, Factory Extra Usage). The second model moves the limit from a counter to the bill.
- Jules Ultra's 60 concurrent tasks is the highest published first-party cap I found; whether anyone usefully supervises 60 is a different question (key question 6).
- The Copilot sign-up pause is the clearest first-party admission that flat-rate plans and agent fleets do not fit together, which matches Anthropic's and Google's 2026 restrictions on third-party harnesses using subscriptions.

### Gaps
- No official concurrency or pricing data retrieved for Warp, Replit Agent, OpenHands Cloud or Amp; searches returned nothing usable. These are open.
- No official figure for GitHub Copilot coding agent concurrency; a thin secondary source mentions administrator-controlled session limits added 2026-07-01, unverified.
- Cursor plan names in the official docs ("Premium and higher") differ from third-party guides (Pro $20, Pro+ $60, Ultra $200); I did not fetch cursor.com/pricing, so current prices are unconfirmed.
- A third-party claim that Codex teams can "queue 3 to 5 tasks at once" has no official source.

## Key question 3: General-purpose multi-agent frameworks for business workflows: which have documented production use at scale and which are mostly demos?

### Takeaway
LangGraph and n8n have the best-documented production use, though the evidence is mostly vendor-published case studies and financing rather than independent audits; CrewAI's very large usage numbers are self-reported and inconsistent; AutoGen was put into maintenance mode in favour of Microsoft Agent Framework (GA April 2026); for OpenAI Agents SDK and Pydantic AI I found no named production users at all.

### Cited Findings
- LangGraph: 44,959 stars, MIT, active — [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph). Vendor post [older than 12 months, 2025-02-04] names production users: LinkedIn (AI recruiter with a hierarchical agent system), AppFolio (copilot saving property managers "over 10 hours a week", decision accuracy doubled), Replit (agent with human-in-the-loop), Uber (large-scale code migrations and unit-test generation), Elastic (threat-detection agents). Only AppFolio has quantified results; source is LangChain itself, which sells LangGraph and LangSmith — [LangChain blog](https://www.langchain.com/blog/is-langgraph-used-in-production)
- CrewAI: 60,894 stars, MIT, active — [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI). Total funding consistently reported as $18M including a Series A led by Insight Partners in 2024 [older than 12 months] — [Pulse 2.0](https://pulse2.com/crewai-multi-agent-platform-raises-18-million-series-a). CrewAI's own OSS 1.0 post claims use by 60%+ of the Fortune 500 (vendor claim) — [CrewAI blog](https://blog.crewai.com/crewai-oss-1-0-we-are-going-ga/). Execution-volume figures in secondary sources range from 10M+ agents per month (2024) to 450M+ runs per month and about 2 billion executions in 12 months, with inconsistent definitions — [agentmarketcap.ai, 2026-04-06](https://agentmarketcap.ai/blog/2026/04/06/crewai-stealth-dominance-10m-agent-runs-fortune-500-open-source)
- AutoGen: 61,817 stars — [microsoft/autogen](https://github.com/microsoft/autogen). Microsoft said AutoGen and Semantic Kernel "remain in maintenance mode, which means they will not receive new feature investments but will continue to receive bug fixes, security patches and stability updates" — [VentureBeat](https://venturebeat.com/ai/microsoft-retires-autogen-and-debuts-agent-framework-to-unify-and-govern)
- Microsoft Agent Framework: 14,675 stars, MIT — [microsoft/agent-framework](https://github.com/microsoft/agent-framework). Version 1.0 reached general availability for .NET and Python in early April 2026 — [Visual Studio Magazine, 2026-04-06](https://visualstudiomagazine.com/articles/2026/04/06/microsoft-ships-production-ready-agent-framework-1-0-for-net-and-python.aspx). InfoQ reported in August 2026 that the agent harness and Foundry Hosted Agents had also reached GA (single source) — [InfoQ](https://infoq.com/news/2026/08/agent-framework-harness-ga)
- OpenAI Agents SDK: 30,682 stars, only 42 open issues, active — [openai/openai-agents-python](https://github.com/openai/openai-agents-python)
- Mastra: 29,520 stars, active — [mastra-ai/mastra](https://github.com/mastra-ai/mastra). Secondary blogs name Replit, PayPal, Adobe, Sanity, Marsh McLennan, Factorial, Counsel Health, Cedar and SoftBank as production users; I did not verify these against primary customer statements, and the exact page for each name is unconfirmed — [noqta.tn guide](https://noqta.tn/en/blog/mastra-typescript-ai-agent-framework-guide-2026); [vendor blog](https://mastra.ai/blog/best-ai-agent-frameworks)
- Pydantic AI: 21,209 stars, 1,973 open issues, active — [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai)
- n8n: 210,478 stars — [n8n-io/n8n](https://github.com/n8n-io/n8n). Sacra reports a $180M Series C in October 2025 at a $2.5B valuation, an SAP investment of more than EUR 60M at a $5.2B valuation in May 2026, and estimates $100M ARR in April 2026, up from $70M at end of 2025 (analyst estimates, not company filings) — [Sacra](https://sacra.com/research/n8n)
- Other frameworks by stars, for scale: Agno 43,190; LangChain deepagents 31,282; Semantic Kernel 28,762; Letta 25,437; Google ADK 22,216; VoltAgent 10,978; Strands 9,209 — [agno-agi/agno](https://github.com/agno-agi/agno); [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents); [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel); [letta-ai/letta](https://github.com/letta-ai/letta); [google/adk-python](https://github.com/google/adk-python); [VoltAgent/voltagent](https://github.com/VoltAgent/voltagent); [strands-agents/harness-sdk](https://github.com/strands-agents/harness-sdk)
- A widely repeated pattern in comparison blogs is "prototype in CrewAI, move production-critical parts to LangGraph" because of LangGraph's checkpointing, interrupts and explicit error-handling edges; these are opinion pieces, several vendor-adjacent — [Redwerk](https://redwerk.com/blog/langgraph-vs-crewai/)

### Inferences
- "Documented production use" for these frameworks means, almost without exception, documented by the vendor. LangGraph has the most specific named cases, but its flagship list is from February 2025. n8n's evidence is commercial (revenue estimates, strategic investor) rather than agent-specific.
- None of the framework case studies I found describes 10 to 100+ concurrently running autonomous agents under one supervisor. They describe pipelines of a few specialised agents inside a product. They answer a different question than the coding-fleet tools.
- CrewAI's contrast (60k stars, Fortune 500 claims in the hundreds of millions of runs, $18M raised and no later round found) is a pattern that deserves scepticism until a named customer confirms scale.
- The absence of LangGraph, CrewAI and Pydantic AI from the HN setup thread is not evidence against them: that thread asked about personal developer setups, not business workflow automation.

### Gaps
- No independent (non-vendor) case study with numbers was found for any framework.
- No named production users found for OpenAI Agents SDK or Pydantic AI.
- No named n8n customers running AI-agent workflows at scale were found; the financial data says nothing about agent workloads specifically.
- A LangChain survey figure (57% of 1,340 engineers say they run agents in production) appeared only in a search summary; I did not locate or verify the primary survey.
- Mastra funding was not found.

## Key question 4: For each tool, what is the largest credibly documented number of concurrent agents, who reported it, what did it cost, and what failure modes do users report?

### Takeaway
The largest documented runs are vendor research projects, not third-party orchestrators: Cursor reports hundreds of concurrent agents (over a thousand touching one file in a failed run) at $1,339 to $10,565 per project, and Anthropic reports 16 agents for just under $20,000. The largest figure for an open-source orchestrator is about 100 agents on Gas City's own builders' server, burning roughly a billion tokens a day. For every other third-party tool the numbers are README claims of 10 to 50 with no independent confirmation.

### Cited Findings

Documented scale and cost:

- Cursor, January 2026 research: "hundreds of concurrent agents" on one codebase for close to a week, over a million lines of code across about 1,000 files to build a browser; Cursor itself called the result a proof of concept (vendor research) — [Cursor blog](https://cursor.com/blog/scaling-agents); [Fortune, 2026-01-23](https://fortune.com/2026/01/23/cursor-built-web-browser-with-swarm-ai-agents-powered-openai/)
- Cursor, 2026-07-20 (Wilson Lin), SQLite-compatible database in Rust from the 835-page manual: total cost $10,565 with GPT-5.5 as planner and worker; $1,339 with Opus 4.8 as planner and Composer 2.5 as worker (workers $411); workers consumed at least 69% and usually over 90% of tokens. Failure data from the earlier run: "more than 70,000 conflicts" before it was paused, the hottest file had 7,771 conflicts from 1,173 agents, 68,000 commits in two hours that were mostly busywork, sprawl to 54 crates including three separate SQL packages, "runaway spirals" with one model. Fixes: planner/worker hierarchy, neutral conflict-resolver agent, a custom version control system, stacked review agents — [Cursor blog](https://cursor.com/blog/agent-swarm-model-economics)
- Anthropic, 2026-02-05 (Nicholas Carlini): 16 parallel Claude agents, "nearly 2,000 Claude Code sessions", "just under $20,000" in API costs, 2 billion input and 140 million output tokens, a 100,000-line C compiler. Coordination: one Docker container per agent, a shared bare git repo, task claims via lock files in `current_tasks/`, a bash loop restarting sessions, no orchestrator agent. Failures: "Merge conflicts are frequent", new features broke existing ones, all agents hit the same Linux-kernel bug and overwrote each other, context pollution from test output, hours spent running tests without progress, one agent ran `pkill -9 bash` and killed itself (vendor research) — [Anthropic engineering blog](https://www.anthropic.com/engineering/building-c-compiler)
- Gas City: maintainer Julian Knutsen's server "runs roughly 100 agents" that "merge around 50 pull requests per day" while "burning through roughly a billion tokens per day"; no dollar figure given. Reported by Every (independent publication that also sells consulting and workshops) about the tool's own maintainer (commercial interest: Gas City, Inc.) — [Every, 2026-05-19](https://every.to/context-window/inside-the-100-agent-software-factory)
- Gas Town: Yegge ran "dozens of coding agents simultaneously", "inefficiently burning through thousands of dollars a month in API costs"; "17 days, 75k lines of code, 2000 commits" (reported by Appleton from Yegge's own statements); README claims 20 to 30 agents — [Maggie Appleton](https://maggieappleton.com/gastown); [gastownhall/gastown](https://github.com/gastownhall/gastown)
- Claude Code Agent Farm: "20+ ... up to 50" agents (author's README claim, no independent report found) — [repo](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- Superset/Paradev: "run 10 parallel coding agents" (vendor Show HN title) — [HN](https://news.ycombinator.com/item?id=46368739)
- Claude Squad: practical cap "roughly 2-5 agents" (competitor's assessment) — [dev.to, Agentik](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
- Paperclip: README targets users with "20 simultaneous Claude Code terminals"; a hands-on report of a five-agent test company across three providers put daily cost under $4 (single secondary report, exact page unverified) — [paperclipai/paperclip](https://github.com/paperclipai/paperclip); [fast.io review](https://fast.io/resources/paperclip-ai-review-2026/)
- First-party published caps: Jules 60 concurrent tasks on Ultra; Devin "unlimited" on upper plans; Cursor "as many agents as you want" — [Jules](https://jules.google/docs/usage-limits/); [Devin](https://devin.ai/pricing); [Cursor](https://cursor.com/docs/cloud-agent)
- Self-reports from HN commenters (Nov 2026): one "fleet of 10 agents" on a translation project; one "5-8 agents going at any given moment" at work with in-house frameworks; one who claims to "concurrently manage 10-100 agents" with a tool he is building himself (commercial interest disclosed in the comment) — [HN thread](https://news.ycombinator.com/item?id=50366117)

Failure modes reported by users:

- Unconsented token spend and actions: a Gas Town user reported that shipped release formulas made his installation work on the maintainer's own GitHub issues and open PRs against the upstream repo using his Claude usage and GitHub account, and asked for it to be opt-in; another commenter disputed that it is on by default (issue opened 2026-04-14, closed; HN discussion 253 points) — [gastown issue 3649](https://github.com/gastownhall/gastown/issues/3649); [HN](https://news.ycombinator.com/item?id=47785053)
- Model-upgrade fragility: Gas Town stopped converging after Opus 4.7 because the model kept adding "just two more things" to the orchestrator itself — [Simon Willison, 2026-08-04](https://simonwillison.net/2026/Aug/4/steve-yegge/)
- Lost context between steps and multiplied cost: fresh session per task in Gas City; "A six-step job can cost six times the cost of one Claude session" — [Every](https://every.to/context-window/inside-the-100-agent-software-factory)
- Merge conflicts and agents overwriting each other: Cursor (70,000 conflicts), Anthropic (same-bug pile-up), GitHub's own warning about parallel agents on the same files — [Cursor](https://cursor.com/blog/agent-swarm-model-economics); [Anthropic](https://www.anthropic.com/engineering/building-c-compiler); [GitHub blog](https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/)
- Busywork and sprawl without a hierarchy: 68,000 commits in two hours "mostly busywork"; duplicated packages — [Cursor](https://cursor.com/blog/agent-swarm-model-economics)
- Fake or hollow coordination: ruflo tools that only write JSON state while agents stay idle — [audit gist](https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6)
- Supply-chain and prompt-injection risk from the orchestrator itself: ruflo tool descriptions with hidden instructions; OpenClaw privilege-escalation CVE — [ruflo issue 1375](https://github.com/ruvnet/ruflo/issues/1375); [NVD](https://nvd.nist.gov/vuln/detail/CVE-2026-33579)
- Session-cache anxiety and expiry when running several sessions: an HN commenter limits himself to three sessions because he otherwise has to poke each every 30 to 45 minutes to keep caches from expiring or auto-compacting — [HN thread](https://news.ycombinator.com/item?id=50366117)
- Provider cut-off: subscriptions blocked for third-party harnesses (Anthropic, April 2026; Google, February 2026), which turns a flat-rate fleet into metered API spend overnight — [HN 47633396](https://news.ycombinator.com/item?id=47633396); [HN 47115805](https://news.ycombinator.com/item?id=47115805)

### Inferences
- Credibly documented concurrency clusters into three bands: 3 to 10 (what individuals report doing interactively), 16 to about 100 (engineered "factory" setups with lock files, merge queues and tests as the oracle, run by the people who built the harness), and hundreds to a thousand-plus (vendor research with custom version control). No third-party orchestrator has an independent report above roughly 100.
- Cost per unit of useful output varies about 8-fold with model routing in Cursor's data ($1,339 versus $10,565 for comparable results), so "what did it cost" depends more on planner/worker model choice than on the orchestrator.
- In every large documented run the people supervising were the harness authors. That is weak evidence for what an ordinary user of a downloaded orchestrator can achieve.

### Gaps
- No dollar cost published for the Gas City 100-agent setup; a billion tokens a day cannot be converted to dollars without the model and cache mix.
- No documented maximum for Orca, Paseo, cmux, Orchestrator.inc, Emdash, Vibe Kanban or Conductor beyond marketing language.
- No audited cost report for a long-running Paperclip or OpenClaw deployment.
- I did not read the January 2026 Cursor post in full; its exact token totals ("trillions of tokens" appears in some coverage) are unverified here.

## Key question 5: Which tools have been abandoned, acquired, or discredited since 2025?

### Takeaway
2026 was a shakeout year for the orchestration layer: Conductor was bought by Meta and is being wound down, Bloop (Vibe Kanban) and Terragon shut down, Roo Code was archived, Crystal was deprecated, get-shit-done was archived, AutoGen went into maintenance mode, Gas Town was declared dead by its own author, and ruflo was publicly discredited by a code audit while continuing to gain stars.

### Cited Findings
- Conductor: acquired by Meta (announced 2026-11-04), cloud shut down 2026-11-20, local app winds down early 2027 — [InfoWorld, 2026-11-05](https://www.infoworld.com/article/4245065/meta-acquires-conductor-as-ai-coding-shifts-toward-multi-agent-development.html)
- Bloop / Vibe Kanban: company shut down 2026-04-10; project continues as community-maintained open source — [vibekanban.com](https://vibekanban.com/blog/shutdown)
- Terragon: shut down; the open-source repo is a snapshot dated 2026-01-16, last push 2026-02-10, described as "the website formally known as Terragon Labs ... a remote background agent orchestrator" — [terragon-labs/terragon-oss](https://github.com/terragon-labs/terragon-oss)
- Roo Code: announced 2026-04-21 that it would sunset its VS Code extension (about three million installs), cloud service and router on 2026-05-15 and pivot to a Slack-based cloud agent, "Roomote"; CEO Matt Rubens: "We don't believe IDEs are the future of coding" (reported by competitor Kilo, a Roo fork). Repo is archived with last push 2026-05-15 — [Kilo blog, 2026-04-24](https://blog.kilo.ai/p/the-ai-coding-shakeout-is-here); [RooCodeInc/Roo-Code](https://github.com/RooCodeInc/Roo-Code)
- Crystal: last commit and release 2026-02-26; deprecated in favour of Nimbalyst — [stravu/crystal](https://github.com/stravu/crystal); [dev.to, Agentik](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
- get-shit-done: repository archived, last push 2026-05-31 (64,136 stars) — [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done)
- Gas Town: "effectively burned down" per Yegge, August 2026; repo receives only dependency and security fixes — [Simon Willison](https://simonwillison.net/2026/Aug/4/steve-yegge/); [gastownhall/gastown](https://github.com/gastownhall/gastown)
- ruflo / claude-flow: discredited by an independent audit ("~10 are real" of 300+ tools) and a security report, but not abandoned; still releasing daily — [audit gist](https://gist.github.com/roman-rr/ed603b676af019b8740423d2bb8e4bf6); [issue 1375](https://github.com/ruvnet/ruflo/issues/1375)
- Tmux-Orchestrator: no push since 2025-07-14 — [Jedward23/Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator)
- Claude Code Agent Farm: no commits since 2026-09-21, no releases — [repo](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- multiclaude: no push since 2026-01-28 — [dlorenc/multiclaude](https://github.com/dlorenc/multiclaude)
- snarktank/ralph: no push since 2026-02-02 despite 22,228 stars — [snarktank/ralph](https://github.com/snarktank/ralph)
- Aider: last push 2026-05-22 — [Aider-AI/aider](https://github.com/Aider-AI/aider)
- Aperant (formerly Auto-Claude): 14,620 stars, last push 2026-06-14 — [AndyMik90/Aperant](https://github.com/AndyMik90/Aperant)
- Omnara: abandoned its original Claude Code wrapper as unmaintainable and pivoted to a hosted platform in 2026 (per competitor's comparison) — [dev.to, Agentik](https://dev.to/agentiknet/9-coding-agent-orchestrators-honestly-compared-dated-sourced-and-one-of-them-is-mine-3kpk)
- AutoGen: maintenance mode; successor Microsoft Agent Framework 1.0 GA April 2026 — [VentureBeat](https://venturebeat.com/ai/microsoft-retires-autogen-and-debuts-agent-framework-to-unify-and-govern)
- OpenClaw: creator hired by OpenAI in February 2026, project moved toward a foundation; subscription access cut off by Anthropic in April 2026 — [Decrypt](https://decrypt.co/358141/openai-openclaw-founder-lead-push-personal-ai-agents); [HN](https://news.ycombinator.com/item?id=47633396)
- Amp: spun out of Sourcegraph as an independent company in December 2025 — [ampcode.com](https://ampcode.com/news/amp-inc)
- Cursor: SpaceX announced on 2026-04-21 an arrangement with an option to acquire Cursor for $60 billion (reported by Kilo, a competitor); a later roundup says the deal closed in August 2026 (secondary) — [Kilo blog](https://blog.kilo.ai/p/the-ai-coding-shakeout-is-here); [Let's Data Science, 2026-11-06](https://letsdatascience.com/blog/meta-openai-bought-coding-tools-same-day-one-shutting-down)
- Other consolidation named in the same roundup: OpenAI agreed to acquire Pierre Computer Company (Git-based code storage for agents) on 2026-11-04; Astral to OpenAI (March 2026); Stainless to Anthropic (May 2026); Ona to OpenAI (June 2026) — [Let's Data Science, 2026-11-06](https://letsdatascience.com/blog/meta-openai-bought-coding-tools-same-day-one-shutting-down)
- Cursor reportedly acquired Continue (headline-level only; I did not read the article) — [The New Stack](https://thenewstack.io/cursor-acquires-continue-coding/)

### Inferences
- The independent orchestration layer is being squeezed from both sides: model vendors ship their own fleet features and restrict third-party use of subscriptions, and the best-funded independents get acquired and shut down. Any plan that depends on a third-party hosted orchestrator carries real continuity risk; local, open-source tools at least keep working after the company is gone (Vibe Kanban, Terragon snapshot).
- "Abandoned" and "popular" coexist: several projects with 20k to 64k stars have had no meaningful development for six months or more. Last-commit date is a better filter than stars.

### Gaps
- Deal terms for Conductor and whether Meta will release anything usable outside Meta are unknown.
- I did not verify the Cursor/Continue and Cursor/SpaceX closings from primary sources.
- I found no public post-mortem for Terragon beyond the repo description, and no stated reason for the get-shit-done archive.
- Roo Code details come from a competitor's blog; Roo's own announcement was not fetched.

## Key question 6: What do experienced practitioners say is the practical ceiling for one person supervising parallel agents, and what tooling raises it?

### Takeaway
Practitioners who are not selling courses converge on roughly 3 to 5 interactive agents for one person, with 5 to 8 as the upper band for bounded, independent tasks, and they name human review and comprehension, not tooling or compute, as the bottleneck. The setups that go far beyond this (16 to about 100 agents) do so by replacing human supervision with automated verification, merge queues, issue-tracker memory and review agents, and they are run by the people who built them.

### Cited Findings
- Simon Willison (Lenny's Podcast highlights, 2026-04-02): "I can fire up four agents in parallel and have them work on four different problems"; "And by like 11 AM, I am wiped out for the day"; using agents well "is mentally exhausting"; the remaining bottleneck is "proving them, and testing them" — [simonwillison.net](https://simonwillison.net/2026/Apr/2/lennys-podcast/)
- Addy Osmani (2026-04-07; Google engineer, no orchestration product to sell): "My ceiling for a typical session is somewhere around three to four threads depending on complexity"; "three focused, well-reviewed threads produce more usable output than six threads I'm half-supervising"; "What scales is your throughput of supervision, not your throughput of understanding"; two agents on novel architecture can exhaust you faster than four on bounded migrations. Failure modes he names: ambient anxiety, context-switch recovery, unbatchable judgment calls, trust decay, comprehension debt, and silent overreach where you stop reviewing and just accept output. What helps: time-boxed sessions, threads scoped so the output can be reviewed in about thirty minutes, crisp briefs with acceptance criteria, reducing scope per thread before reducing thread count, "Start with one thread less than feels right" — [addyosmani.com](https://addyosmani.com/blog/cognitive-parallel-agents/)
- Armin Ronacher (quoted by Gergely Orosz, The Pragmatic Engineer; publication date not captured, probably [older than 12 months]): runs parallel agents less than he used to, "it's only so much my mind can review!". Same article: Willison can only focus on "reviewing and landing one significant change at a time"; senior engineers historically reviewed across "2-5 workstreams" — [The Pragmatic Engineer](https://blog.pragmaticengineer.com/new-trend-programming-by-kicking-off-parallel-ai-agents/)
- Mitchell Hashimoto (Pragmatic Engineer episode, February 2026, via the newsletter and summaries): keeps one agent busy in the background at all times while he works, rather than running an autonomous fleet — [The Pragmatic Engineer newsletter](https://newsletter.pragmaticengineer.com/i/188952833/key-observation-from-mitchell)
- Peter Steinberger [older than 12 months, 2025-10-14]: 3 to 8 agents in parallel in a 3x3 terminal grid, mostly in the same folder — [Simon Willison link blog](https://simonwillison.net/2025/Oct/14/agentic-engineering/)
- Steve Yegge (via Willison, 2026-02-15, "The AI Vampire"): "only really comfortable working at that pace for short bursts of a few hours" — [simonwillison.net](https://simonwillison.net/2026/Feb/15/the-ai-vampire/)
- Gas Town README (author claim): "4-10 agents become chaotic" without an orchestrator — [gastownhall/gastown](https://github.com/gastownhall/gastown)
- Maggie Appleton: once agents write the code, "Design becomes the limiting factor"; Gas Town "churns through implementation plans so quickly that you have to do a LOT of design and planning" to keep it fed — [maggieappleton.com](https://maggieappleton.com/gastown)
- HN commenters, Nov 2026 (self-reports): "I try not to run more than three sessions at once"; "I run 5-6 parallel sessions at most, otherwise I can't keep track of what's being done"; "1-3 agents at a time, not more than 2 on the same branch"; "Usually have 3 or 4 instances running"; "Usually supervising myself w/ 5-6 sessions, if orchestrating more than that it's a hand-rolled swarm tool"; "Usually 5-8 agents going at any given moment"; "managing 5-10 agents" on a remote environment — [HN thread](https://news.ycombinator.com/item?id=50366117)
- Other guides (lower authority): a VirtusLab guide puts span of control at 3 to 7; a Morph author says he runs 6 to 8 daily and that the bottleneck is human attention (Morph sells tooling) — [VirtusLab](https://visdom-maturity-matrix.virtuslab.com/guides/organization/span-of-control-how-many-agents-you-can-effectively-supervis); [Morph](https://www.morphllm.com/parallel-coding-agent-playbook)
- A NeurIPS 2026 paper, "How Many Agents Can One Supervisor Track? A Mechanistic Capacity Model and Measurement Protocol for LLM-Agent Teams", exists; from the search summary, it argues deployments assign many agents to one supervisor without specifying when the supervisor can no longer recover the team's state. I did not read the paper — [NeurIPS 2026](https://neurips.cc/virtual/2026/173142)

What raises the ceiling, according to the sources:

- Automated verification instead of human reading: tests as the oracle and lock-file task claims let 16 agents run with no orchestrator agent — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Planner/worker hierarchy with cheap worker models, a neutral conflict resolver, stacked review agents and version control built for the commit volume — [Cursor](https://cursor.com/blog/agent-swarm-model-economics)
- Persistent task memory outside the session (Beads) so sessions are disposable; merge queue agent (Refinery); review gates and multi-model review, which Every singles out as catching different bugs than one model run several times — [Maggie Appleton](https://maggieappleton.com/gastown); [Every](https://every.to/context-window/inside-the-100-agent-software-factory)
- Routing CI failures, review comments and merge conflicts back to the agent that owns the branch, with a reviewer agent reading PRs before a person does — [OrchestratorInc/agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator)
- Notifications and mobile clients so the human is interrupted only when an agent needs input (cmux, Paseo, Orca, Happy) — [manaflow-ai/cmux](https://github.com/manaflow-ai/cmux); [getpaseo/paseo](https://github.com/getpaseo/paseo); [stablyai/orca](https://github.com/stablyai/orca)
- Work partitioning so parallel agents do not touch the same files — [GitHub blog](https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/)
- The "dark factory" extreme, where nobody writes or reads code and all trust is placed in automated validation, which Willison describes at StrongDM — [simonwillison.net](https://simonwillison.net/2026/Apr/2/lennys-podcast/)

### Inferences
- The ceiling is set by review and comprehension. Orchestration UIs (worktree boards, notifications, mobile apps) reduce switching cost and may move a person from about 3-4 to about 5-8 threads on bounded work; they do not change the fact that each thread's output must be understood by someone.
- Going from single digits to dozens requires a change of kind: the human stops supervising agents and starts supervising a pipeline (specs in, verified merges out). All documented cases of this were built and tuned by experts for their own codebase, cost thousands of dollars or a billion tokens a day, and in Gas Town's case broke on a model upgrade.
- For a single non-expert operator, the evidence supports planning for 3 to 5 concurrent agents and investing in verification (tests, review gates, clear acceptance criteria) before investing in a bigger orchestrator.
- The 10-100 claims in public discussion come almost entirely from people who build or sell the tooling.

### Gaps
- No controlled study with measured outcomes for supervisor span was found; the NeurIPS 2026 paper proposes a measurement protocol but I did not read its results.
- I found no 2026 first-hand statement from Boris Cherny, Geoffrey Huntley or swyx on a personal ceiling; searches returned nothing usable. Hashimoto's and Ronacher's positions come via The Pragmatic Engineer rather than their own posts.
- No source quantifies how much any specific tool raises the ceiling (for example, sessions per person with and without a board or reviewer agent).
- Whether newer models (Opus 4.8, Fable 5, GPT-6.x) change the ceiling by needing less review is asserted in places (Every's remark that review loops are "mostly unnecessary" now) but not measured.
