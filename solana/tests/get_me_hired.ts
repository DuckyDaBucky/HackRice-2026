import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("get_me_hired", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GetMeHired as Program;
  const verifier = Keypair.generate();
  const orgAuthority = provider.wallet as anchor.Wallet;
  const unauthorized = Keypair.generate();

  const [platformConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    program.programId,
  );
  const [organization] = PublicKey.findProgramAddressSync(
    [Buffer.from("org"), orgAuthority.publicKey.toBuffer()],
    program.programId,
  );

  before(async () => {
    await program.methods
      .initializePlatform(verifier.publicKey)
      .accounts({
        platformConfig,
        authority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .registerOrganization(Array.from({ length: 32 }, (_, i) => i))
      .accounts({
        platformConfig,
        organization,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("issues an invitation with a valid revision", async () => {
    const revision = 1;
    const [invitation] = PublicKey.findProgramAddressSync(
      [Buffer.from("inv"), organization.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
    await program.methods
      .issueInvitation(Array.from({ length: 32 }, () => 7), expiresAt, revision)
      .accounts({
        organization,
        invitation,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    const account = await provider.connection.getAccountInfo(invitation);
    expect(account).to.not.be.null;
  });

  it("rejects stale revision zero", async () => {
    const revision = 0;
    const [invitation] = PublicKey.findProgramAddressSync(
      [Buffer.from("inv"), organization.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
    try {
      await program.methods
        .issueInvitation(Array.from({ length: 32 }, () => 1), expiresAt, revision)
        .accounts({
          organization,
          invitation,
          orgAuthority: orgAuthority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("expected stale revision error");
    } catch (error) {
      expect(String(error)).to.match(/StaleRevision|6001|0x1771/i);
    }
  });

  it("rejects unauthorized identity attestation signer", async () => {
    const revision = 2;
    const [invitation] = PublicKey.findProgramAddressSync(
      [Buffer.from("inv"), organization.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
    await program.methods
      .issueInvitation(Array.from({ length: 32 }, () => 2), expiresAt, revision)
      .accounts({
        organization,
        invitation,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .attestIdentity()
        .accounts({
          platformConfig,
          invitation,
          verifier: unauthorized.publicKey,
        })
        .signers([unauthorized])
        .rpc();
      expect.fail("expected unauthorized verifier error");
    } catch (error) {
      expect(String(error)).to.match(/ConstraintRaw|2006|verifier/i);
    }
  });

  it("rejects invalid transition before identity verification", async () => {
    const revision = 3;
    const [invitation] = PublicKey.findProgramAddressSync(
      [Buffer.from("inv"), organization.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
    await program.methods
      .issueInvitation(Array.from({ length: 32 }, () => 3), expiresAt, revision)
      .accounts({
        organization,
        invitation,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      await program.methods
        .activateAccess()
        .accounts({
          invitation,
          organization,
          orgAuthority: orgAuthority.publicKey,
        })
        .rpc();
      expect.fail("expected invalid transition error");
    } catch (error) {
      expect(String(error)).to.match(/InvalidTransition|6000|0x1770/i);
    }
  });

  it("updates and revokes report release mask", async () => {
    const revision = 4;
    const [invitation] = PublicKey.findProgramAddressSync(
      [Buffer.from("inv"), organization.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const [reportRelease] = PublicKey.findProgramAddressSync(
      [Buffer.from("release"), invitation.toBuffer(), Buffer.from(new Uint32Array([revision]).buffer)],
      program.programId,
    );
    const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);

    await program.methods
      .issueInvitation(Array.from({ length: 32 }, () => 4), expiresAt, revision)
      .accounts({
        organization,
        invitation,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .registerReportRevision(Array.from({ length: 32 }, () => 9), revision)
      .accounts({
        invitation,
        reportRelease,
        orgAuthority: orgAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .updateReportPermissions(0b00011111)
      .accounts({
        reportRelease,
        orgAuthority: orgAuthority.publicKey,
      })
      .rpc();

    await program.methods
      .revokeReportPermissions()
      .accounts({
        reportRelease,
        orgAuthority: orgAuthority.publicKey,
      })
      .rpc();
  });
});
