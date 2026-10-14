import assert from "node:assert/strict";
import test from "node:test";
import { getSupportLinkToken, redeemSupportLink } from "@/lib/support-link";

const token = "a".repeat(64);

test("owner-shared links parse fragments or pasted tokens, never query-string bearer tokens", () => {
  assert.equal(getSupportLinkToken(`https://lotto.example/support#token=${token}`), token);
  assert.equal(getSupportLinkToken(` https://lotto.example/support#support-token=${token} `), token);
  assert.equal(getSupportLinkToken(` ${token} `), token);
  assert.equal(getSupportLinkToken(`https://lotto.example/support?token=${token}`), null);
  assert.equal(getSupportLinkToken("https://lotto.example/support#token=invalid"), null);
  assert.equal(getSupportLinkToken("not-a-link"), null);
});

test("launcher consumes the link using authenticated POST, no referrer, and no token in the HTTP URL", async () => {
  let count = 0;
  const fetcher: typeof fetch = async (url, options) => {
    count++;
    assert.equal(url, "/api/platform/impersonate");
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.referrerPolicy, "no-referrer");
    assert.equal(options?.body, JSON.stringify({ token }));
    return Response.json({ success: true });
  };
  await redeemSupportLink(`https://lotto.example/support#token=${token}`, fetcher);
  assert.equal(count, 1);
});

test("malformed links cannot trigger redemption requests", async () => {
  const fetcher: typeof fetch = async () => { throw new Error("Fetch must not run"); };
  await assert.rejects(redeemSupportLink("invalid", fetcher), /complete owner-shared link/);
});

test("wrong requester, expired, or used-link server errors propagate without retries", async () => {
  let count = 0;
  const fetcher: typeof fetch = async () => {
    count++;
    return Response.json({ error: "Not authorized for this admin." }, { status: 403 });
  };
  await assert.rejects(redeemSupportLink(token, fetcher), /Not authorized for this admin/);
  assert.equal(count, 1);
});
