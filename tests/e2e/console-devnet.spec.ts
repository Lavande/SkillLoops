import { test, expect } from "@playwright/test";

test.skip(process.env.SLP_DEVNET_E2E !== "1", "Devnet E2E disabled (set SLP_DEVNET_E2E=1)");

test("console steps through all six PRD acts on devnet", async ({ page }) => {
  await page.goto("/console");
  await page.getByText(/step-through/i).waitFor({ timeout: 5000 });

  const steps = [
    "reset_then_seed",
    "subscribe_bob",
    "submit_bob_experience",
    "evaluate",
    "subscribe_carol",
    "wait_then_settle",
    "claim_alice",
    "claim_bob",
    "publish_v1_1",
  ];

  for (const _ of steps) {
    // Each step is the next "Run step →" button click; narration steps show "Next →".
    await page.getByRole("button", { name: /run step|next/i }).first().click();
    // Settle to confirmed + indexer tick. Settle wait can take ~60s for the
    // first period to expire on Alice's 60s-period skill.
    await page.waitForTimeout(15_000);
  }

  // Verify indexer parity with chain.
  const res = await page.request.get("/api/indexer/status?verify=1");
  const json = await res.json();
  expect(json.data.ok).toBe(true);
});
