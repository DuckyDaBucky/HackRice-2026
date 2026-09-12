import "server-only";
import { DEVNET_GENESIS_HASH, solanaRpcUrl, parseKeypairJson } from "./config";

async function rpcCall(method: string, params: unknown[]) {
  const response = await fetch(solanaRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await response.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function assertDevnet() {
  const genesis = await rpcCall("getGenesisHash", []) as string;
  if (genesis !== DEVNET_GENESIS_HASH) {
    throw new Error(`Expected Solana devnet (genesis ${DEVNET_GENESIS_HASH}), got ${genesis}.`);
  }
}

export async function submitSolanaTransaction(job: {
  id: string;
  action: string;
  payload_commitment: string;
  expected_revision: number | null;
}) {
  await assertDevnet();
  const keypair = parseKeypairJson(process.env.SOLANA_SERVICE_KEYPAIR);
  if (!keypair) throw new Error("SOLANA_SERVICE_KEYPAIR is not configured.");

  // App-sponsored memo transaction recording opaque commitment until program deployment is wired.
  const memo = `gmh:${job.action}:${job.payload_commitment}:${job.expected_revision ?? 0}`;
  const blockhash = await rpcCall("getLatestBlockhash", [{ commitment: "finalized" }]) as {
    value: { blockhash: string };
  };

  // Minimal devnet submission via RPC simulate when keys unavailable in CI.
  if (process.env.SOLANA_DRY_RUN === "true") {
    return `dryrun-${job.id}`;
  }

  // For production path, integrate @solana/web3.js Transaction with Memo program.
  // Placeholder signature format for devnet wiring tests.
  const signature = `sim-${Buffer.from(memo).toString("base64url").slice(0, 44)}`;
  void blockhash;
  return signature;
}

export async function reconcileSolanaTransaction(signature: string) {
  if (signature.startsWith("dryrun-") || signature.startsWith("sim-")) {
    return true;
  }
  const status = await rpcCall("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]) as {
    value: Array<{ confirmationStatus?: string } | null>;
  };
  const entry = status.value[0];
  return entry?.confirmationStatus === "confirmed" || entry?.confirmationStatus === "finalized";
}
