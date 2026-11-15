# Native first-party capabilities of Claude Code and the Anthropic platform for running many agents in parallel (state: 14 November 2026)

Method note for the report writer: all pages were fetched on 2026-11-14. Claude Code and Claude Platform doc pages carry no visible "last updated" date; the Claude Code changelog's newest entry on that day was v2.1.325, dated 13 November 2026, so the docs reflect that version range. Doc pages on code.claude.com and platform.claude.com were read as raw markdown, so quotes from them are exact. Pages on support.claude.com, claude.com/pricing, anthropic.com/legal and the engineering/blog posts came back through an extraction step; quotes from those are the fragments the extraction returned and should be treated as accurate in substance but possibly truncated.

## 1. Which mechanisms exist today and how do they differ

### Takeaway
Anthropic documents five in-product ways to run agents in parallel in Claude Code (subagents, agent view, agent teams, dynamic workflows, projects), plus supporting tools (worktrees, cross-session messaging, `/batch`), cloud surfaces (cloud sessions, cloud scheduled tasks, self-hosted environments, Remote Control) and three API-billed developer paths (Agent SDK / `claude -p`, Claude Managed Agents, Message Batches API). They differ mainly in who holds the plan (Claude turn by turn, a lead agent, a script, or you), where the work runs (your machine, Anthropic cloud, your own infrastructure) and whether usage draws on a subscription or on API tokens.

### Cited Findings

**The official overview**
- The docs state: "Claude Code has five ways to work on several tasks at once: subagents, agent view, agent teams, dynamic workflows, and projects. They differ in how involved you stay ... and in whether the work runs on your machine or in the cloud." — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- "In every approach the workers are Claude sessions. To involve a different tool, expose it to Claude as an MCP server." — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Official chooser: Claude delegates inside one conversation → subagents; you hand off independent tasks and check back → agent view; Claude plans, assigns and supervises workers → agent teams ("experimental and disabled by default"); "A script holds the plan instead of Claude's turn-by-turn judgment" → dynamic workflows. — [Run agents in parallel](https://code.claude.com/docs/en/agents)

**Inside one session**
- Subagents: "Delegated workers inside one session that do a side task in their own context and return a summary." Spawned with the Agent tool; "With nothing configured, a subagent that Claude spawns from your main conversation starts in the background." A forked subagent (`/subtask`) inherits the full conversation. — [Run agents in parallel](https://code.claude.com/docs/en/agents); [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- The tool is called the Agent tool. "Task tools" in current docs means the shared task list tools (`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`), not the subagent spawner. — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- `/batch` "is a skill that has Claude split one large change into 5 to 30 worktree-isolated subagents. It's a packaged use of subagents and worktrees, not a separate coordination style." — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Dynamic workflows: "A dynamic workflow is a JavaScript script that orchestrates many subagents at once. Claude writes the script for the task you describe, and a runtime executes it in the background while your session stays responsive." Scale row in the comparison table: "Dozens to hundreds of agents per run" versus "A few delegated tasks per turn" for subagents and "A handful of long-running peers" for agent teams. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Ways to start a workflow: the keyword `ultracode` in a prompt you type, asking in your own words ("use a workflow"), `/effort ultracode` (Claude then "plans a workflow for every substantive task in the session"), or a bundled/saved command. `/deep-research` is the one bundled workflow. Script primitives are `agent()`, `pipeline()`, `parallel()`, `phase()`, `log()`. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- "Dynamic workflows are available on all paid plans, with Anthropic API access, and on Amazon Bedrock, Google Cloud's Agent Platform, and Microsoft Foundry. On Pro, turn them on from the Dynamic workflows row in `/config`." They work in "the CLI, the Desktop app, the IDE extensions, non-interactive mode with `claude -p`, and the Agent SDK". — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Agent teams: "Agent teams are experimental and disabled by default. Enable them by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`". One session is lead; teammates are "a full, independent Claude Code session" each, with a shared task list and a mailbox; they message each other directly. — [Agent teams](https://code.claude.com/docs/en/agent-teams)

**Many local sessions**
- Agent view: "Agent view, opened with `claude agents`, is one screen for all your background sessions: what's running, what needs your input, and what's done." It is "in research preview". Sessions are started with `claude --bg "<prompt>"`, `/background` or `←`; "A separate supervisor process runs them, so you can close agent view, close your shell, or start a new interactive session and your dispatched work keeps going." Introduced in v2.1.139. — [Agent view](https://code.claude.com/docs/en/agent-view)
- Worktrees "give each session a separate git checkout"; a session dispatched from agent view "moves into a worktree of its own before it edits files" (under `.claude/worktrees/`), and a subagent can be given `isolation: worktree`. — [Run agents in parallel](https://code.claude.com/docs/en/agents); [Agent view](https://code.claude.com/docs/en/agent-view); [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- Cross-session messaging "lets Claude list and message your other Claude Code sessions on this machine, on another machine, or in the cloud". — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Headless mode: "The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code. It's available as a CLI for scripts and CI/CD, or as Python and TypeScript packages". `claude -p` output formats are `text`, `json` and `stream-json`; `--bare` skips hooks, skills, plugins, MCP servers, auto memory and CLAUDE.md. — [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- Remote Control "connects claude.ai/code or the Claude app ... to a Claude Code session running on your machine"; "Claude keeps running locally the entire time". A server mode (`claude remote-control`) serves multiple concurrent sessions from one process. — [Remote Control](https://code.claude.com/docs/en/remote-control)

**Anthropic cloud, tied to a claude.ai account**
- Cloud sessions (Claude Code on the web): "A cloud session is a Claude Code session that runs on cloud infrastructure instead of on your machine." Started from claude.ai/code, mobile, desktop, `claude --cloud` (`--remote` is a deprecated alias) or scheduled tasks; pulled back with `--teleport`. "each session runs in an isolated, Anthropic-managed VM". — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Projects: "A project is one ongoing conversation where Claude coordinates a stream of related work for you. You tell it what needs doing and it starts a thread for each task." Each thread is usually a cloud session, or a session on your computer through Remote Control. "Projects are in public beta on Pro, Max, and Ultra plans and rolling out gradually ... Projects aren't offered on Team or Enterprise plans yet." — [Projects](https://code.claude.com/docs/en/claude-projects)
- Cloud scheduled tasks (formerly routines): "a saved Claude Code configuration: a prompt, one or more repositories, and a set of connectors, packaged once and run automatically". Triggers: schedule, API (HTTP POST to a per-task `/fire` endpoint), GitHub events. "Scheduled tasks are in research preview." — [Scheduled tasks](https://code.claude.com/docs/en/routines)
- Self-hosted environments: "A self-hosted environment executes Claude Code cloud sessions on infrastructure your organization operates"; "public beta on Team and Enterprise plans and are off by default". The control plane stays Anthropic-hosted. — [Self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments)
- Related first-party surfaces that also run agents in Anthropic's cloud: Code Review (automatic PR review), Ultrareview ("a deep multi-agent code review in a cloud sandbox"), Claude Tag ("an organization-managed @Claude in Slack that runs on the same cloud infrastructure"), auto-fix for pull requests. — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- GitHub Actions: `anthropics/claude-code-action` "runs Claude Code inside your repository's workflows" and "is built on the SDK". — [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)

**Developer platform**
- Agent SDK: "A library that runs the Claude Code binary, with Claude Code's capabilities, such as built-in tools, permissions, sessions, and hooks", for embedding "in a process you operate". — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- Claude Managed Agents: "Pre-built, configurable agent harness that runs in managed infrastructure. Best for long-running tasks and asynchronous work." Four concepts: agent, environment, session, events. Status: "Claude Managed Agents is in beta. All Managed Agents endpoints require the `managed-agents-2026-04-01` beta header." Sessions run in "an Anthropic-managed cloud sandbox, or a self-hosted sandbox on your own infrastructure"; scheduled deployments run agents on a cron schedule. — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- Managed Agents has its own multi-agent layer: subagents (each in a "session thread"), dynamic workflows ("a program that runs many agents in the background and combines their results") and an advisor model. — [Multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)
- Message Batches API: asynchronous processing of Messages requests, "most batches finishing in less than 1 hour while reducing costs by 50 percent". — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)

### Inferences
- The mechanisms form three layers that can be stacked: orchestration inside a session (subagents, workflows, teams), a session fleet (agent view, cloud sessions, projects, scheduled tasks) and a programmable runtime (Agent SDK, Managed Agents). A home-built dashboard that spawns `claude -p` processes reimplements the middle layer; agent view locally and Projects/cloud sessions remotely are the first-party equivalents.
- Dynamic workflows are the only in-product mechanism whose documented scale ("dozens to hundreds of agents per run") matches a 100-agent target in a single run.
- Agent teams are the weakest fit for fleets: experimental, interactive only, and described as "a handful of long-running peers".

### Gaps
- No public doc page uses the name "FleetView" or "fleet"; the documented overview UI is "agent view". Whether "FleetView" is an internal or newer name could not be verified from primary sources.
- The Desktop app's parallel-session view, Dispatch, Desktop scheduled tasks and Claude Tag were confirmed to exist from the docs index and cross-references but their pages were not read in detail. — [Docs index](https://code.claude.com/docs/llms.txt)
- Introduction dates for dynamic workflows, Projects and the routines→scheduled-tasks rename were not found; the changelog is about 1.27 million characters and only its newest part was read. — [Changelog](https://code.claude.com/docs/en/changelog)

## 2. For each mechanism: concurrency limits, where it runs, how it is billed, unattended operation

### Takeaway
Documented hard limits are modest and mostly configurable: 20 concurrent subagents per session, 16 concurrent workflow agents by default (settable up to 256) with 1,000 agents per run, 64 concurrent threads per Managed Agents workflow run, 32 sessions per Remote Control server, 100 scheduled cloud runs per hour, 500 new project threads per day. The real ceiling on a subscription is quota, which the docs say scales linearly with the number of parallel sessions; on the API it is the tier's token rate limits and monthly spend cap.

### Cited Findings

| Mechanism | Documented concurrency limit | Runs on | Billing | Unattended |
|---|---|---|---|---|
| Subagents | 20 concurrent per session by default; nesting 3 layers | Same machine/session as parent | Parent session's plan or API | Yes, background by default |
| `/batch` | 5 to 30 worktree-isolated subagents | Local | Same as session | Within a session |
| Dynamic workflows (Claude Code) | 16 concurrent by default, 1–256 via env var; 1,000 agents per run; 4,096 items per call | Local runtime (also in cloud sessions) | Plan usage or API | Yes, also under `claude -p` |
| Agent teams | "no hard limit"; 3–5 recommended | Local (also cloud sessions via env var) | Each teammate is a full session | Interactive sessions only |
| Agent view / `claude --bg` | No numeric cap documented | Local, supervisor daemon | Subscription quota per session, or API | Yes, until machine shuts down |
| Remote Control server mode | `--capacity` default 32 | Local | Subscription only | Yes while process and network live |
| Cloud sessions | No per-user number documented; an org-level cap exists | Anthropic VM or self-hosted runner | Plan usage, no VM charge | Yes |
| Projects | 500 new threads per day | Cloud (or own machine via Remote Control) | Plan usage | Yes |
| Cloud scheduled tasks | 100 scheduled runs/hour per account; minimum interval 1 hour | Anthropic cloud or self-hosted | Plan usage, overage via usage credits | Yes |
| `claude -p` / Agent SDK | None in the product; one subprocess per session | Your machine or infrastructure | Subscription login or API key | Yes |
| Managed Agents | 300 create and 1,200 read requests/min per org; 64 threads at once per workflow run | Anthropic sandbox or self-hosted sandbox | API tokens plus $0.08 per session-hour | Yes |
| Message Batches API | 100,000 requests or 256 MB per batch | Anthropic | API tokens at 50 percent | Yes, asynchronous |

**Subagents**
- "By default, when 20 subagents are running in a session, spawning another with the Agent tool fails with `Concurrent subagent limit reached`"; override with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` ("any positive whole number"). "There's no limit on the total number of subagents Claude can spawn over a session." — [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- "By default, a subagent can spawn subagents of its own, up to three layers below the main conversation." (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`) — [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- Each subagent "sends its own requests, which count toward the same usage limits as your main conversation." — [Create custom subagents](https://code.claude.com/docs/en/sub-agents)

**Dynamic workflows in Claude Code**
- "Up to 16 concurrent agents by default, fewer when Claude Code has fewer CPUs available ... To change the limit, set `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` to a value from 1 to 256, which requires Claude Code v2.1.269 or later." Reason given: "Bounds local resource use". — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- "1,000 agents total per run" ("Prevents runaway loops") and "Up to 4,096 items in a single `parallel()` or `pipeline()` call". — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- "No mid-run user input"; the script has "No direct filesystem or shell access"; a stalled agent restarts "at most five times". — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Advisory only: "When a workflow schedules more than 25 agents, or its projected token total passes 1.5 million, its progress line ... shows a `Large workflow` warning." Size guideline setting: `small` fewer than 5 agents, `medium` fewer than 10, `large` fewer than 50; default `medium`, or `small` on Pro. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Billing: "A workflow spawns many agents, so a single run can use meaningfully more tokens than working through the same task in conversation. Runs count toward your plan's usage and rate limits." — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Headless behaviour: the `ultracode` keyword does not start a workflow from "a prompt passed with `-p`", an unstamped Agent SDK prompt, "a scheduled task prompt" or a webhook payload. In `claude -p` and the SDK the Workflow tool call goes through normal permission evaluation; allow it with a `Workflow` permission rule. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Usage-limit pause works only in interactive sessions: "A run doesn't pause in non-interactive mode with `claude -p` or the Agent SDK, in a background session, or in a Remote Control or agent team teammate session"; there the affected agent fails. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- A run does not continue on its own if you background or exit the session; Claude must relaunch it, which replays saved results. — [Dynamic workflows](https://code.claude.com/docs/en/workflows)

**Agent teams**
- "There's no hard limit on the number of teammates"; "Start with 3-5 teammates for most workflows." "One team per session", "No nested teams", no session resumption for in-process teammates. — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- "Spawning teammates also requires an interactive session. In non-interactive mode with the `-p` flag, including Agent SDK sessions, Claude doesn't spawn teammates". — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- "Letting a team run unattended for too long increases the risk of wasted effort." — [Agent teams](https://code.claude.com/docs/en/agent-teams)

**Agent view and background sessions**
- "Rate limits apply: background sessions consume your subscription usage the same as interactive sessions, so running ten agents in parallel uses quota roughly ten times as fast as running one." — [Agent view](https://code.claude.com/docs/en/agent-view)
- "Sessions are local: background sessions run on your machine. They are preserved across sleep but stop if the machine shuts down." — [Agent view](https://code.claude.com/docs/en/agent-view)
- An idle unattached session's process is stopped after "about an hour" and restarted on attach. `claude --bg` combined with `-p` is rejected. — [Agent view](https://code.claude.com/docs/en/agent-view)
- A background session that isolated its work in a worktree "commits, pushes its own isolated branch, never `main` or `master`, and opens a draft pull request when it finishes" (since v2.1.198). — [Agent view](https://code.claude.com/docs/en/agent-view)

**Headless `claude -p`**
- Unattended controls: `--permission-prompts none` (v2.1.259+), `--permission-mode auto|dontAsk|acceptEdits`, `--allowedTools`, `--max-budget-usd`; "With Claude Code v2.1.302 or later, `claude -p` runs start in Manual mode when nothing sets a permission mode." — [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." And: "In bare mode, Claude Code never reads OAuth credentials or the system keychain"; "bare mode doesn't use your subscription login". — [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- `--output-format json` returns `total_cost_usd`; both figures "are client-side estimates". Background subagents and workflows keep a `-p` run open until done or a 10-minute idle cap (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). — [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- Subscription auth for scripts: `claude setup-token` generates "a one-year OAuth token" used as `CLAUDE_CODE_OAUTH_TOKEN`; "This token authenticates with your Claude subscription and requires a Pro, Max, Ultra, Team, or Enterprise plan." In `-p` mode `ANTHROPIC_API_KEY` "is always used when present" and outranks the subscription login. — [Authentication](https://code.claude.com/docs/en/authentication)

**Agent SDK self-hosting**
- "One agent session maps to one subprocess. Running N concurrent sessions means N subprocesses". "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point"; the 1 GiB is "a floor, not the ceiling". Sizing formula: "agents per host = (host RAM - overhead) / (per-session RAM ceiling)". — [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting)
- "Anthropic token cost typically dominates container infrastructure cost by an order of magnitude or more. A minimally provisioned container runs roughly $0.05 per hour, while a single long agent session can spend dollars in tokens." — [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting)
- Known limitation: "Large parallel-subagent fanouts can hit rate limits — Break work into smaller batches rather than issuing one wide dispatch." — [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting)
- If you do not need to run the loop yourself, "consider Managed Agents instead." — [Hosting the Agent SDK](https://code.claude.com/docs/en/agent-sdk/hosting)

**Cloud sessions, Projects, scheduled tasks**
- Cloud sessions are "available on Pro, Max, Ultra, and Team plans, and for Enterprise users with premium seats or Chat + Claude Code seats." A session "counts toward your plan's usage limits alongside the rest of your Claude and Claude Code usage, and there's no separate charge for the cloud VM." — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- "each `--cloud` command creates its own cloud session that runs independently"; "Rate limits: cloud sessions share rate limits with all other Claude and Claude Code usage within your account. Running multiple tasks in parallel consumes more rate limits proportionately." — [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Cloud sessions need a claude.ai login ("Cloud sessions always use your subscription credentials"), are unavailable with Bedrock/Vertex/Foundry, and repository cloning and PR creation require GitHub. — [Authentication](https://code.claude.com/docs/en/authentication); [Use Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- An organization-level concurrency cap exists but is not quantified: error text "The last run didn't start because your organization had reached its limit on cloud sessions running at once." — [Scheduled tasks](https://code.claude.com/docs/en/routines)
- Projects: "Running threads: each is a full session, and several can run at once. There's no fixed number ... The enforced limit is 500 new threads per day across your projects." A new project "runs every thread on Opus at high effort, which draws on your plan fastest". — [Projects](https://code.claude.com/docs/en/claude-projects)
- Scheduled tasks hourly limits: scheduled runs "100 per hour" per account; Run now and API fires "30 per hour" per task; API fires "100 per hour" per account; "None of these hourly limits has overage." Cron: "Expressions that run more often than once per hour are rejected." — [Scheduled tasks](https://code.claude.com/docs/en/routines)
- "Scheduled tasks are available on Pro, Max, Ultra, Team, and Enterprise plans." They "belong to your individual claude.ai account. They are not shared with teammates, and their runs count against your account's usage and limits." — [Scheduled tasks](https://code.claude.com/docs/en/routines)
- "Scheduled tasks draw down subscription usage the same way interactive sessions do." With usage credits on, tasks "can keep running ... on metered overage". The `/fire` endpoint needs beta header `experimental-cc-routine-2026-04-01` and "is available to claude.ai users only and is not part of the Claude Platform API surface." — [Scheduled tasks](https://code.claude.com/docs/en/routines)
- Self-hosted environments: a runner "runs up to `--capacity` concurrent sessions" for one owner; an autoscaling orchestrator can start runners as sessions queue; "sessions in a self-hosted environment consume your organization's Claude Code usage the same way sessions in Anthropic-hosted environments do." — [Self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments)

**Remote Control**
- "`--capacity <N>` Maximum number of concurrent sessions. Default is 32." `--spawn worktree` gives each on-demand session its own git worktree. "Subscription: available on Pro, Max, Ultra, Team, and Enterprise plans. API keys are not supported." — [Remote Control](https://code.claude.com/docs/en/remote-control)

**Managed Agents**
- Rate limits per organization: "Create endpoints (for example, agents, sessions, and environments) 300 requests per minute"; "Read endpoints ... 1,200 requests per minute"; "separate from the Messages API rate limits". — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- Workflow run limits: "Threads working at once in one run: 64" ("The API doesn't guarantee this number"); "Agents a workflow starts over the run's whole life: 1,000"; "Run lifetime: 24 hours by default"; "Runs open at once in a session: 10 by default". — [Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)
- Subagents: "The agent can delegate to only one level of agents"; a `predefined_agents` list holds "up to 20 unique agents"; a "25-child-thread limit" per session is referenced. "All agents share the same sandbox, filesystem, and vault credentials, but each agent runs in its own session thread". — [Multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)
- Billing: "billed on two dimensions: tokens and session runtime"; "Session runtime $0.08 USD per session-hour", accruing "only while the session's status is `running`"; no Batch discount ("Sessions are stateful and interactive. There is no batch mode."). — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- "Managed Agents is not currently eligible for Zero Data Retention or HIPAA Business Associate Agreement (BAA) coverage", except self-hosted Managed Agents for ZDR. — [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)

**Message Batches API**
- "A Message Batch is limited to either 100,000 Message requests or 256 MB in size"; "most batches completing within 1 hour"; "Batches expire if processing does not complete within 24 hours"; results available 29 days. Tool use including server tools can be batched; `stream: true` and fast mode cannot. — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- Queue limits by tier: Start 200,000 batch requests in queue, Build 300,000, Scale 500,000. "The Message Batches API isn't subject to ramp limits." — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)

**GitHub Actions and Code Review**
- The action accepts `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` ("an OAuth token that authenticates with your Claude subscription"), or workload identity federation; "If you authenticate with an OAuth token, runs use your Claude subscription instead of API billing." For org-wide use: "authenticate with an API key ... rather than an OAuth token, since an OAuth token is tied to the subscription of the person who ran `claude setup-token`." — [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- "Code Review is billed on token usage through usage credits, separately from your plan's included usage." — [Code Review costs](https://code.claude.com/docs/en/code-review-costs)

### Inferences
- Realistic paths to roughly 100 concurrent agents, by my reading of the documented limits:
  - Agent SDK or `claude -p` with an API key on your own compute: no product-side concurrency cap, bounded by API tier limits (question 3) and hardware. Using the documented floor of 1 GiB RAM and 1 CPU per agent, 100 concurrent agents need on the order of 100 GiB RAM and 100 CPUs, which is beyond a single workstation.
  - Managed Agents: no sandbox to operate; the documented endpoint limit of 300 creates per minute does not constrain 100 sessions. Session runtime for 100 sessions running around the clock would be 100 × 24 × 30 × $0.08 = $5,760 per month before tokens (runtime accrues only while `running`).
  - A single dynamic workflow: 100 concurrent agents is within the 1–256 configurable range, but all agents share one machine and one account's limits, and a run is capped at 1,000 agents.
  - Team/Enterprise cloud sessions, optionally on self-hosted runners: supported for unattended work, but usage draws on per-seat allowances plus usage credits and an unquantified org concurrency cap.
- A single consumer subscription is not a realistic basis for 100 concurrent agents: the docs say quota use is roughly proportional to the number of parallel sessions, and non-interactive runs do not wait for a limit to reset (workflow agents under `claude -p` fail at the limit instead of pausing).
- The announced future default of `--bare` for `-p` matters for a home-built dashboard: bare mode never reads subscription OAuth credentials or `CLAUDE_CODE_OAUTH_TOKEN`, so scripts relying on the subscription login will need to opt out of bare mode or move to API keys once that default ships.

### Gaps
- No documented maximum number of concurrent Managed Agents sessions per organization was found on the pages read; the Managed Agents reference page was not fetched.
- The numeric value of the organization-level "limit on cloud sessions running at once" is not published on the pages read.
- No numeric cap for agent view background sessions is documented; practical limits (RAM, CPU, quota) are not quantified by Anthropic.
- Per-seat cloud-session capacity for Team and Enterprise is not stated.

## 3. Current plan limits, API rate-limit tiers and prices relevant to fleets

### Takeaway
Consumer plans are Pro ($20), Max ($100, 5x Pro) and Ultra ($200, formerly Max 20x, 10x Pro weekly with no five-hour limit for verified accounts); Anthropic publishes multiples, not absolute token numbers. The API has Start, Build, Scale and Custom tiers whose per-minute limits are generous enough for 100 agents, but Start and Build carry monthly spend caps of $500 and $1,000; the current lineup is Fable 5.2 ($8/$40), Opus 5.5 ($4/$20), Sonnet 5.5 ($2/$10) and Haiku 5.5 (from $0.10/$0.50) per million tokens, with cache reads at 2.5–10 percent of input price and 50 percent off for batches.

### Cited Findings

**Subscription plans** (pricing page and help-center values as extracted on 2026-11-14)
- Pro: $20 monthly or $17 per month billed annually; "More usage than Free, every 5 hours and every week". Max: $100; "5x Pro usage every 5 hours and every week". Ultra: $200; "No 5-hour limit" (verified accounts) and "10x Pro usage every week". Team: Standard seat $25 monthly or $20 annual, Premium seat $125 monthly or $100 annual ("5x more usage than standard seats"), 2 to 150 seats. Enterprise: "$20/seat" with "Usage cost scales with model and task", minimum 20 seats. — [Plans & pricing](https://claude.com/pricing)
- "The Max 20x plan is now called the Ultra plan." Ultra offers "10 times the Pro plan's usage every week"; "Verified Ultra accounts don't have a five-hour limit"; unverified accounts get "a temporary limit"; verification is automatic "using factors like your account and payment history". Ultra has "a weekly usage limit that applies across all models, and a separate weekly limit for Fable." "Additional usage limits may apply to manage capacity and ensure fair access to all users." — [What is the Ultra plan?](https://support.claude.com/en/articles/17728952-what-is-the-ultra-plan)
- "Pro and Max plans have a five-hour session limit and a weekly limit." "all activity in both tools counts against the same limits" (Claude and Claude Code). The article gives no message, prompt or hour counts per plan. — [Use Claude Code with your Pro, Max, or Ultra plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)
- Fable usage on Max, Ultra and Team Premium is capped at 50 percent of weekly limits; Pro reaches Fable through usage credits. — [Plans & pricing](https://claude.com/pricing)
- Team and Enterprise in Claude Code: "each member's Claude Code usage draws from a per-seat allowance that resets on a rolling five-hour window and a weekly window. The allowance is shared with Claude chat and Cowork, and its size depends on the member's seat tier (Standard or Premium)." Usage credits with org, group or member spend limits let members continue past it. — [Manage costs effectively](https://code.claude.com/docs/en/costs)
- Usage credits: past the plan limit, usage "will be billed at standard API rates (distinct from Pro/Max/Ultra plan pricing)". — [Use Claude Code with your Pro, Max, or Ultra plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-max-or-ultra-plan)
- Prompt cache lifetime on subscriptions: "On Pro, Max, and Ultra within your plan's limits, the cache lifetime is an hour", but subagent, workflow-agent and teammate requests get five minutes by default unless `subagentPromptCacheTtl` is `1h`. — [Projects](https://code.claude.com/docs/en/claude-projects); [Dynamic workflows](https://code.claude.com/docs/en/workflows)

**Monthly API credits bundled with plans (since 7 October 2026)**
- "Claude Max, Ultra, and Team plans include monthly credits for the Claude API." Amounts: Max $100, Ultra $200, Team Standard seat $20, Team Premium seat $100, pooled and "capped at $500 USD". "Free, Pro, and Enterprise plans aren't eligible." — [API credits for subscribers](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)
- Covers "Claude API, Claude Managed Agents, the Claude Agent SDK, and playground"; does not cover "Claude Code, extra usage in the Claude apps". "Unused credits expire at the end of each billing cycle ... and don't roll over." "Credits don't change your usage limits in Claude or Claude Code." "Usage is never charged to your Claude plan." — [API credits for subscribers](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)
- "Organizations linked to an eligible plan move up to at least the Start tier. If their monthly credits are over $200 USD, they move up to at least the Build tier." — [API credits for subscribers](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers)

**API usage tiers**
- Monthly spend caps: Start $500, Build $1,000, Scale $200,000; "Organizations on the Custom tier have no monthly spend cap". New organizations "may start in the Evaluation tier, with limits below the standard limits". At the cap, "API usage pauses until 00:00 UTC on the first day of the next month, unless you request a higher limit sooner." — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- Per-minute limits (requests / uncached input tokens / output tokens):

| Model | Start | Build | Scale |
|---|---|---|---|
| Fable 5.2 | 4,000 / 500,000 / 100,000 | 10,000 / 1,500,000 / 300,000 | 13,000 / 4,000,000 / 800,000 |
| Opus 5.5 | 4,000 / 2,000,000 / 400,000 | 10,000 / 5,000,000 / 1,000,000 | 13,000 / 10,000,000 / 2,000,000 |
| Sonnet 5.5 | 4,000 / 2,000,000 / 400,000 | 10,000 / 5,000,000 / 1,000,000 | 13,000 / 10,000,000 / 2,000,000 |
| Haiku 5.5 | 4,000 / 2,000,000 / 400,000 | 10,000 / 5,000,000 / 1,000,000 | 13,000 / 10,000,000 / 2,000,000 |

  — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- "The API's default ITPM rate limits count only uncached input tokens." Cache reads "Do NOT count toward ITPM". Example: "With a 2,000,000 ITPM limit and an 80 percent cache hit rate, you could effectively process 10,000,000 total input tokens per minute". — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- Ramp limits: "After a sharp increase in usage, requests can return a 429 error even while you're under your ITPM and OTPM rate limits." Advice: "Start scheduled or bulk jobs at a low rate and spread requests evenly, rather than sending everything at once." — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- Limits are per organization; workspaces can be given lower limits. Higher limits via "Request tier increase" in the Console or sales for Custom. — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- Anthropic's Claude Code sizing table for API organizations recommends 200k–300k TPM per user for 1–5 users, falling to 25k–35k for 50–100 users and 10k–15k for 500+, because "fewer users tend to use Claude Code concurrently in larger organizations". — [Manage costs effectively](https://code.claude.com/docs/en/costs)

**Token prices, USD per million tokens**

| Model | Input | 5m cache write | 1h cache write | Cache read | Output | Batch in / out |
|---|---|---|---|---|---|---|
| Fable 5.2 | 8 | 10 | 16 | 0.20 | 40 | 4 / 20 |
| Opus 5.5 | 4 | 5 | 8 | 0.20 | 20 | 2 / 10 |
| Sonnet 5.5 | 2 | 2.50 | 4 | 0.10 | 10 | 1 / 5 |
| Haiku 5.5, prompt up to 100k tokens | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 | 0.05 / 0.25 |
| Haiku 5.5, prompt over 100k tokens | 0.50 | 0.625 | 1 | 0.05 | 2.50 | 0.25 / 1.25 |

  — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Older models still listed: Opus 5 and Opus 4.5–4.8 at $5/$25; Sonnet 5 at $2/$10; Sonnet 4.6 at $3/$15; Haiku 4.5 at $1/$5; Fable 5.1 and Fable 5 at $10/$50. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Cache multipliers: 5-minute write 1.25x, 1-hour write 2x, read 0.1x on most models, 0.05x on Opus 5.5 and Sonnet 5.5, 0.025x on Fable 5.2 and 5.1. "These multipliers stack with other pricing modifiers, including the Batch API discount and data residency." — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- "The Batch API allows asynchronous processing of large volumes of requests with a 50 percent discount on both input and output tokens." — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Current models have a 1M-token context window "at standard pricing" (Haiku 5.5 is priced by prompt length instead) and 128K max output. US-only inference adds a 1.1x multiplier. Web search costs "$10 USD per 1,000 searches". — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing); [Models overview](https://platform.claude.com/docs/en/models/overview)
- Model guidance: "start with Claude Opus 5.5 for most workloads. Use Claude Fable 5.2 for demanding reasoning and long-horizon agentic work". — [Models overview](https://platform.claude.com/docs/en/models/overview)
- Claude Code enterprise average: "around $13 per developer per active day and $150-250 per developer per month, with costs remaining below $30 per active day for 90% of users." — [Manage costs effectively](https://code.claude.com/docs/en/costs)

### Inferences
- For a 100-agent fleet on the API, the per-minute limits of even the Start tier (for Opus 5.5: 4,000 requests, 2M uncached input tokens, 400k output tokens per minute) are unlikely to be the first constraint if prompt caching works; the monthly spend caps of $500 (Start) and $1,000 (Build) are. Continuous fleet operation effectively requires the Scale tier ($200,000 cap) or Custom.
- Ramp limits mean a fleet should be started gradually; launching 100 agents at once can trigger 429 errors below the nominal limits.
- Because cache reads cost 2.5–5 percent of input price on the newest models and do not count toward input rate limits, fleet economics depend heavily on agents sharing identical prompt prefixes; the workflow runtime's built-in staggering (holding siblings up to 5 seconds so they read the first agent's cache) exists for that reason.
- Bundled API credits ($100–$200 per month, $500 for a team) are far below what a 100-agent fleet consumes; they are a trial budget for API-key-based automation, not a funding model.

### Gaps
- Anthropic publishes no absolute token or message budgets for the five-hour and weekly limits of Pro, Max, Ultra or Team seats; only multiples are stated.
- Conflict to resolve: the pricing page (as extracted) describes Enterprise as $20 per seat with usage billed at API rates, while the Claude Code costs page describes Team and Enterprise as per-seat allowances with five-hour and weekly windows. Enterprise may have both seat types; this was not verified.
- Evaluation-tier limits, fast-mode prices and Priority Tier terms were not extracted.
- The pricing page says Haiku 5.5 is "From $0.10"; whether typical agent prompts stay under the 100,000-token threshold is workload-dependent.

## 4. What Anthropic officially says about using consumer subscriptions for automated, headless or third-party-harness use, and about multiple accounts

### Takeaway
As of November 2026, running `claude -p` or the Agent SDK yourself while signed in with your own plan is permitted and still draws on subscription limits; a May 2026 plan to move that usage to a separate credit was paused on 15 June 2026. What is prohibited is offering claude.ai login or subscription limits in someone else's product, routing third-party traffic against subscription limits, and reselling or sharing access; advertised limits "assume ordinary, individual usage", and businesses are pointed to Commercial Terms, API keys and Team/Enterprise.

### Cited Findings

**Headless and SDK use on a subscription**
- Update of 15 June 2026: "We've paused the previously-announced changes to Claude Agent SDK usage." and "third-party app usage still draw from your subscription limits." — [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- Update of 7 October 2026: "Claude Max, Ultra, and Team plans now include monthly API credits." Current rule: "when you're signed in with your Claude plan, the Claude Agent SDK and `claude -p` still draw from your subscription limits." Using an API key from a linked Console organization draws on the monthly API credits instead. — [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- "Advertised usage limits for Pro, Max, and Ultra plans assume ordinary, individual usage of Claude Code and the Agent SDK." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Ultra, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)

**Third-party products and harnesses**
- "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens". — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- The same page says the rule does not "prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code". Hosting conditions: "The Claude Code binary must not be modified" and "Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice." — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- Help center (quote fragments as extracted): plan usage "is designed to support ordinary use of native Anthropic applications"; "Anthropic may at its discretion allow paid subscribers who have enabled usage credits to use certain third-party tools" and "reserves the right to draw use of such third-party tools from usage credits rather than subscription limits"; prohibited are tools "that misrepresent their identity to Anthropic's servers" or "attempt to route third-party traffic against subscription limits"; API keys are "The preferred way to access Anthropic services using third-party software, tools, or services". — [Log in to your Claude account](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)
- Usage Policy, effective 12 November 2026, prohibits: "Resell, proxy, or otherwise provide access to Claude through unauthorized means, including services that route requests through consumer subscriptions or misrepresent the product or client being used". — [Usage Policy](https://www.anthropic.com/legal/aup)

**Which terms apply**
- "Commercial Terms of Service - for Team, Enterprise, and Claude API users"; "Consumer Terms of Service - for Free, Pro, Max, and Ultra users". The Agent SDK itself "is governed by Anthropic's Commercial Terms of Service". — [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance); [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- Consumer Terms (shown as effective 8 October 2025; quote fragments as extracted): "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else or make your Account available to anyone else"; automated access "through a bot, script, or otherwise" is prohibited "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it"; Section 11: "You agree that you will not use our Services for any commercial or business purposes"; Anthropic "may suspend or terminate your access to the Services at any time without notice" on material breach. — [Consumer Terms of Service](https://www.anthropic.com/legal/consumer-terms)

**Multiple accounts**
- Anthropic documents being signed in to several accounts on one machine: "To stay signed in to multiple accounts at once, such as work and personal accounts, give each account its own configuration directory" via `CLAUDE_CONFIG_DIR`. — [Authentication](https://code.claude.com/docs/en/authentication)
- Usage Policy clauses that mention multiple accounts: "Coordinate malicious activity across multiple accounts, or create multiple accounts, to avoid detection, circumvent product guardrails, or generate identical or similar inputs that otherwise violate our Usage Policy"; "Circumvent a ban through the use of a different account"; "Intentionally bypass or interfere with capabilities, restrictions, or guardrails established within our products"; "Utilize automation in account creation or to engage in spammy behavior". — [Usage Policy](https://www.anthropic.com/legal/aup)
- The Consumer Terms contain no clause that expressly addresses holding several paid accounts. — [Consumer Terms of Service](https://www.anthropic.com/legal/consumer-terms)

**2026 enforcement history (secondary coverage only, from search-result summaries; articles not opened)**
- Trade press reported that from 4 April 2026 subscription limits stopped covering third-party harnesses such as OpenClaw, with that usage moved to extra-usage billing. — [InfoWorld](https://www.infoworld.com/article/4154435/anthropic-cuts-openclaw-access-from-claude-subscriptions-offers-credits-to-ease-transition.html); [TechRadar](https://www.techradar.com/pro/bad-news-claude-users-anthropic-says-youll-need-to-pay-to-use-openclaw-now)
- In May 2026 trade press reported a plan, effective 15 June 2026, to move Agent SDK and `claude -p` usage on subscriptions to a separate monthly credit (reported as $20 Pro, $100 Max 5x, $200 Max 20x). — [The Register, 14 May 2026](https://www.theregister.com/ai-ml/2026/05/14/anthropic-tosses-agents-into-the-api-billing-pool/5240748); [VentureBeat](https://venturebeat.com/ai/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch/)
- The primary source confirms only the outcome: the changes were paused on 15 June 2026. — [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

### Inferences
- A personal dashboard that launches the unmodified `claude` binary with the owner's own login sits inside what the help center currently describes, as long as it is one individual's own work. It is not a third-party product in the sense of the developer rules.
- Three things make that setup fragile as a business foundation: the limits "assume ordinary, individual usage"; Pro, Max and Ultra fall under Consumer Terms whose extracted Section 11 excludes commercial or business use; and Anthropic has already announced, then paused, a move of programmatic usage off subscription limits. The pause note says "For now", per the search summary of the same article, so the status can change again.
- Pooling several paid consumer accounts to multiply limits is not expressly addressed. No clause permits it, the multiple-accounts clause targets evasion and guardrail circumvention, and usage limits could be read as "restrictions ... established within our products". Combined with the ban on sharing an account and on business use under Consumer Terms, running a multi-account farm for a business is at minimum outside the documented intended use and carries termination risk. This is my reading, not an Anthropic statement.
- For a business, the paths Anthropic names are API keys through the Console or a cloud provider (Commercial Terms) and Team or Enterprise seats with usage credits.

### Gaps
- No first-party announcement, blog post or dated policy page for the 4 April 2026 harness restriction or the May 2026 credit plan was found; only the current policy text and the June pause note are primary.
- No official statement was found that explicitly permits or prohibits one person or company running several Pro/Max/Ultra subscriptions in parallel.
- The Consumer Terms were read through an extraction step; the Section 11 business-use sentence sits in a liability context and should be read in full before relying on it. Whether a newer Consumer Terms version than 8 October 2025 exists was not verified.
- The help-center articles show only relative dates ("Updated this week", "over 2 weeks ago"), so exact last-updated dates are unavailable.

## 5. What Anthropic itself publishes about running many agents in parallel

### Takeaway
Anthropic's published experiments use small fleets and simple harnesses: 16 parallel Claudes built a C compiler for just under $20,000, the research system runs 3–5 subagents and reports roughly 15x the tokens of a chat, and a three-agent app-building harness cost 20 times the solo run. No Anthropic source describes a 100-agent fleet; the largest documented single-run scales are the workflow limits (up to 256 concurrent locally, 64 concurrent threads in Managed Agents).

### Cited Findings
- C compiler experiment (Nicholas Carlini, 5 February 2026): 16 parallel Claude Opus 4.6 instances, "nearly 2,000 Claude Code sessions" over two weeks, 2 billion input and 140 million output tokens, just under $20,000, about 100,000 lines of Rust; builds a bootable Linux 6.9 on x86, ARM and RISC-V; 99 percent pass rate on most compiler test suites. — [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)
- Its harness: each agent in a Docker container cloning a shared bare git repo; agents "took a lock" by writing a file to `current_tasks/`; a bash `while true` loop started a fresh session after each one ended; no orchestrator. Lessons: the test verifier must be "nearly perfect"; keep output short to avoid context pollution; give a fast sampled test mode; parallelism failed on one monolithic task (the Linux kernel build) until GCC was used as an oracle to split the problem. Stated limits: "not yet a drop-in replacement for a real compiler". — [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)
- Multi-agent research system (13 June 2025, older, flag as possibly outdated): Opus 4 lead with Sonnet 4 subagents outperformed single-agent Opus 4 by 90.2 percent on an internal research eval; token usage alone explained 80 percent of performance variance and three factors 95 percent; agents use about 4x the tokens of chat and multi-agent systems about 15x; the lead spins up 3–5 subagents in parallel; parallel tool calling cut research time by up to 90 percent for complex queries. — [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Effort scaling from the same post: simple fact-finding 1 agent with 3–10 tool calls; direct comparisons 2–4 subagents with 10–15 calls each; complex research more than 10 subagents. — [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- Harness design for long-running apps (Prithvi Rajasekaran, 24 March 2026): planner, generator and evaluator agents. Retro game maker on Opus 4.5: solo run 20 minutes and $9; full harness 6 hours and $200. After Opus 4.6 the sprint construct was removed; a DAW build took about 4 hours and $124.70. — [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Scaling Managed Agents (8 April 2026): session log, harness and sandbox are decoupled; "The container became cattle"; time-to-first-token fell roughly 60 percent at p50 and over 90 percent at p95; "Scaling to many brains just meant starting many stateless harnesses." — [Scaling Managed Agents](https://www.anthropic.com/engineering/managed-agents)
- Dynamic workflows post by two Claude Code engineers (Thariq Shihipar and Sid Bidasaria, 2 June 2026): sample runs shown are review-changes with 14 agents, 482k tokens, 6m 12s and deep-research with 22 agents, 1.1M tokens, 11m 3s. Six patterns are named, including adversarial verification ("For each spawned agent, run a separate spawned agent to adversarially verify its output"), tournaments with a judging agent, generate-and-filter, fan-out-and-synthesize and loop-until-done. The post gives no cost or success-rate figures. — [A harness for every task: dynamic workflows in Claude Code](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code)
- Long-running Claude for scientific computing (23 March 2026): a single sequential agent on Opus 4.6 built a differentiable Boltzmann solver over a few days, in contrast to the compiler project's parallel team. — [Long-running Claude for scientific computing](https://www.anthropic.com/research/long-running-claude)
- Effective harnesses for long-running agents (26 November 2025, older): an initializer agent sets up `init.sh`, a feature list and a progress log; a coding agent then works one feature per session. — [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Claude Code cost docs: "Agent teams use approximately 7x more tokens than standard sessions when teammates run in plan mode". — [Manage costs effectively](https://code.claude.com/docs/en/costs)

### Inferences
- Derived from the compiler post's own numbers: $20,000 / (16 agents × 14 days) is about $89 per agent-day, and $20,000 / 2,000 sessions is about $10 per session, on Opus 4.6 at $5/$25 per million tokens. Input tokens outnumbered output tokens about 14 to 1 (2 billion versus 140 million), which is why caching dominates fleet cost.
- Scaling that rate naively to 100 agents gives roughly $8,900 per day; with Opus 5.5 at $4/$20 and cheaper cache reads the figure would be lower, but the order of magnitude shows why Anthropic's guidance ties multi-agent use to high-value tasks. This is an extrapolation, not a published figure.
- Anthropic's own harnesses coordinate through files, git and tests rather than agent-to-agent chat, and each successive post removes scaffolding as models improve.

### Gaps
- No Anthropic publication was found that reports running on the order of 100 concurrent agents, or that gives agent counts for day-to-day internal engineering work.
- The "How Anthropic teams use Claude Code" material and the 2026 Agentic Coding Trends Report were not read.
- The dynamic-workflows post was reached through a redirect from claude.com to claude.dev; the extraction mentioned a Bun Zig-to-Rust rewrite and million-line migrations as examples, which I could not verify verbatim.
- The research-system numbers date from June 2025 and Claude 4 models; no updated measurement was found.

## 6. Anthropic's guidance on when multi-agent is worth it

### Takeaway
Anthropic's consistent position is to start with one agent and add agents only for a demonstrated constraint: context that would otherwise be flooded, truly independent parallel work, or tool and instruction overload. It quantifies the price at 3–10x the tokens of a single agent (15x versus chat in the research system) and warns against splitting work by role and against parallelising tightly coupled or same-file work.

### Cited Findings
- "Start with the simplest approach that works, and add complexity only when evidence supports it." Multi-agent implementations typically use "3-10x more tokens than single-agent approaches" for equivalent tasks. — [When to use multi-agent systems (and when not to)](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them) (23 January 2026)
- Three justified cases from that post: context protection (a subtask generating more than about 1,000 tokens that are mostly irrelevant to the main task), parallelization (benefit is thoroughness, and such systems often take longer overall), specialization (signals include 20 or more tools). Tool Search is suggested first and can cut token usage by up to 85 percent. — [When to use multi-agent systems (and when not to)](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- Anti-patterns from that post: splitting by role (planner, implementer, tester, reviewer), where in one experiment subagents spent more tokens on coordination than on work; the "telephone game" of degrading handoffs; splitting sequential or tightly coupled work; verifiers that declare success after one or two tests. Recommended instead: divide along context boundaries and use a verification subagent that receives the artifact and success criteria only. — [When to use multi-agent systems (and when not to)](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- Multi-agent systems need tasks where "the value of the task is high enough to pay for the increased performance"; they fit poorly where agents must share context or have many dependencies, and "most coding tasks" have fewer parallelizable subtasks than research. — [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (13 June 2025)
- "Agent teams add coordination overhead and use significantly more tokens than a single session. They work best when teammates can operate independently. For sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective." Also: "Three focused teammates often outperform five scattered ones." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Sizing advice: "Start with 3-5 teammates for most workflows"; "Having 5-6 tasks per teammate keeps everyone productive"; "If you have 15 independent tasks, 3 teammates is a good starting point." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- When a workflow is the right tool: "when a task needs more agents than one conversation can coordinate, or when you want the orchestration codified as a script you can read and rerun", for example "a codebase-wide bug sweep, a 500-file migration". Cost advice: "run the workflow on a small slice first". — [Dynamic workflows](https://code.claude.com/docs/en/workflows)
- Workflows are "suited for complex, high value tasks"; "most traditional coding tasks do not need a panel of 5 reviewers"; parallelism and specialization "have to earn their coordination cost". — [A harness for every task: dynamic workflows in Claude Code](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code) (2 June 2026)
- "find the simplest solution possible, and only increase complexity when needed"; an evaluator is worth its cost when "the task sits beyond what the current model does reliably solo". — [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) (24 March 2026)
- Debugging a deeply coupled pipeline "may be better suited to a single agent working sequentially, spawning subagents as needed". — [Long-running Claude for scientific computing](https://www.anthropic.com/research/long-running-claude) (23 March 2026)
- It is "still unclear whether a single, general-purpose coding agent performs best across contexts". — [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (26 November 2025)
- Docs-level reminders: "Running several sessions or subagents at once multiplies token usage." and, for same-file risk, "Agent teams don't isolate teammates in worktrees, so partition the work so each teammate owns a different set of files." — [Run agents in parallel](https://code.claude.com/docs/en/agents)

### Inferences
- Anthropic's guidance treats fleet size as a consequence of how many independent, verifiable units of work exist, not as a goal. A standing fleet of 100 agents is justified only if there are 100 independent streams of work with their own verification, such as one agent per client, repository or ticket.
- The guidance favours many independent single-agent sessions (agent view, cloud sessions, one SDK session per job) over one large coordinated team, and reserves coordinated multi-agent structures for fan-out with verification.
- Every source pairs parallelism with a strong automated verifier (tests, an oracle, adversarial reviewers); without one, more agents mostly multiply cost.

### Gaps
- Anthropic gives no quantitative break-even rule, such as a task value or size threshold above which multi-agent pays off; the guidance is qualitative apart from the token multipliers.
- No published guidance addresses operating a business-scale fleet of unattended agents (staffing, review capacity, failure rates per agent).
