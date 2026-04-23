---
name: slp-reflection
description: After using a skill subscribed via Skill Loops Protocol, invoke this skill to produce a structured ExperienceBundle. High-quality contributions earn the contributor shares in the target skill.
version: 1.0.0
---

# SLP Reflection Skill v1.0.0

## Purpose

After using a skill subscribed via Skill Loops Protocol (SLP), use this
skill to produce a structured ExperienceBundle JSON. High-quality
contributions earn the contributor shares in the target skill.

## When to use

- The target skill's task failed or produced a clearly inferior result.
- You notice an obvious gap in the target skill's coverage.
- The user explicitly asks for feedback on the skill.

## When NOT to use

- The task completed smoothly. Do **not** submit "no issues."
- You don't have a concrete patch or test case in mind.

## The six-step protocol

### 1. Gather context
From conversation history, extract:
- target skill id (on-chain pubkey or `skill_...` mock id) and version
- the original task
- the full action / observation trajectory
- the final outcome

### 2. Root-cause analysis
Don't describe *what* failed — describe *why the skill allowed it to fail*.
Is there a missing branch? A wrong default? An outdated environmental
assumption?

### 3. Propose a patch
Produce a concrete modification. Specify:
- patch type — `new_step` | `prompt_addition` | `example_addition` | ...
- target section of the SKILL.md
- exact text to insert or change (unified-diff style)

### 4. Design a test case
- minimal reproducing input
- expected output from the fixed skill (a must-contain assertion is ideal)

### 5. Self-check
Answer honestly. If any answer is **no**, recommend *skipping* submission:
- Is this a novel blind spot, not a duplicate of an earlier contribution?
- Is the patch merge-ready, or just a vague direction?
- Is the test case reproducible?
- Is this worth a wallet signature?

### 6. Output and deliver
Output the ExperienceBundle JSON below, then tell the user:

> Go to https://skillloops.xyz/submit
> Connect your Phantom wallet
> Paste the JSON to finalize
> Approximate time: 30 seconds. Storage is free under 100 KB.

## ExperienceBundle schema

```json
{
  "version": "1.0",
  "skill_id": "<pubkey>",
  "skill_version": 1,
  "trace_id": "<uuid>",
  "submitted_at": 1714000000,
  "context": { "task_description": "...", "input_summary": "..." },
  "trajectory": [
    { "step": 1, "action": "...", "observation": "...", "result": "ok | missed | ..." }
  ],
  "outcome": "partial | failure | edge-case",
  "failure_mode": "...",
  "root_cause_analysis": "...",
  "lesson_learned": "...",
  "proposed_patch": {
    "type": "new_step | prompt_addition | example_addition | ...",
    "target_section": "...",
    "diff": "+ inserted text"
  },
  "test_case": {
    "input_pr_diff": "...",
    "expected_review_must_contain": "..."
  },
  "generated_by_reflection_skill_version": "1.0.0"
}
```

## Scoring hints

The AI Judge scores five dimensions (0–10 each):

- **Novelty** — is this a fresh blind spot?
- **Specificity** — is the failure point traceable?
- **Actionability** — is the patch merge-ready?
- **Reproducibility** — can someone else reproduce the failure?
- **Impact** — does this affect a meaningful fraction of the skill's users?

Aim for ≥7 on each. If you can't, the experience probably isn't ready.
