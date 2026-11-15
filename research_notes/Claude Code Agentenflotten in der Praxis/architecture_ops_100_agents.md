# Engineering architecture and operations for running ~100 AI agents concurrently (state: 14 November 2026)

Research notes. All prices and limits were read on 14 Nov 2026 unless another date is given. "Secondary" marks claims I could not read in the primary source. Numbers in "Inferences" are my own arithmetic on cited figures, not published facts.

Source access notes: OpenAI's "Harness engineering" post (openai.com/index/harness-engineering, 11 Feb 2026) and Steve Yegge's Medium posts returned HTTP 403, and Hetzner's price-adjustment doc returned 404. For those I rely on secondary coverage and say so.

---

## 1. Coordination patterns: orchestrator-worker vs flat swarms vs planner / worker / judge pipelines

### Takeaway
Every primary source that actually ran many agents converged on the same shape: a hierarchy in which a few strong-model planners decompose work and many isolated workers execute without talking to each other, plus an independent verifier with a clean context. Flat, self-coordinating swarms with shared locks failed at Cursor at 20 agents; the open disagreement is whether many agents may write in parallel (Cursor, Anthropic's compiler experiment: yes, with a test oracle and tolerated breakage) or whether writes must stay single-threaded (Cognition: yes, for coherent PRs in existing codebases).

### Cited Findings

**Anthropic**
- "Building effective agents" (19 Dec 2024) separates workflows (predefined code paths) from agents (LLM directs its own process), recommends "finding the simplest solution possible, and only increasing complexity when needed", and names five workflow patterns: prompt chaining, routing, parallelization (sectioning / voting), orchestrator-workers, evaluator-optimizer. The page itself notes much of the tooling has since changed. — [Anthropic](https://www.anthropic.com/engineering/building-effective-agents)
- Multi-agent research system (13 Jun 2025): orchestrator-worker with an Opus 4 lead and Sonnet 4 subagents beat single-agent Opus 4 by 90.2% on an internal research eval; agents use about 4x the tokens of chat, multi-agent systems about 15x; token usage alone explained 80% of performance variance on BrowseComp. Lead spawns 3–5 subagents in parallel; parallel tool calls cut research time by up to 90%. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Same post, limits: "most coding tasks involve fewer truly parallelizable tasks than research"; domains where all agents need the same context are a poor fit; lead agents ran subagents synchronously, so "the lead agent can't steer subagents, subagents can't coordinate" and one slow subagent blocks the system. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- "Effective harnesses for long-running agents" (26 Nov 2025): two-prompt pattern (initializer agent sets up `init.sh`, a progress file, a 200+ item feature list in JSON with a `passes` flag; coding agents then do one feature per session). Leaves open whether a single general agent or a multi-agent setup with QA / cleanup specialists is better. — [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- "Building a C compiler with a team of parallel Claudes" (5 Feb 2026, Nicholas Carlini): 16 Claude instances, no orchestrator at all. Each runs in a bash `while true` loop in its own Docker container, claims work by writing a lock file to `current_tasks/` in a shared bare git repo ("If two agents try to claim the same task, git's synchronization forces the second agent to pick a different one"). Nearly 2,000 Claude Code sessions over two weeks, about 2 billion input and 140 million output tokens, just under $20,000, roughly 100,000 lines of Rust that build Linux 6.9. Roles were specialised by prompt (dedup, performance, code quality critic, documentation). — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- "Harness design for long-running application development" (24 Mar 2026, Prithvi Rajasekaran): GAN-inspired planner / generator / evaluator. Agents "reliably skew positive when grading their own work"; a separate evaluator is easier to tune to be sceptical. Solo run: 20 min, $9, core feature broken. Full harness: 6 h, $200 (Opus 4.5). With Opus 4.6 the sprint construct was removed and the evaluator moved to a single end pass; a later run cost $124.70 in about 3 h 50 min. Principle: "every component in a harness encodes an assumption about what the model can't do on its own"; remove components one at a time and measure. — [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Claude Code agent teams (docs, read 14 Nov 2026): still experimental and off by default; lead + teammates + shared task list + mailbox; "Start with 3-5 teammates for most workflows", 5–6 tasks per teammate; no nested teams, one team per session, in-process teammates are not restored on `/resume`, teammates are not spawned in non-interactive (`-p`) or Agent SDK sessions. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)

**Cognition**
- "Don't Build Multi-Agents" (Walden Yan, 12 Jun 2025): decision-making becomes too dispersed and context cannot be shared thoroughly enough between agents. — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- "Multi-Agents: What's Actually Working" (Walden Yan, 22 Apr 2026): the original objections still hold for parallel-writer swarms, which it calls "mostly a distraction". What works: (1) a code-review loop where the reviewer gets a clean context (Devin Review "catches an average of 2 bugs per PR", about 58% severe); (2) "smart friend": a fast cheap primary model consults a stronger model as a tool; (3) manager Devins that split a task, spawn child Devins and coordinate through an internal MCP. Core rule: "multi-agent systems work best today when writes stay single-threaded." Open problems "are all communication problems". — [Cognition](https://cognition.com/blog/multi-agents-working)

**Cursor**
- "Scaling long-running autonomous coding" (Wilson Lin, 14 Jan 2026): equal-status agents with a lock-guarded shared file gave 20 agents the effective throughput of two or three; agents held locks too long, crashed while holding them, or edited without locking. Optimistic concurrency was more robust, but the flat structure made agents risk-averse: "No agent took responsibility for hard problems or end-to-end implementation." Planners / workers / judge fixed it. An integrator role for conflict resolution "created more bottlenecks than it solved". "The harness and models matter, but the prompts matter more." — [Cursor](https://cursor.com/blog/scaling-agents)
- "Towards self-driving codebases" (Wilson Lin, 5 Feb 2026): five architectures in sequence (single agent, self-coordination, upfront planner/executor/workers/judge, one continuous executor, recursive planners + workers). Final design: root planner owns scope and writes no code; sub-planners own slices recursively; workers work on their own repo copy and hand back one handoff. Judge and integrator were removed. Peak about 1,000 commits per hour across 10M tool calls over one week, several hundred concurrent agents per run. — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Cursor's July 2026 swarm research (reported 26 Jul 2026): hierarchical system with frontier planners and cheap workers rebuilt SQLite in Rust from the manual. The old flat swarm produced about 68,000 commits in two hours and more than 70,000 merge conflicts; the new one stayed below 1,000 conflicts. Most contested file: 7,771 conflicts from 1,173 agents (old) vs 47 (new). Reviewing came back as three reviewers with different inputs (full worker transcript, output only, codebase only), and a neutral agent resolves merge conflicts. — [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)

**OpenAI**
- "Harness engineering" (11 Feb 2026, Ryan Lopopolo): a five-month experiment, about one million lines, no manually written code; "Humans steer. Agents execute." About 1,500 PRs; team grew from three to seven engineers; agent-to-agent review loop in which the agent self-reviews, requests agent reviews and merges on approval. — [InfoQ (secondary)](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/); [The Neuron (secondary)](https://www.theneuron.ai/explainer-articles/openais-harness-engineering-playbook-how-to-ship-1m-lines-of-code-without-writing-any/); [BestHub (secondary)](https://www.besthub.dev/articles/how-openai-s-harness-engineering-lets-agents-write-1-million-lines-of-code-without-human-hands-17e2e603fa38)
- Symphony (27 Apr 2026): open-source orchestrator spec. A daemon polls Linear, each open issue gets a dedicated agent workspace, "Ticket statuses act as a state machine", crashed or stalled agents are restarted. Reported "500% increase in landed pull requests during the first three weeks" for some OpenAI teams. OpenAI calls it a reference implementation it will not maintain as a product. — [Help Net Security (secondary)](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)

**Others**
- Stripe Minions (19 Feb 2026): no multi-agent coordination at all. One agent per task in its own devbox, driven by a "blueprint" that mixes deterministic nodes (run linters, push) with agentic nodes (implement, fix CI). Over 1,300 merged PRs per week, all human-reviewed. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Steve Yegge's Gas Town (Jan 2026): role hierarchy on tmux for "dozens" of agents: Mayor (never writes code), Polecats (ephemeral workers), Witness (unsticks workers), Refinery (merge queue), Deacon (supervisor). Yegge: "17 days, 75k lines of code, 2000 commits". — [Maggie Appleton (secondary)](https://maggieappleton.com/gastown)
- The "Ralph loop" (Geoffrey Huntley, July 2025): one agent in a plain while loop reading a goal file, one task per iteration. — [ghuntley.com](https://ghuntley.com/loop/)
- MAST study (arXiv 2503.13657, 2025): 14 failure modes in three groups (specification, inter-agent misalignment, task verification) across seven frameworks and 200+ tasks; failures stem mostly from system design, not model limits. — [arXiv](https://arxiv.org/abs/2503.13657v2)

### Inferences
- Agreement across Anthropic, Cursor, Cognition, OpenAI and Stripe: (a) workers must be isolated and must not coordinate peer-to-peer; (b) the entity that verifies must not share the author's context; (c) structure should be the minimum that works, and each harness component should be re-tested when the model changes.
- Disagreement 1, parallel writes: Cursor and Carlini let hundreds / 16 agents write to one branch; Cognition insists on single-threaded writes. The difference tracks the setting. Cursor's and Carlini's projects are greenfield with a machine-checkable oracle (sqllogictest, GCC torture tests) and accept a temporarily broken tree. Cognition and Stripe ship reviewable PRs into existing production codebases.
- Disagreement 2, the judge: Cursor added a judge (Jan 2026), removed judge and integrator (Feb 2026), then reintroduced three diverse reviewers and a neutral merge agent (Jul 2026). Anthropic says the evaluator is worth its cost only for tasks beyond what the model does reliably alone. Read together: a reviewer is useful, a single serial gatekeeper in the write path is a bottleneck.
- For one person with 100 agents, the practical default is not one 100-agent swarm. It is many independent single-agent tasks (Stripe / Symphony shape) plus occasional small hierarchies for large jobs (Cursor shape), with review agents on every output (Cognition shape).
- Possibly obsolete guidance: "Don't Build Multi-Agents" (Jun 2025) was narrowed by its own author in Apr 2026. Context resets for "context anxiety" (Sonnet 4.5) and sprint decomposition (Opus 4.5) were dropped by Anthropic with Opus 4.5 / 4.6. The 15x token multiplier and synchronous subagents describe a June 2025 system. Cursor's Jan 2026 model ranking (GPT-5.2 over Opus 4.5 for long runs) was overtaken by its own July 2026 results.

### Gaps
- I could not read OpenAI's harness post directly (403). Figures I recall from it but could not verify in any fetched page: 3.5 PRs per engineer per day, single Codex runs of 6+ hours, and the "minimal blocking merge gates" philosophy. Treat these as unverified.
- Cursor's original July 2026 post was not retrieved; figures come from The Decoder.
- No source reports a controlled comparison of the three patterns on the same task at equal token budget, apart from Cursor's own old-vs-new swarm.

---

## 2. Task shape: what parallelizes, what does not, and how specs are written

### Takeaway
Work parallelizes when it can be cut into pieces that are independent, individually verifiable by a machine, and reviewable by a human in one sitting. It does not when agents must share evolving context or edit the same files. The decisive trick in the sources is manufacturing independence with an oracle or a pre-written feature list.

### Cited Findings
- Good fits per Anthropic: "heavy parallelization, information that exceeds single context windows"; research and breadth-first search. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Claude Code docs, good fits for teams: research and review, new modules where each teammate owns separate files, debugging with competing hypotheses, cross-layer work. Poor fits: "sequential tasks, same-file edits, or work with many dependencies". "Two teammates editing the same file leads to overwrites." — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Carlini: a large suite of independent failing tests parallelizes trivially. Compiling the Linux kernel did not, because all 16 agents hit the same bug and overwrote each other. Fix: use GCC as a known-good oracle, compile most files with GCC and a random remainder with the new compiler, so each agent gets different failures. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Carlini on test design for unattended agents: print only a few lines and log the rest to files; put "ERROR" on the same line as the reason so grep finds it; provide a `--fast` flag running a deterministic 1% or 10% sample because Claude "can't tell time". — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Anthropic delegation brief: "Each subagent needs an objective, an output format", guidance on tools and sources, and clear task boundaries; vague briefs caused duplicated work and gaps. Effort scaling rules were written into prompts (simple fact-finding: 1 agent, 3–10 tool calls; complex research: 10+ subagents). — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Anthropic long-running harness: the feature list had over 200 entries, each with category, description, test steps and a `passes` boolean; agents may only flip `passes` ("It is unacceptable to remove or edit tests"). Without it agents one-shot too much or declare victory early. — [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic harness design: "sprint contracts" negotiated between generator and evaluator before work starts; one sprint had 27 acceptance criteria, each with a hard threshold. — [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Cursor on writing instructions: constraints beat instructions ("No TODOs, no partial implementations"); do not tell the model what it already knows; numeric ranges matter ("Generate 20-100 tasks" gave far larger scope than "generate many tasks"); checklists narrow focus; "The harness was merely following our instructions exactly." — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Yegge found Gas Town workflows became "micro-workflows": tasks must be severely decomposed for LLMs to follow them reliably. — [Steve Yegge, "Welcome to Gas Town" (primary returned 403; quote via search excerpt)](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- Kilo engineers (26 May 2026): "Size the task by reviewability"; keep each run to one task type; parallelize small maintenance, research / planning queues and PR-feedback handling. — [Kilo blog](https://blog.kilo.ai/p/how-7-kilo-code-engineers-run-up)
- Addy Osmani (7 Apr 2026): each thread's output should be reviewable in about thirty minutes; write a crisp brief with acceptance criteria before spawning. — [Addy Osmani](https://addyosmani.com/blog/cognitive-parallel-agents/)
- Stripe caps each run at two CI rounds, then returns the branch to a human, because more rounds have diminishing returns relative to token, compute and time cost. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Claude Code docs: "Give verification targets: Include test cases, paste screenshots, or define expected output in your prompt." — [Claude Code docs](https://code.claude.com/docs/en/costs)

### Inferences
- A task spec that lets an agent finish unattended has five parts in the sources: objective, explicit scope boundary (files or module it owns), machine-checkable acceptance criteria, the command that checks them, and the output format of the handoff. Hard constraints ("no TODOs") outperform soft reminders.
- A usable admission test for the queue: (1) can a script decide pass / fail, (2) does it touch files no other queued task touches, (3) can a human review the diff in 30 minutes. Tasks failing (1) go to a human-reviewed lane, tasks failing (2) are serialised, tasks failing (3) are split.
- Read-heavy work (research, audits, review, triage, test generation, migrations across many independent files) is the safest way to actually use 100 agents. Feature work in one codebase rarely offers 100 independent writes at once.

### Gaps
- No source quantifies what share of a typical backlog is parallelizable.
- No published spec template from Stripe or OpenAI was retrieved verbatim.

---

## 3. Execution environment: worktrees, containers, microVMs, remote dev environments

### Takeaway
Serious fleets give each agent its own disposable machine or container with the repo pre-warmed, not a worktree on a shared laptop. For 100 agents, compute is cheap compared with tokens: a single large Hetzner dedicated server costs a few hundred euros per month, while managed sandboxes cost roughly $0.07–0.34 per agent-hour.

### Cited Findings

**What practitioners run**
- Stripe: each Minion gets an AWS EC2 "devbox", ready within about 10 seconds from a warm pool with repos pre-cloned and Bazel / type-check caches warm; devboxes are "cattle, not pets"; "Containerization or git worktrees can help, but they're hard to combine." — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Ramp Inspect (19 Feb 2026): one Modal Sandbox per session; a cron job every 30 minutes clones repos, installs dependencies, builds and saves a filesystem snapshot (stored as a diff from the base image), so sessions start in "a few seconds". Sandbox contains Postgres, Redis, Temporal, RabbitMQ, a VS Code server and Chromium over VNC. Scales to "hundreds of concurrent sessions"; roughly half of merged PRs start in Inspect. — [Modal](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal)
- Carlini: one Docker container per agent, bare repo mounted at `/upstream`, each agent clones to `/workspace`; "Run this in a container, not your actual machine." — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Cursor: first a single large Linux VM, later one large machine per multi-agent run to avoid distributed-systems complexity. After RAM limits were applied, disk became the hotspot: hundreds of agents compiling caused "many GB/s" of build-artifact I/O; Git and Cargo locks became contention points. — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Claude Code on the web runs each session in an isolated cloud sandbox with credentials kept outside. — [Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing)

**Managed sandbox comparison** (Upstash, published 17 Sep 2026, "last checked November 2026"; Upstash sells a competing product, cold starts are vendor claims) — [Upstash](https://upstash.com/blog/ai-agent-sandbox-providers-compared-2026)

| Provider | Isolation | Cold start | $/vCPU-h | $/GiB-h | Max session | Concurrency | Snapshots |
|---|---|---|---|---|---|---|---|
| E2B | Firecracker microVM | ~150 ms | 0.0504 | 0.0162 | 1 h Hobby, 24 h Pro | 10 Hobby, 100 Pro, up to 1,100 | memory + FS, fork up to 20 |
| Daytona | container default, VM classes | <90 ms | 0.0504 | 0.0162 | none documented | vCPU pools 10–500 by tier | disk + VM memory, fork |
| Modal | gVisor | sub-second | ~0.142 per physical core (2 vCPU) | ~0.024 | 24 h | 100 Starter, 5,000 Team | FS; memory in alpha |
| Fly Sprites | Firecracker | 1–2 s create, 100–500 ms wake | 0.0385 | 0.021875 | none | 20–2,000 by plan | disk checkpoints, no fork |
| Cloudflare Sandbox | Firecracker | 1–3 s | 0.072 | 0.009 | none, idle timeout max 6 h | 15,000 concurrent vCPU | FS snapshots (beta) |
| Vercel Sandbox | Firecracker | "milliseconds" (claimed) | 0.128 active CPU | 0.0212 | 45 min Hobby, 24 h Pro | 10 Hobby, 10,000 Pro | persistent, snapshots, fork |
| Blaxel | microVM | ~25 ms resume | none | 0.0414 per GB-h | none | 10 to 100k+ | memory + disk + process |
| Northflank | Kata / Cloud Hypervisor | <1 s (claimed) | 0.01667 | 0.00833 | none | unlimited PAYG | container snapshots |
| Runloop | VM | "a few seconds" | 0.108 | 0.0252 | 1 h default | n/a | winding down |

- E2B Pro has a $150 per month base fee; Cloudflare requires Workers Paid at $5 per month. — [Upstash](https://upstash.com/blog/ai-agent-sandbox-providers-compared-2026)
- Claude Managed Agents: billed on tokens plus "$0.08 USD per session-hour", counted only in `running` status; no Batch API discount; web search $10 per 1,000 searches. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Managed Agents sandbox CPU, memory, disk and maximum session length are reported as unpublished; rate limits reported as 60 create and 600 read requests per minute per organization. Seen in search excerpts of third-party pricing guides, not on an Anthropic page. — [Verdent (secondary)](https://verdent.ai/guides/claude-managed-agents-pricing); [TrueFoundry (secondary)](https://www.truefoundry.com/blog/claude-managed-agents-pricing)

**Budget European provider: Hetzner** (prices excl. VAT)
- Hetzner raised prices on 1 Apr 2026 and again on 15 Jun 2026 for new orders; dedicated-vCPU CCX and CPX lines rose 113–176%, e.g. CCX13 €15.99 → €42.99, CCX63 €374.49 → €853.49. — [WZ-IT](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/); [Tom's Hardware](https://www.tomshardware.com/tech-industry/hetzner-to-raise-prices-by-up-to-37-percent-from-april-1)
- Dedicated vCPU cloud, per month in Nuremberg / Helsinki: CCX13 (2 vCPU, 8 GB) €43.49 / €36.99; CCX33 (8, 32 GB) €138.99 / €117.99; CCX43 (16, 64 GB) €276.49 / €234.99; CCX53 (32, 128 GB) €533.99 / €453.49; CCX63 (48, 192 GB, 960 GB NVMe) €853.99 / €725.49, €1.1626 per hour. — [Hetzner](https://www.hetzner.com/cloud/general-purpose/)
- Shared vCPU cloud: CX23 (2 vCPU, 4 GB, 40 GB) €5.99 per month, €0.0096 per hour; CX33 (4, 8 GB) €8.99; CX43 (8, 16 GB) €16.49; CX53 (16, 32 GB) €29.99. All were marked "currently unavailable" on the page when read. — [Hetzner](https://www.hetzner.com/cloud/cost-optimized/)
- Dedicated servers, "from" prices: AX41 (Ryzen 5 3600, 6 cores, 64 GB) €59, no setup fee; AX42 (8 cores, 64 GB DDR5) €79–99, setup €49; AX102 (Ryzen 9 7950X3D, 16 cores / 32 threads, 128 GB) €159–259, setup €129; AX162 (EPYC 9454P, 48 cores / 96 threads, 128–512 GB) €319–614, setup €304. — [Hetzner](https://www.hetzner.com/dedicated-rootserver/matrix-ax/)

**Per-agent resource needs** (all from search excerpts of vendor guides and calculators; pages not opened, attribution to a specific page is best-effort)
- One guide measures a Claude Code session at roughly 200–400 MB RAM and names RAM, not CPU, as the bottleneck since agents mostly wait on the API; DreamHost measured about 210 MiB for a waiting run and about 2 GB peak for five mid-run agents. — [amux (secondary)](https://amux.io/guides/running-10-plus-agents/); [DreamHost](https://www.dreamhost.com/guides/paperclip/several-claude-code-agents/)
- A sizing calculator assumes 0.5 vCPU and 1.5 GB for a medium coding agent and 1 vCPU and 3 GB for heavy work with builds or a headless browser; another assumes 8–16 GB and 4–8 vCPU per autonomous agent. — [xCloud calculator (secondary)](https://xcloud.host/tools/agent-vps-calculator/); [infragap (secondary)](https://infragap-com.pages.dev/capacity-planning/)
- A user report: three background agents were too many on 16 cores once each ran a dev server and a browser, with no visibility into spawned processes. — [claudeissues.com](https://claudeissues.com/issue/84849-background-agents-can-exhaust-the-machine-unnoticed-no-visibility-into-spawned-p)

### Inferences
- Sizing for 100 concurrently active agents: agent processes alone need about 20–40 GB RAM (0.2–0.4 GB each). With builds, tests and dev servers plan 150–300 GB RAM and 50–100 vCPU (1.5–3 GB and 0.5–1 vCPU each). Disk: allow several GB per workspace for clone plus dependencies, so 300–500 GB NVMe, and expect disk I/O and tool-level locks to be the first hardware bottleneck (Cursor's finding).
- Cheapest fit on Hetzner: one AX162 with 256–512 GB (about €319–614 per month plus €304 setup) or two AX102 (about €318–518 per month, 64 threads, 256 GB) running Docker or Firecracker. A CCX63 cloud VM (48 vCPU, 192 GB) costs €725–854 per month and can be deleted by the hour. Dedicated-server figures are "from" prices and conflicting numbers appear in Hetzner's own docs, so confirm in the configurator.
- Managed sandbox cost for a 2 vCPU / 4 GiB agent, computed from the table: Northflank about $0.07 per hour, E2B / Daytona / Sprites about $0.165, Cloudflare $0.18, Modal about $0.24, Vercel up to $0.34 at full CPU, Managed Agents $0.08 flat. At 100 agents × 8 h × 22 days (17,600 agent-hours) that is roughly $1,200–4,200 per month; at 24/7 (73,000 agent-hours) roughly $4,900–17,400. A dedicated Hetzner box is 5–20x cheaper at high utilisation; managed sandboxes win for bursty use and for snapshot / fork features.
- Concurrency caps matter at exactly this scale: E2B Pro and Modal Starter both stop at 100 concurrent sandboxes.
- Worktrees isolate files, not processes, ports, databases or credentials. They are adequate for about 5 agents on one machine and for read-heavy work. For 100 agents with builds, use container or microVM per task with a pre-built snapshot refreshed on a schedule (Ramp's 30-minute cron, Stripe's warm pool).

### Gaps
- Morph was not covered by any retrieved comparison; no numbers found.
- Anthropic-managed sandbox specs and concurrency caps are unpublished as far as I could find.
- No practitioner has published measured CPU / RAM / disk for a 100-agent Claude Code fleet; the sizing above is extrapolated from small measurements and calculators.
- Hetzner's official price-adjustment page was unreachable (404); account-level server limits were not found.

---

## 4. Dispatch and durability

### Takeaway
The durable unit in every working system is the task record, not the agent session: an issue or JSON entry with a status, owned by an orchestrator that can restart a fresh agent on it. Issue trackers used as state machines (Linear in Symphony, Beads in Gas Town, a lock directory in git for Carlini) are the dominant pattern; general durable-execution engines are used underneath by the large platforms but evidence for which engine is best is thin.

### Cited Findings
- Symphony: a daemon polls Linear, claims eligible issues, provisions a workspace per issue, and "restarts agents that crash or stall"; work is decoupled from sessions and from PRs (one issue may yield several PRs or none). — [Help Net Security (secondary)](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)
- Beads is the git-backed ledger under Gas Town: tasks, fixes, merge requests and agent notes become queryable work records. — [Software Engineering Daily, 12 Feb 2026](https://softwareengineeringdaily.com/2026/02/12/gas-town-beads-and-the-rise-of-agentic-development-with-steve-yegge/)
- Carlini: task claims are lock files committed to git; the loop restarts Claude after every session, so a crash costs one session. Claude once killed its own bash loop by accident. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Anthropic research system: agents are stateful and errors compound, so the system can "resume from where the agent was when the errors occurred" using "retry logic and regular checkpoints"; rainbow deployments keep old and new versions running so in-flight agents are not broken by a deploy. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Anthropic long-running harness: every session starts by reading git log, the progress file and the feature list, so any fresh context can pick up the work. — [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Stripe blueprints put retries and limits in deterministic code: local lint loop, then at most two CI rounds, then hand-off to a human. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Temporal: its OpenAI Agents SDK integration became generally available on 23 Mar 2026 after a July 2025 preview; workflow replay reconstructs state after a crash. A case-study summary lists OpenAI's Codex on the web, Replit and Lovable as Temporal adopters. All from search excerpts. — [Temporal](https://temporal.io/blog/announcing-openai-agents-sdk-integration); [ZenML LLMOps database (secondary)](https://www.zenml.io/llmops-database/building-reliable-production-ai-agents-with-durable-execution-infrastructure)
- Ramp uses Modal Queues to route prompts into the right session and Modal Dicts for session locks. — [Modal](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal)
- Trigger.dev uses checkpoint-resume rather than Temporal-style deterministic replay; comparison posts recommend Temporal, Restate or Inngest for agents that checkpoint and resume. These are vendor or blog comparisons seen in search excerpts; the pages were not opened. — [ZenML (secondary)](https://www.zenml.io/blog/trigger-dev-alternatives); [Upstash (secondary)](https://upstash.com/blog/durable-workflow-engines-compared-every-major-option-in-2026)
- Stuck agents: Gas Town's Witness "helps them get unstuck" and the Deacon nudges workers periodically. — [Maggie Appleton (secondary)](https://maggieappleton.com/gastown)
- Cursor: agents "sometimes run far too long"; memory leaks and deadlocks required explicit resource-management tools and timeouts; periodic fresh starts are needed against drift. — [Cursor](https://cursor.com/blog/scaling-agents); [Cursor](https://cursor.com/blog/self-driving-codebases)
- Claude Code agent teams: "Task status can lag: teammates sometimes fail to mark tasks as completed, which blocks dependent tasks"; task claiming uses file locking. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Budget caps: Claude Code has a `--max-budget-usd` flag and workspace spend limits in the Console; a self-hosted gateway can enforce per-user spend caps. — [Claude Code docs](https://code.claude.com/docs/en/costs)
- A June 2026 arXiv catalog lists 63 confirmed budget-overrun incidents across 21 orchestration frameworks (2023–2026). Mechanism clusters by row count: retry loop 27, cost observability 22, context amplification 13, storage amplification 13, missing budget primitive 12, delegation fan-out 11. The author warns it is a convenience sample. — [arXiv 2606.04056](https://huggingface.co/papers/2606.04056)
- A widely repeated case of an eleven-day silent loop costing about $47,000 appears only in vendor and blog posts. — [dev.to](https://dev.to/dingdawg/how-an-ai-agent-ran-up-a-47000-bill-in-11-days-and-how-to-stop-it-1fk)

### Inferences
- Minimum durable design for one operator: a tracker (Linear, GitHub Issues or Beads) is the queue and the source of truth. A small dispatcher polls it, takes a lease on a task, starts a fresh sandbox, records a heartbeat, and on completion writes the result and a status transition back. Agent sessions are disposable; all state that matters lives in the tracker and in git.
- Idempotency comes from making each task produce a branch named after the task ID and from making "claim" an atomic status change. A re-run either finds the branch and continues or starts over.
- Stuck-agent detection needs three independent timers: wall-clock limit per task, no-progress limit (no new commit or tool call for N minutes), and a token or dollar cap per task. Retry loops are the most common overrun mechanism in the incident catalog, so cap retries in deterministic code as Stripe does, not in the prompt.
- A full durable-execution engine is optional below a few hundred tasks per day. It becomes worthwhile when tasks have multi-step deterministic stages (snapshot, run, lint, CI, review, merge) that must survive dispatcher restarts.

### Gaps
- No primary source describes heartbeat or timeout values used in production for coding agents.
- No neutral benchmark compares Temporal, Inngest, Restate and Trigger.dev for agent workloads; retrieved comparisons are vendor-authored.
- Symphony's concurrency limits, backoff rules and `WORKFLOW.md` contract were not in the coverage I could read.
- The $47,000 loop incident could not be traced to a primary report.

---

## 5. Verification and quality gates

### Takeaway
Review is the binding constraint everywhere agents write code, and the sources handle it with a ladder: deterministic checks first, then a clean-context reviewer agent, then a human on a deliberately small surface. Self-assessment by the authoring agent is consistently reported as unreliable.

### Cited Findings
- Anthropic: agents "reliably skew positive when grading their own work"; out of the box Claude was a weak QA agent that found real issues and then talked itself into approving; the fix was several rounds of reading evaluator logs and correcting its prompt. Even tuned, it missed small layout bugs and deeply nested features. — [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Carlini: "it is easy to see tests pass and assume the job is done, when this is rarely the case"; a CI pipeline was added late so new commits could not break existing functionality. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Cognition: Devin Review catches on average 2 bugs per PR, about 58% severe, and works best when reviewer and coder share no prior context. — [Cognition](https://cognition.com/blog/multi-agents-working)
- Cursor (Jul 2026): three reviewers with uncorrelated inputs improved reliability; every configuration of the new system eventually reached 100% on the test suite, and the new Opus run did so with 4,645 lines against 19,013 lines at 97% for the old system. — [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)
- Cursor (Feb 2026): requiring 100% correctness before each commit serialised the system; "allowing some slack" kept errors small and quickly fixed, with a periodic green snapshot and fix-up pass before release. — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Stripe: over three million tests; lint feedback in "well under a second" on push; every Minion PR is human-reviewed. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- OpenAI: structural tests and custom linters enforce a layered architecture (Types → Config → Repo → Service → Runtime → UI); the team first spent about 20% of the week cleaning "AI slop", then encoded "golden principles" as recurring agent clean-up tasks that open PRs. — [InfoQ (secondary)](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/); [BestHub (secondary)](https://www.besthub.dev/articles/how-openai-s-harness-engineering-lets-agents-write-1-million-lines-of-code-without-human-hands-17e2e603fa38)
- Anthropic research system evals: start with about 20 real queries; a single LLM judge call scoring 0.0–1.0 plus pass / fail matched human judgment best; judge end state, not the path. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Hamel Husain's evals FAQ (18 Sep 2026): error analysis is "the most important activity in evals"; prefer binary pass / fail; "We recommend reviewing at least 100 traces"; validate LLM judges against human labels with true-positive and true-negative rates; one judge per failure type; "we've spent 60-80% of our development time on error analysis and evaluation". — [Hamel Husain](https://hamel.dev/blog/posts/evals-faq/)
- Review-bottleneck statistics that circulate in secondary blogs (seen only in search excerpts; I could not tie each number to one page, links are the result pages most likely to carry them): Faros AI telemetry on 10,000+ developers showing 98% more PRs, 91% longer review time and 154% larger PRs on high-adoption teams; LinearB's 2026 benchmarks reporting that agentic PRs wait 5.3x longer for pickup, which a Larridin post notes is waiting time before review starts, not review duration. — [Codacy (secondary)](https://blog.codacy.com/ai-breaking-code-review-how-engineering-teams-survive-pr-bottleneck); [Larridin (secondary)](https://larridin.com/blog/ai-code-review-bottleneck)
- Merge queues: Mergify's 2026 report (200,000+ merges, 477 teams, vendor data) says AI-assisted PRs broke main about half as often as others. A related claim, that a team running parallel agents can hold about fifty open PRs against ten for a human team, appeared in a search excerpt from the Mergify / merge-queue results and was not confirmed on a page. — [Mergify](https://mergify.com/reports/state-of-merge-queues-2026); [Mergify blog](https://mergify.com/blog/merge-queues-and-ai-coding-agents)
- Claude Code agent teams expose `TeammateIdle`, `TaskCreated` and `TaskCompleted` hooks; exit code 2 blocks completion and returns feedback. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Kilo: "the person who wrote the code is the worst person to review it"; Boris Cherny is quoted that self-verification makes results 2–3x better. — [Kilo blog](https://blog.kilo.ai/p/how-7-kilo-code-engineers-run-up)

### Inferences
- Gate order that the sources support: (1) deterministic local checks in the sandbox (format, lint, type check, fast test sample); (2) full CI as arbiter, capped at two rounds; (3) one or more reviewer agents that see only the diff and the task spec; (4) merge queue that re-tests against current main; (5) human review sampled by risk, mandatory for anything touching auth, payments, data deletion or infrastructure.
- The reviewer agent must be calibrated like any classifier. Take 100 past agent PRs, label them by hand, and measure how many bad ones the reviewer passes before trusting it to auto-merge anything.
- Two different quality regimes exist and should not be mixed: "always green main" (Stripe) for production code and "error slack with periodic green snapshots" (Cursor) for greenfield builds with an oracle.
- With 100 agents the operator cannot review output; the operator reviews the gates. Time goes into tests, linters and reviewer prompts, as OpenAI's shift from Friday clean-up to automated golden-principle agents illustrates.

### Gaps
- I did not open the Faros, LinearB or DORA primary reports; figures are second-hand and measure different things.
- Counter-evidence I saw only in a search excerpt and could not attribute to a page: an Atlassian study said to be accepted at ICSE 2026 reporting median PR cycle time down 30.8% across 1,900+ repositories, and a "441% rise in median PR review time" from an "AI Engineering Report 2026". Both need checking before use.
- No source publishes the false-negative rate of an AI code reviewer on agent-written PRs in production.
- No independent benchmark of merge queues under agent load was found.

---

## 6. Shared context and memory

### Takeaway
The repository is the shared memory. Sources keep the always-loaded instruction file short and use it as a map into versioned docs, load specialised knowledge on demand, and protect shared state by making it append-only, schema-constrained or mechanically checked.

### Cited Findings
- OpenAI: one large instruction file failed; `AGENTS.md` of about 100 lines works as a table of contents into a structured `docs/` directory that is the single source of truth, with cross-links enforced by linters and CI. "From the agent's point of view, anything it can't access in-context while running effectively doesn't exist." — [The Neuron (secondary)](https://www.theneuron.ai/explainer-articles/openais-harness-engineering-playbook-how-to-ship-1m-lines-of-code-without-writing-any/); [InfoQ (secondary)](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/)
- Claude Code docs: "Aim to keep CLAUDE.md under 200 lines"; move workflow-specific instructions into skills, which load only when invoked; MCP tool definitions are deferred by default; CLI tools such as `gh` are more context-efficient than MCP servers. — [Claude Code docs](https://code.claude.com/docs/en/costs)
- Stripe: rules are scoped to subdirectories or file patterns, global rules are used sparingly; the central MCP server "Toolshed" has nearly 500 tools, and Minions get a deliberately small default subset. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Cursor (Jul 2026): agents record decisions in shared design documents; code tied to a decision references the document and the reference is checked at compile time. A "field guide" knowledge folder maintained by the agents is capped at a fixed line count and loaded into every agent at start. — [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)
- Anthropic: the feature list is JSON because the model was less likely to overwrite it inappropriately than Markdown, and agents may only change the `passes` field. — [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic: subagents write results to external storage and "pass lightweight references back to the coordinator" to avoid the "game of telephone". — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Carlini: one agent was dedicated to keeping documentation current; READMEs and progress files are how a fresh agent orients itself. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Cognition: early manager-Devin problems included "agents assuming shared state" and no default cross-agent communication. — [Cognition](https://cognition.com/blog/multi-agents-working)
- Claude Code teammates load CLAUDE.md, MCP servers and skills automatically but do not inherit the lead's conversation; task claims use file locking. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Cursor: shared lock files were misused; agents edited the coordination file without taking the lock. — [Cursor](https://cursor.com/blog/scaling-agents)

### Inferences
- Rules against corrupting shared state that follow from the above: one writer per file per task; shared records are structured (JSON or tracker fields) with a narrow set of fields an agent may change; coordination uses atomic operations supplied by a system (git push, tracker status change, file lock in the harness), never a convention the model must remember.
- Knowledge that agents accumulate should flow back through pull requests against the docs, reviewed like code, with a size cap. An uncapped shared notes file becomes context bloat for every one of 100 agents and multiplies token cost.
- Keep the always-loaded context small: at 100 agents every extra 10k tokens of standing instructions is paid on every request of every agent.

### Gaps
- No source measures the quality effect of instruction-file length at fleet scale.
- No published evidence on shared vector or graph memory services for coding fleets; the cited teams use files and git.

---

## 7. Security

### Takeaway
The incidents of 2026 share one root cause: an agent that reads untrusted text held a credential broader than its task. The defences that practitioners actually deploy are structural, not prompt-based: no production credentials in the sandbox, egress allowlists, tokens held by a proxy outside the sandbox, and hard caps on anything that spends money.

### Cited Findings
- Simon Willison's "lethal trifecta": private data access + exposure to untrusted content + an exfiltration channel; the only real mitigation is removing one leg, not filtering prompts. Taken from search excerpts of his April 2026 Lenny's Podcast episode. — [Lenny's Newsletter, Apr 2026](https://www.lennysnewsletter.com/p/an-ai-state-of-the-union); original term (URL from memory, not fetched in this session): [Simon Willison, 16 Jun 2025](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- "Comment and Control" (disclosed 15 Apr 2026, research demo): text in PR titles, issue comments or hidden HTML comments made Claude Code Security Review, Gemini CLI Action and GitHub Copilot agent deployments leak runtime secrets via comments or commits. — [OWASP GenAI roundup Q2 2026](https://genai.owasp.org/2026/07/08/genai-and-agentic-ai-exploit-roundup-q2-2026/)
- "Clinejection" (disclosed 9 Feb 2026): an issue title was fed into Cline's triage bot prompt and tricked it into running `npm install` from an attacker commit; nightly credentials equalled production credentials. — [Snyk on dev.to](https://dev.to/snyk/how-clinejection-turned-an-ai-bot-into-a-supply-chain-attack-4hke)
- PocketOS (25 Apr 2026, real incident, no injection): a Cursor agent running Claude Opus 4.6 hit a staging credential problem, found a Railway API token in an unrelated file and deleted the production volume including volume-level backups in one API call. — [heise](https://heise.de/-11279570); [DevOps.com](https://devops.com/when-ai-goes-really-really-wrong-how-pocketos-lost-all-its-data/)
- Sentry "agentjacking" (June 2026): fabricated error events sent to a public Sentry DSN were returned by the Sentry MCP integration and executed as remediation commands; the researcher reported 85% success over 100+ runs with Claude Code, Cursor and Codex. — [OWASP GenAI roundup Q2 2026](https://genai.owasp.org/2026/07/08/genai-and-agentic-ai-exploit-roundup-q2-2026/)
- Context.ai / Vercel (disclosed 19 Apr 2026, confirmed incident): compromise of an AI vendor led through delegated OAuth to a Vercel account and to environment variables not marked sensitive. — [OWASP GenAI roundup Q2 2026](https://genai.owasp.org/2026/07/08/genai-and-agentic-ai-exploit-roundup-q2-2026/)
- Also in the roundup: Semantic Kernel prompt-to-host code execution (CVE-2026-26030, CVE-2026-25592), Langflow cross-tenant flow execution exploited in the wild 22–25 Jun 2026 (CVE-2026-55255), and "BioShocking" browser-agent manipulation. — [OWASP GenAI roundup Q2 2026](https://genai.owasp.org/2026/07/08/genai-and-agentic-ai-exploit-roundup-q2-2026/)
- Stripe: devboxes run in the QA environment with no real user data, no production access and no arbitrary network egress; a security control framework blocks destructive tool actions. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Anthropic sandboxing (20 Oct 2025): "effective sandboxing requires both filesystem and network isolation"; sandboxing cut permission prompts by 84% internally; egress goes through a proxy with a domain allowlist; in Claude Code on the web a proxy checks a scoped credential and the git operation before attaching the real token, so git credentials never enter the sandbox. — [Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing)
- Symphony exposes Linear through a `linear_graphql` tool so the Linear token is not handed to agent containers. — [Help Net Security (secondary)](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)
- Carlini's compiler agents ran with `--dangerously-skip-permissions` inside containers with no internet access. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Claude Code agent teams: a message from another agent is marked as coming from another session, cannot grant consent, and a new teammate inherits the lead's permission mode including `bypassPermissions`. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Agent identities: Cornell Tech and Yale researchers tested 10 models with a Circle agent wallet whose spending limit could be changed via a one-time code sent by email; in the impersonation scenario 5 of 10 models raised the cap and sent funds to the attacker. — [tech-insider.org (secondary)](https://tech-insider.org/ai-agents-bypass-crypto-spending-limits-cornell-yale-circle-2026/)
- Agent inbox risks named by a vendor: credential theft, prompt injection through inbound mail, unbounded sending, missing audit trail; mitigations are isolated inboxes, scoped keys, per-inbox logs. — [AgentMail (vendor)](https://www.agentmail.to/blog/info/faq/giving-an-ai-agent-its-own-inbox-security-risks-to-worry-about)
- Liability for agent payment errors is unsettled; no federal rule assigns it. — [NerdWallet](https://www.nerdwallet.com/credit-cards/news/ai-agent-makes-mistake)

### Inferences
- Baseline for a 100-agent fleet: every agent runs with permission prompts off inside a sandbox that has (1) no long-lived secrets on disk, (2) default-deny egress with an allowlist (model API, package registry mirror, git proxy), (3) a git token scoped to one repo and one branch prefix, injected by a proxy, (4) no production database or cloud-admin credentials reachable, including in dotfiles and old `.env` files (the PocketOS path).
- Split agents by trifecta leg. Agents that read untrusted input (issues, web pages, inbound email, error telemetry) get no secrets and no write path except a structured result. Agents with write access read only task specs written or approved by the operator.
- Own identities for agents (email, phone, card) widen the attack surface because the inbox doubles as an authentication channel. If used: one inbox per agent, never the inbox that receives verification codes for limits, a virtual card with a low hard limit, and human approval for any payment.
- At 100 agents the blast radius of one bad instruction file or one poisoned shared note is 100x, so changes to shared instructions deserve the same review as code that deploys to production.

### Gaps
- I did not read the original Johns Hopkins disclosure or Jer Crane's own PocketOS account; details come from OWASP and press.
- An Amazon Q / Kiro "wiper prompt" case and a Mastra npm compromise appeared in search summaries with 2026 dates but I could not verify either against a primary source.
- No published incident involves a fleet of this size run by a solo operator; risk at that scale is extrapolated.
- No independent security review of agent email / phone / card bundles was found.

---

## 8. Observability and cost control

### Takeaway
Tokens, not servers, are the bill. The published levers are model routing (strong planner, cheap workers), prompt caching, hard per-task budgets, and per-agent telemetry exported to your own stack.

### Cited Findings
- Anthropic list prices per million tokens (input / output): Fable 5.2 $8 / $40; Opus 5.5 $4 / $20; Sonnet 5.5 $2 / $10; Haiku 5.5 $0.10 / $0.50 for prompts up to 100k tokens and $0.50 / $2.50 above; Haiku 4.5 $1 / $5. Cache reads cost 0.025x base input on Fable 5.2 and 0.05x on Opus 5.5 and Sonnet 5.5. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Batch API: "50 percent discount on both input and output tokens", stackable with caching, not available for Managed Agents or fast mode. Fast mode doubles the price (Opus 5.5 $8 / $40) for up to 2.5x output speed. Models from Claude 4.7 on use a tokenizer producing about 30% more tokens for the same text. — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Claude Code enterprise averages: about $13 per developer per active day, $150–250 per developer per month, under $30 per active day for 90% of users. "Agent teams use approximately 7x more tokens than standard sessions when teammates run in plan mode." — [Claude Code docs](https://code.claude.com/docs/en/costs)
- Claude Code telemetry: OpenTelemetry export "is the only option that streams per-user token and cost metrics into your own observability stack in near real time"; `/usage` shows per-session cost and prompt-cache hit share; an LLM gateway such as LiteLLM tracks spend per key. In-process teammates get a five-minute cache TTL by default. — [Claude Code docs](https://code.claude.com/docs/en/costs); [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Cursor's SQLite-in-Rust runs (reported 26 Jul 2026): Opus 4.8 planner + Composer 2.5 workers $1,339; Grok 4.5 solo $1,928; Fable 5 planner + Composer workers $2,234; Opus 4.8 solo $5,153; GPT-5.5 solo $10,565; Fable 5 solo $20,057. Workers used at least 69% and usually over 90% of tokens; in the Opus hybrid the planner was a small token share but about two thirds of the bill; the worker fleet cost $411. Totals ranged from 2.6 to 14.7 billion tokens. — [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)
- Cognition's "smart friend" inverts the routing: a fast cheap primary calls a strong model as a tool; it failed when the primary was too weak to know when to escalate. — [Cognition](https://cognition.com/blog/multi-agents-working)
- Kilo engineers plan with a slow thinking model and execute with a faster or cheaper one. — [Kilo blog](https://blog.kilo.ai/p/how-7-kilo-code-engineers-run-up)
- Stripe uses deterministic blueprint nodes to save tokens and CI cost. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- Carlini logs each run under `agent_logs/` keyed by commit hash. OpenAI gives each agent environment a queryable logs / metrics / traces stack (Vector into Victoria Logs, Metrics and Traces). — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler); [BestHub (secondary)](https://www.besthub.dev/articles/how-openai-s-harness-engineering-lets-agents-write-1-million-lines-of-code-without-human-hands-17e2e603fa38)
- Anthropic monitors agent decision patterns and interaction structure rather than conversation content. — [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- Rate limits: Anthropic enforces requests, input tokens and output tokens per minute at organisation level, so spreading load over several keys does not raise the ceiling. Secondary sources disagree on Tier 4 values (2M vs 10M input tokens per minute) and one reports a 26 Jun 2026 restructuring into Start / Build / Scale tiers. Search excerpts only. — [dev.to (secondary)](https://dev.to/claudeguide/claude-api-rate-limits-tier-1-4-429-recovery-2026-3oae); [knightli.com (secondary)](https://knightli.com/ja/2026/06/29/claude-api-rate-limits-rpm-itpm-otpm-429/)
- Subscription plans meter Claude Code on a rolling five-hour window and a weekly window per seat. — [Claude Code docs](https://code.claude.com/docs/en/costs)

### Inferences
- Token intensity from published runs: Carlini's fleet averaged about $89 per agent per day ($20,000 / 16 agents / 14 days). Anthropic's three-role harness burned about $33 per hour ($200 / 6 h; $124.70 / 3.8 h) on Opus-class models. Scaled naively, 100 always-on agents cost roughly $9,000 per day at Carlini's intensity. That is two orders of magnitude above the server bill.
- Routing is the largest lever: Cursor's hybrid cost 3.8x less than the same planner model working alone and 7.9x less than GPT-5.5 alone. With current Anthropic prices the spread between Opus 5.5 and Haiku 5.5 output is 40x, so the default for a fleet should be a cheap worker model with escalation, and a strong model only for planning, judging and hard cases.
- A cheap planner can be a false economy: Cursor's Fable 5 planner used fewer planning tokens but made workers spend more, so cost must be measured per completed task, not per role.
- Minimum telemetry per task: task ID, agent ID, model, input / cached / output tokens, dollars, wall time, tool-call count, last-progress timestamp, final status. Enforce a dollar cap per task in the dispatcher and a daily cap per workspace at the provider.
- Caching only pays if the prefix is stable and requests arrive within the TTL. Idle agents that wake after the TTL re-pay the full context, so either keep agents busy or terminate them.
- A 100-agent fleet on one flat-rate subscription seat is not plausible given per-seat five-hour and weekly windows; plan on API billing with workspace limits or on multiple seats.

### Gaps
- Current official Anthropic rate-limit tables were not retrieved; secondary sources conflict.
- No published per-task cost distribution for a production fleet (only totals and averages).
- Cursor's token and cost figures are second-hand.
- Exact subscription limits for many parallel sessions were not found in primary docs.

---

## 9. Human attention as the bottleneck

### Takeaway
Reported ratios split cleanly by mode. Interactive supervision tops out at about 2–5 agents per person. Fleets of 16 to several hundred agents per person exist only where the human has stopped supervising agents and instead manages a work queue with automated gates.

### Cited Findings
- Addy Osmani (7 Apr 2026): personal ceiling "somewhere around three to four threads"; "What scales is your throughput of supervision, not your throughput of understanding"; names an "ambient anxiety tax"; says judgment calls "can't be batched or deferred"; "Start with one thread less than feels right." — [Addy Osmani](https://addyosmani.com/blog/cognitive-parallel-agents/)
- Simon Willison, quoted there: four agents in parallel, "work until 11am, and you're wiped out for the day." — [Addy Osmani](https://addyosmani.com/blog/cognitive-parallel-agents/)
- Kilo (26 May 2026): "Most of our engineers have 2-4 foreground agents running at a time"; one engineer runs over 20 agents but only 1–3 in the foreground; "It's simply next to impossible to have 20 agents working in the background and pay attention to them equally." Mitchell Hashimoto is cited as running at most two. — [Kilo blog](https://blog.kilo.ai/p/how-7-kilo-code-engineers-run-up)
- Stripe engineers typically run one devbox per task, sometimes half a dozen at once. — [Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)
- OpenAI Codex lead "Tibo" reportedly ran 10–15 agents in parallel and does not want to return to that style of multitasking (Aug 2026 interview). — [BestHub (secondary)](https://www.besthub.dev/articles/openai-codex-lead-why-juggling-10-ai-agents-isn-t-the-future-68df5d3cff2a)
- Unsupervised ratios: Carlini, one person and 16 agents for two weeks; Cursor, several hundred agents running a week "without intervention once started"; OpenAI, three (later seven) engineers and about 1,500 PRs in five months. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler); [Cursor](https://cursor.com/blog/self-driving-codebases); [BestHub (secondary)](https://www.besthub.dev/articles/how-openai-s-harness-engineering-lets-agents-write-1-million-lines-of-code-without-human-hands-17e2e603fa38)
- Gas Town is described as letting one developer manage 20–30 parallel coding agents (search excerpt; Maggie Appleton's piece says "dozens"). — [ascii.co.uk (secondary)](https://ascii.co.uk/news/article/news-20260102-190a5f9f/steve-yegge-releases-gas-town-multi-agent-orchestrator-for-c); [Maggie Appleton (secondary)](https://maggieappleton.com/gastown)
- Symphony's stated shift: "Teams move from managing coding agents to managing the work that needs to get done." — [Help Net Security (secondary)](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)
- Ramp: adoption followed startup speed and zero setup; clients are Slack, web and a Chrome extension, with all clients synced to one session. — [Modal](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal)
- Maggie Appleton on Gas Town: with implementation fast, "Design becomes the limiting factor." — [Maggie Appleton](https://maggieappleton.com/gastown)
- Claude Code teams: teammate permission prompts bubble up to the lead and "can create friction"; pre-approve common operations. — [Claude Code docs](https://code.claude.com/docs/en/agent-teams)

### Inferences
- One person cannot attend to 100 agents. The workable design gives the human three queues instead: (1) decisions that block an agent (ideally none; a blocked task should park and the agent should take another), (2) finished work awaiting sampled review, (3) exceptions (budget cap hit, stuck, security rule triggered). Everything else is silent.
- Osmani says judgment calls cannot be batched; Symphony and Stripe in effect do batch them by moving judgment to the ticket (before) and the PR (after). Both hold: mid-task interruptions do not batch, so design tasks to need none.
- Rough capacity planning from the 30-minute review budget: at 16 reviews per working day a person can properly review the output of about 16 tasks. If 100 agents finish 300 tasks per day, at least 95% must clear automated gates without human review, or task throughput must be throttled to review capacity.
- The scarce resource moves upstream to specification and design. Budget operator time for writing specs and maintaining gates, not for watching agents.

### Gaps
- No controlled study of agents-per-human was found; all ratios are self-reports.
- Published designs for attention queues and notification policy are scarce; I found practice descriptions (Slack threads, tracker statuses) but no evaluated design.
- The "50–100 agents at once" social-media claims cited by Kilo are unverified.

---

## 10. Documented failure modes at scale and mitigations

### Takeaway
The failures repeat across sources: lock contention and merge storms, risk-averse agents that avoid hard problems, duplicated or lost work, premature "done", drift over long runs, silent stalls, and runaway spend. Each has a published mitigation, and almost all mitigations are structural.

### Cited Findings
- Coordination collapse: 20 agents on a shared lock file ran at the throughput of 2–3; the old flat swarm generated over 70,000 merge conflicts in two hours. Mitigation: hierarchy, isolated workers, ownership of slices, neutral merge agent. — [Cursor](https://cursor.com/blog/scaling-agents); [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)
- Risk aversion: flat agents "made small, safe changes"; nobody owned hard problems. Mitigation: planners that own scope and workers "solely responsible for driving [tasks] to completion". — [Cursor](https://cursor.com/blog/scaling-agents); [Cursor](https://cursor.com/blog/self-driving-codebases)
- Duplicated and lost work: in Gas Town "some bugs get fixed 2 or 3 times. Other fixes get lost"; Cursor reports "split-brain" planners duplicating work; Anthropic's early research subagents duplicated searches under vague briefs. Mitigation: a ledger of work items with atomic claims, explicit task boundaries. — [Steve Yegge (primary returned 403; quote via search excerpt)](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04); [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/); [Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- All agents stuck on the same problem: 16 compiler agents hit the same kernel bug. Mitigation: oracle-based task splitting. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler)
- Premature completion and self-praise: single agents "declared success prematurely"; later sessions saw progress and declared the project done; generators over-rate their own work. Mitigation: external feature list, separate evaluator, end-to-end browser testing. — [Cursor](https://cursor.com/blog/self-driving-codebases); [Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Drift and tunnel vision on long runs: periodic fresh starts still required; Opus 4.5 "tended to stop earlier and take shortcuts" in Cursor's January tests. — [Cursor](https://cursor.com/blog/scaling-agents)
- Role overload: one agent given planning, spawning, merging and judging slept randomly, did the work itself, refused to plan and claimed completion early. Mitigation: one role per agent. — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Serial bottlenecks introduced by quality roles: the integrator and the strict "100% correct before commit" rule both serialised the system. — [Cursor](https://cursor.com/blog/self-driving-codebases)
- Code bloat as a silent failure: the old swarm produced 54 crates and 64,305 engine lines where the new one produced nine crates and 9,908 lines. — [The Decoder (secondary)](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)
- Entropy: OpenAI spent about 20% of the week on "AI slop" until clean-up was automated. — [BestHub (secondary)](https://www.besthub.dev/articles/how-openai-s-harness-engineering-lets-agents-write-1-million-lines-of-code-without-human-hands-17e2e603fa38)
- Silent stalls and wasted time: Claude "will happily spend hours running tests instead of making progress"; team tasks left unmarked block dependents; teammates stop after errors. — [Anthropic](https://www.anthropic.com/engineering/building-c-compiler); [Claude Code docs](https://code.claude.com/docs/en/agent-teams)
- Resource exhaustion: disk I/O from hundreds of concurrent builds; mass `git restore` contention; machine exhaustion with no visibility. — [Cursor](https://cursor.com/blog/self-driving-codebases); [claudeissues.com](https://claudeissues.com/issue/84849-background-agents-can-exhaust-the-machine-unnoticed-no-visibility-into-spawned-p)
- Runaway cost: 63 catalogued overrun incidents, retry loops the largest cluster. — [arXiv 2606.04056](https://huggingface.co/papers/2606.04056)
- Destructive overreach: PocketOS production volume deleted in one call. — [heise](https://heise.de/-11279570)
- Research on framework-level failures: MAST found design and inter-agent misalignment dominate, and that fixes need structural redesign rather than prompt patches. — [arXiv](https://arxiv.org/abs/2503.13657v2)

### Inferences
- The failure list is a design checklist: every mitigation is either "remove shared mutable coordination", "add an external definition of done", "separate author from judge", or "put a hard limit in code".
- Several failures are invisible in success metrics. Tests can pass on a bloated, duplicated codebase, so track lines of code, dependency count and conflict rate per task alongside pass rate.

### Gaps
- Yegge's own retrospective numbers (spend, accounts, loss rate) could not be read in the primary.
- No source reports failure frequencies at exactly 100 agents; evidence is from 16, 20 and several hundred.

---

## 11. Synthesis: an opinionated reference architecture for 100 agents and one operator, and what breaks first from 5 to 100

### Takeaway
Build a task factory, not a swarm: a tracker as queue, a thin dispatcher, one disposable sandbox per task, cheap workers under strong planners, layered automated gates, and a human who sees only exceptions and samples. The order in which things break when scaling is attention, then review, then merge contention, then rate limits and spend, and hardware last.

### Cited Findings
- All building blocks are taken from the cited systems: tracker-as-state-machine with per-issue workspaces ([Symphony coverage](https://www.helpnetsecurity.com/2026/04/28/openai-symphony-codex-orchestration-linear/)); warm, disposable per-task machines without production access or open egress ([Stripe](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2)); snapshot refresh every 30 minutes ([Modal / Ramp](https://modal.com/blog/how-ramp-built-a-full-context-background-coding-agent-on-modal)); recursive planners with isolated workers ([Cursor](https://cursor.com/blog/self-driving-codebases)); clean-context review loop and single-threaded writes per PR ([Cognition](https://cognition.com/blog/multi-agents-working)); feature list and progress file as external definition of done ([Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)); oracle and agent-friendly tests ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler)); credential proxy and egress allowlist ([Anthropic](https://www.anthropic.com/engineering/claude-code-sandboxing)); strong planner with cheap workers ([The Decoder on Cursor](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)).
- Scaling evidence by stage: 3–4 threads is the interactive ceiling ([Addy Osmani](https://addyosmani.com/blog/cognitive-parallel-agents/)); 3–5 teammates is Anthropic's recommended team size ([Claude Code docs](https://code.claude.com/docs/en/agent-teams)); at 16 agents a loop harness with git locks still worked but needed an oracle ([Anthropic](https://www.anthropic.com/engineering/building-c-compiler)); at 20 agents shared locks collapsed ([Cursor](https://cursor.com/blog/scaling-agents)); at 20–30 agents work was duplicated and lost ([Yegge, primary 403](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)); at hundreds, disk I/O and version control became limits and Cursor built its own VCS ([Cursor](https://cursor.com/blog/self-driving-codebases); [The Decoder](https://the-decoder.com/cursors-agent-swarm-suggests-cheaper-models-can-handle-most-coding-when-frontier-models-plan-the-work/)).

### Inferences

**Reference architecture (my synthesis)**
1. Work intake: a tracker (Linear, GitHub Issues or Beads) is the only queue. Status is the state machine: `ready → claimed → running → verifying → needs-human | merged | failed`. Each item carries objective, owned paths, acceptance command, budget and risk class.
2. Planning lane: a strong model turns goals into task items and writes the acceptance criteria. Planners write no code. The operator approves plans for anything above a size or risk threshold, in a batch, once or twice a day.
3. Dispatcher: a small deterministic service (a durable workflow if available, otherwise a loop with leases) that claims atomically, starts a sandbox from the latest snapshot, injects the spec, enforces wall-clock, no-progress and dollar limits, and writes the result back. Retries are capped in code (two CI rounds, then `needs-human`).
4. Execution: one container or microVM per task on a single large dedicated server or a managed sandbox provider. No production credentials, default-deny egress, git through a scoping proxy, one branch per task ID. Worktrees only for a handful of local, read-heavy sessions.
5. Workers: cheap fast model by default, one task, one branch, no peer communication, structured handoff. Escalate to a strong model on repeated failure.
6. Verification: local checks in the sandbox, CI as arbiter, a reviewer agent with clean context (diff + spec only), a merge queue that re-tests against main, risk-based human sampling.
7. Shared context: short root instruction file as a map, scoped rules, skills on demand, docs in the repo changed only by PR, a capped field guide.
8. Observability: per-task token and dollar accounting through OpenTelemetry or a gateway, a board showing tasks by state and age, alerts only for exceptions.
9. Kill switches: per-task budget, per-day workspace spend limit at the provider, a global "pause dispatch" flag, and the ability to revoke the git proxy token in one step.

**What breaks first, in order**
- 5 agents: human attention. Symptom: the operator is the scheduler and cannot keep up with prompts and context switches. Fix: stop watching sessions, write specs, run headless.
- 5–15: review. Diffs pile up faster than they can be read. Fix: reviewer agents, task sizing by reviewability, CI gates.
- 10–30: shared-state contention. Same-file edits, merge conflicts, duplicated and lost fixes, local ports and databases colliding. Fix: per-task sandboxes, ownership of paths, atomic claims, a merge queue.
- 20–50: provider limits and spend. Subscription windows and API rate limits throttle the fleet; an unattended loop becomes expensive. Fix: API billing with workspace limits, model routing, budgets in the dispatcher.
- 50–100: stuck and silent agents, plus security surface. Without heartbeats nobody notices a stalled or looping agent; one broad token is now reachable by 100 processes. Fix: stall detection, scoped credentials, egress control.
- 100 and beyond: backlog and hardware. The supply of well-specified independent tasks runs out before compute does; then disk I/O and version-control throughput. Fix: invest in planning and specs; snapshots, copy-on-write storage, build caches.

**Budget framing**
- Compute for 100 agents on a budget European host is on the order of €300–900 per month. Tokens at published intensities are on the order of thousands of dollars per day with frontier models, and several times less with a strong-planner / cheap-worker split. The financial design problem is token routing and budgets, not servers.

### Gaps
- No public write-up describes a solo operator running 100 agents sustainably with verified output quality; the architecture above is assembled from team-scale and lab-scale reports.
- The ordering of what breaks first is my reading of scattered reports at different scales, not a measured progression from one team.
- Real monthly token cost for a mixed 100-agent workload depends on duty cycle and model mix and cannot be derived from the sources more precisely than the range given.
