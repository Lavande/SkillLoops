# SkillLoops Hackathon Video Script

Target length: 2:30 to 3:00  
Language: simple English  
Recording style: real product flow, not the demo console

## Core Message

SkillLoops is a Solana protocol where a buyer of an AI skill can become an owner by contributing useful real-world experience.

When an agent fails, the failure trace becomes a structured contribution. An AI judge scores it. The protocol records the result on-chain, updates ownership, and shares future revenue.

## Production Notes

- Record the real website and Claude Code.
- Use the `/pitch` transition cards between major sections.
- Keep the voiceover calm and simple.
- Avoid deep implementation words unless the screen already shows them.
- When Phantom appears, let it be visible for a moment. It proves the action is signed.
- When a transaction is confirmed, pause briefly on the tx status.
- Use 1080p, 30fps, browser zoom around 110% to 125%.

## Short Version Structure

### 0:00-0:10 — Transition Card: Title

Screen: `/pitch`, scene 1.

Voiceover:

> This is SkillLoops.
> It is a marketplace for AI agent skills where useful contributions can earn ownership.

### 0:10-0:28 — Transition Card: Problem

Screen: `/pitch`, scene 2.

Voiceover:

> Today, AI skills are sold like static files.
> But real tools change. APIs move. Models change. Edge cases appear.
> The best signal is the moment an agent fails, but that signal usually disappears.

### 0:28-0:38 — Transition Card: Bridge to Demo

Screen: `/pitch`, scene 3 (the loop card).

Voiceover:

> SkillLoops fixes this with one simple loop.
> The buyer uses a skill, captures a real failure, and earns ownership when the contribution is judged useful.
> Let's walk through it.

### 0:38-0:58 — Website: Publish Skill

Screen: `/publish`.

Action:

1. Show the metadata fields.
2. Show the `SKILL.md` editor.
3. Show subscription price and author floor.
4. Click `Sign & publish`.
5. Let the Lit / Irys / Phantom flow appear.
6. Pause on confirmed transaction or the skill detail page.

Voiceover:

> First, Alice publishes an AI skill.
> The skill content is encrypted, stored permanently, and the public market only shows metadata.
> Alice also chooses the subscription price and her minimum author ownership.
> This publish action is signed and sent to Solana devnet.

### 0:48-1:05 — Website: Skill Page and Subscribe

Screen: `/skill/[id]`.

Action:

1. Show skill name, subscription price, holders, revenue, and cap table.
2. Click `Subscribe`.
3. Let Phantom signing appear.
4. Pause on confirmed transaction.
5. If available, click `Decrypt · preview`.

Voiceover:

> Now Bob subscribes.
> Every subscriber gets a share account, but they start at zero percent ownership.
> Paying for access is not enough.
> To earn ownership, Bob needs to contribute something useful.

### 1:05-1:15 — Transition Card: Reflection

Screen: `/pitch`, scene 3.

Voiceover:

> This is where the loop starts.
> Bob's agent uses the skill, hits a real blind spot, and then runs the Reflection Skill.

### 1:15-1:48 — Claude Code: Use Reflection Skill

Screen: Claude Code terminal/editor.

Action:

1. Show the target skill being used or summarized.
2. Show the failure case, for example a Rust PR with an `unsafe` block that the review skill missed.
3. Ask Claude Code to use the Reflection Skill.
4. Show the generated `ExperienceBundle` JSON.
5. Highlight these fields if possible: `failure_mode`, `root_cause_analysis`, `proposed_patch`, `test_case`.

Suggested on-screen prompt:

```text
Use the SLP Reflection Skill for this failed run.
Target skill: GitHub PR Review, version 1.
The review missed the risk in a Rust unsafe block.
Produce a valid ExperienceBundle with a concrete patch and test case.
```

Voiceover:

> The Reflection Skill turns the failed run into structured data.
> It does not just say "the review was bad."
> It explains why the skill failed, proposes a patch, and adds a test case.
> The output is an ExperienceBundle that the protocol can verify and score.

### 1:48-2:10 — Website: Submit Experience

Screen: `/submit`.

Action:

1. Paste the ExperienceBundle JSON.
2. Show validation passing.
3. Show target skill matching.
4. Confirm the selected skill.
5. Click `Sign & submit`.
6. Let Irys upload and Phantom signing appear.
7. Pause on confirmed transaction or `/me?tab=contributions`.

Voiceover:

> Bob pastes the bundle into SkillLoops.
> The app validates the JSON, matches it to the right skill, uploads it, and submits a signed transaction.
> Now the contribution is no longer just a chat message.
> It is a permanent, auditable record.

### 2:10-2:30 — Website: Judge Result and Ownership

Screen: skill detail page and/or `/me` contributions tab.

Action:

1. Show contribution timeline.
2. Open the evaluated contribution row if it is available.
3. Show score such as `38 / 50`.
4. Show ownership delta or updated cap table.

Voiceover:

> The AI judge scores the contribution.
> A high-quality report can increase Bob's ownership in the skill.
> Future subscribers pay into the revenue pool, and that revenue can be shared by the author and contributors.

### 2:30-2:48 — Website: Revenue / Claim / Version History

Screen: skill detail page and/or `/me` claimable tab.

Action:

1. Show revenue pool.
2. Show holders or cap table.
3. Show versions panel.
4. If you have a v1.1 flow ready, show the new version with contributor IDs.

Voiceover:

> Alice still keeps her protected author floor.
> Bob does not take ownership by force; he earns it through judged contribution.
> When Alice publishes the next version, Bob's contribution is part of the skill history.

### 2:48-3:00 — Transition Card: Closing

Screen: `/pitch`, scene 5.

Voiceover:

> SkillLoops closes the loop:
> use, reflect, submit, judge, own, and improve.
> It turns AI skill failures into a market signal, an improvement path, and an economic stake.

### 3:00-3:20 — Transition Card: Roadmap

Screen: `/pitch`, scene 6 (roadmap).

Voiceover:

> This is just the first version of the protocol.
> Next, the single judge becomes a Judge DAO, where members stake to score and get slashed for bad calls — that is how we keep scoring objective.
> On top of it, we add an arbitration path so any contributor can appeal a disputed score.
> Then we open a secondary market, so the skill shares users earn can be traded.
> And the long-term vision is A2A: an agent-to-agent network where agents discover failures and evolve skills on their own.

## If You Need a 90-Second Version

Use this compressed script:

> This is SkillLoops, a Solana marketplace for AI agent skills.
> Today, skills are sold like static files. But skills decay when APIs change, models change, and new edge cases appear.
>
> Alice publishes a skill. The content is encrypted, stored permanently, and the subscription terms are recorded on-chain.
>
> Bob subscribes. He can use the skill, but he starts with zero percent ownership.
>
> Then Bob's agent finds a real blind spot. In this demo, a PR review skill misses a Rust unsafe block.
>
> Bob runs the Reflection Skill in Claude Code. It turns the failed run into an ExperienceBundle: root cause, patch, and test case.
>
> Bob submits that bundle to SkillLoops. The app validates it, uploads it, and sends a signed transaction.
>
> The AI judge scores the contribution. If it is useful, Bob earns ownership in the skill.
>
> Future subscribers pay into the revenue pool, and revenue can be shared by the author and contributors.
>
> SkillLoops turns AI skill failures into improvements, provenance, and ownership.

## Recording Checklist

- Start dev server: `pnpm dev`.
- Make sure Phantom is on devnet.
- Make sure the demo wallet has devnet SOL.
- Open `/pitch` in a browser tab.
- Open the app in another tab.
- Open Claude Code in a clean, readable terminal.
- Use a large terminal font.
- Disable desktop notifications.
- Record each section separately.
- Keep one clean take of each signed action.
- Export at 1080p MP4.

## Suggested Transition Card Order

0. Cold open: `Skill Loops Protocol` (animated logo)
1. Title: `SkillLoops Protocol`
2. Problem: `Skills decay after sale`
3. Loop: `Use -> Reflect -> Submit -> Judge -> Own`
4. Proof: `Signed actions, permanent records, shared revenue`
5. Closing: `Failures become ownership`
6. Roadmap: `What ships next`
