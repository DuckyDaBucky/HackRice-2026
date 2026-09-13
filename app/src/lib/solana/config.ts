import "server-only";

/** Solana devnet genesis hash — enforced to prevent accidental mainnet use. */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export function solanaRpcUrl() {
  return process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
}

export function solanaProgramId() {
  const id = process.env.SOLANA_PROGRAM_ID;
  if (!id) throw new Error("SOLANA_PROGRAM_ID is not configured.");
  return id;
}

export function parseKeypairJson(envVar: string | undefined): Uint8Array | null {
  if (!envVar) return null;
  try {
    const parsed = JSON.parse(envVar) as number[];
    return Uint8Array.from(parsed);
  } catch {
    return null;
  }
}

export function solanaConfigured() {
  return Boolean(process.env.SOLANA_RPC_URL && process.env.SOLANA_PROGRAM_ID && process.env.SOLANA_SERVICE_KEYPAIR);
}
