/**
 * Attempts to fund SOLANA_SERVICE_KEYPAIR on devnet and prints manual fallback.
 */
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

function parseKeypairJson(envVar: string | undefined) {
  if (!envVar) return null;
  try {
    return Uint8Array.from(JSON.parse(envVar) as number[]);
  } catch {
    return null;
  }
}

async function main() {
  const bytes = parseKeypairJson(process.env.SOLANA_SERVICE_KEYPAIR);
  if (!bytes) throw new Error("SOLANA_SERVICE_KEYPAIR missing");
  const keypair = Keypair.fromSecretKey(bytes);
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const before = await connection.getBalance(keypair.publicKey);

  if (before >= 0.01 * LAMPORTS_PER_SOL) {
    console.log(JSON.stringify({ funded: true, pubkey: keypair.publicKey.toBase58(), sol: before / LAMPORTS_PER_SOL }));
    return;
  }

  for (const lamports of [500_000_000, 200_000_000, 100_000_000]) {
    try {
      const sig = await connection.requestAirdrop(keypair.publicKey, lamports);
      await connection.confirmTransaction(sig, "confirmed");
      const after = await connection.getBalance(keypair.publicKey);
      console.log(JSON.stringify({ funded: true, pubkey: keypair.publicKey.toBase58(), sol: after / LAMPORTS_PER_SOL, signature: sig }));
      return;
    } catch {
      // rate limit — try smaller amount or manual faucet
    }
  }

  console.log(JSON.stringify({
    funded: false,
    pubkey: keypair.publicKey.toBase58(),
    sol: before / LAMPORTS_PER_SOL,
    manual: "Visit https://faucet.solana.com and airdrop devnet SOL to the pubkey above, then re-run verify-solana-outbox.ts",
  }, null, 2));
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
