import { test, expect, request } from "@playwright/test";

/**
 * End-to-end smoke: drives the full PRD demo flow via the console-step API,
 * then reads the skill state via the public API. Pure API — does not require
 * Phantom to be installed, so it runs in CI / headless browser.
 */

test("console step-through produces the PRD target state (Alice 1000, Bob 380, Carol 0, v1.1)", async ({ baseURL }) => {
  const r = await request.newContext({ baseURL });

  async function step(step: string) {
    const res = await r.post("/api/console/step", { data: { step } });
    expect(res.ok(), `${step} → ${res.status()}`).toBeTruthy();
    return (await res.json()).data;
  }

  await step("reset");
  const seed = await step("seed");
  const skillId = seed.aliceSkillId as string;
  expect(skillId).toBeTruthy();

  await step("subscribe_bob");
  await step("submit_bob_experience");
  await step("evaluate");
  await step("subscribe_carol");
  await step("force_settle_ready");
  const settle = await step("settle");
  await step("claim_alice");
  await step("claim_bob");
  const v1_1 = await step("publish_v1_1");
  expect(v1_1.version).toBe(2);

  const detail = await (await r.get(`/api/skills/${skillId}`)).json();
  const d = detail.data;
  expect(d.skill.currentVersion).toBe(2);
  expect(d.ledger.totalShares).toBe(1380);
  expect(d.ledger.authorShares).toBe(1000);
  expect(d.ledger.contributorCount).toBe(1);
  const byHolder = Object.fromEntries(d.holders.map((h: any) => [h.holder, h.shares]));
  expect(byHolder["AliceAuthorDemoDAP1111111111111111111111"]).toBe(1000);
  expect(byHolder["BobAgentOperatorDemoDAP111111111111111111"]).toBe(380);
  expect(byHolder["CarolAgentOperatorDemoDAP1111111111111111"]).toBe(0);
  expect(d.experiences[0].contributionScore).toBe(38);
  expect(d.experiences[0].sharesMinted).toBe(380);

  // carol claimed nothing because her share is 0
  const carolClaim = settle.claims.find((c: any) => c.holder === "CarolAgentOperatorDemoDAP1111111111111111");
  expect(carolClaim.amount).toBe(0);

  // pages render 200
  for (const path of ["/", "/market", "/publish", "/submit", "/me", "/reflection-skill", "/console", `/skill/${skillId}`]) {
    const res = await r.get(path);
    expect(res.status(), path).toBe(200);
  }
});
