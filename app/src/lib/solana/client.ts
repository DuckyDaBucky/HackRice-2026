import "server-only";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { DEVNET_GENESIS_HASH, solanaRpcUrl, parseKeypairJson } from "./config";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function loadServiceKeypair(): Keypair {
  const bytes = parseKeypairJson(process.env.SOLANA_SERVICE_KEYPAIR);
  if (!bytes) throw new Error("SOLANA_SERVICE_KEYPAIR is not configured.");
  return Keypair.fromSecretKey(bytes);
}

export async function assertDevnet() {
  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const genesis = await connection.getGenesisHash();
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

  if (process.env.SOLANA_DRY_RUN === "true") {
    return `dryrun-${job.id}`;
  }

  const keypair = loadServiceKeypair();
  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const memo = `gmh:${job.action}:${job.payload_commitment}:${job.expected_revision ?? 0}`;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
  const ix = new TransactionInstruction({
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
  const tx = new Transaction({ feePayer: keypair.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  tx.sign(keypair);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

export async function reconcileSolanaTransaction(signature: string) {
  if (signature.startsWith("dryrun-")) {
    return true;
  }

  const connection = new Connection(solanaRpcUrl(), "confirmed");
  const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const entry = status.value[0];
  return entry?.confirmationStatus === "confirmed" || entry?.confirmationStatus === "finalized";
}
