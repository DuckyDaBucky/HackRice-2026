import "server-only";

export function hiringEnabled() {
  return process.env.HIRING_ENABLED === "true";
}

export function personaConfigured() {
  return Boolean(
    process.env.PERSONA_API_KEY &&
    process.env.PERSONA_TEMPLATE_ID &&
    process.env.PERSONA_WEBHOOK_SECRET,
  );
}

export function personaEnvironment() {
  return process.env.PERSONA_ENV === "production" ? "production" : "sandbox";
}

export function solanaConfigured() {
  return Boolean(
    process.env.SOLANA_RPC_URL &&
    process.env.SOLANA_PROGRAM_ID &&
    process.env.SOLANA_SERVICE_KEYPAIR,
  );
}

export function requireHiringEnabled() {
  if (!hiringEnabled()) {
    throw new Error("Hiring flow is disabled. Set HIRING_ENABLED=true after migrations and provider setup.");
  }
}
