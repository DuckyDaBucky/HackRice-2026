use anchor_lang::prelude::*;

declare_id!("eZqUe8be2q8R6akfzAx9BZuQ4DnXezGbfTRPJZPpxk2");

#[program]
pub mod get_me_hired {
    use super::*;

    pub fn initialize_platform(ctx: Context<InitializePlatform>, verifier: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;
        config.authority = ctx.accounts.authority.key();
        config.verifier = verifier;
        config.bump = ctx.bumps.platform_config;
        Ok(())
    }

    pub fn register_organization(ctx: Context<RegisterOrganization>, org_commitment: [u8; 32]) -> Result<()> {
        let org = &mut ctx.accounts.organization;
        org.authority = ctx.accounts.org_authority.key();
        org.commitment = org_commitment;
        org.bump = ctx.bumps.organization;
        Ok(())
    }

    pub fn issue_invitation(
        ctx: Context<IssueInvitation>,
        pack_commitment: [u8; 32],
        expires_at: i64,
        revision: u32,
    ) -> Result<()> {
        require!(revision > 0, HiringError::StaleRevision);
        let inv = &mut ctx.accounts.invitation;
        inv.organization = ctx.accounts.organization.key();
        inv.pack_commitment = pack_commitment;
        inv.revision = revision;
        inv.expires_at = expires_at;
        inv.state = InvitationState::Issued as u8;
        inv.bump = ctx.bumps.invitation;
        Ok(())
    }

    pub fn attest_identity(ctx: Context<AttestIdentity>) -> Result<()> {
        require_keys_eq!(ctx.accounts.verifier.key(), ctx.accounts.platform_config.verifier);
        let inv = &mut ctx.accounts.invitation;
        require!(inv.state == InvitationState::Issued as u8, HiringError::InvalidTransition);
        inv.state = InvitationState::IdentityVerified as u8;
        Ok(())
    }

    pub fn activate_access(ctx: Context<ActivateAccess>) -> Result<()> {
        let inv = &mut ctx.accounts.invitation;
        require!(inv.state == InvitationState::IdentityVerified as u8, HiringError::InvalidTransition);
        inv.state = InvitationState::Active as u8;
        Ok(())
    }

    pub fn record_completion(ctx: Context<RecordCompletion>) -> Result<()> {
        let inv = &mut ctx.accounts.invitation;
        require!(inv.state == InvitationState::Active as u8, HiringError::InvalidTransition);
        inv.state = InvitationState::Completed as u8;
        Ok(())
    }

    pub fn revoke_invitation(ctx: Context<RevokeInvitation>) -> Result<()> {
        let inv = &mut ctx.accounts.invitation;
        inv.state = InvitationState::Revoked as u8;
        Ok(())
    }

    pub fn register_report_revision(
        ctx: Context<RegisterReportRevision>,
        revision_commitment: [u8; 32],
        revision: u32,
    ) -> Result<()> {
        let release = &mut ctx.accounts.report_release;
        release.invitation = ctx.accounts.invitation.key();
        release.revision = revision;
        release.revision_commitment = revision_commitment;
        release.release_mask = 0;
        release.bump = ctx.bumps.report_release;
        Ok(())
    }

    pub fn update_report_permissions(ctx: Context<UpdateReportPermissions>, release_mask: u8) -> Result<()> {
        ctx.accounts.report_release.release_mask = release_mask;
        Ok(())
    }

    pub fn revoke_report_permissions(ctx: Context<RevokeReportPermissions>) -> Result<()> {
        ctx.accounts.report_release.release_mask = 0;
        Ok(())
    }
}

#[repr(u8)]
pub enum InvitationState {
    Issued = 1,
    IdentityVerified = 2,
    Active = 3,
    Completed = 4,
    Revoked = 5,
    Expired = 6,
}

#[account]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub verifier: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Organization {
    pub authority: Pubkey,
    pub commitment: [u8; 32],
    pub bump: u8,
}

#[account]
pub struct Invitation {
    pub organization: Pubkey,
    pub pack_commitment: [u8; 32],
    pub revision: u32,
    pub expires_at: i64,
    pub state: u8,
    pub bump: u8,
}

#[account]
pub struct ReportRelease {
    pub invitation: Pubkey,
    pub revision: u32,
    pub revision_commitment: [u8; 32],
    pub release_mask: u8,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 32 + 1, seeds = [b"platform"], bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterOrganization<'info> {
    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(init, payer = org_authority, space = 8 + 32 + 32 + 1, seeds = [b"org", org_authority.key().as_ref()], bump)]
    pub organization: Account<'info, Organization>,
    #[account(mut)]
    pub org_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(revision: u32)]
pub struct IssueInvitation<'info> {
    pub organization: Account<'info, Organization>,
    #[account(init, payer = org_authority, space = 8 + 32 + 32 + 4 + 8 + 1 + 1, seeds = [b"inv", organization.key().as_ref(), &revision.to_le_bytes()], bump)]
    pub invitation: Account<'info, Invitation>,
    #[account(mut, constraint = organization.authority == org_authority.key())]
    pub org_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AttestIdentity<'info> {
    #[account(seeds = [b"platform"], bump = platform_config.bump)]
    pub platform_config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub invitation: Account<'info, Invitation>,
    pub verifier: Signer<'info>,
}

#[derive(Accounts)]
pub struct ActivateAccess<'info> {
    #[account(mut, has_one = organization)]
    pub invitation: Account<'info, Invitation>,
    pub organization: Account<'info, Organization>,
    pub org_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordCompletion<'info> {
    #[account(mut)]
    pub invitation: Account<'info, Invitation>,
    pub org_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeInvitation<'info> {
    #[account(mut)]
    pub invitation: Account<'info, Invitation>,
    pub org_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(revision: u32)]
pub struct RegisterReportRevision<'info> {
    pub invitation: Account<'info, Invitation>,
    #[account(init, payer = org_authority, space = 8 + 32 + 4 + 32 + 1 + 1, seeds = [b"release", invitation.key().as_ref(), &revision.to_le_bytes()], bump)]
    pub report_release: Account<'info, ReportRelease>,
    #[account(mut)]
    pub org_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReportPermissions<'info> {
    #[account(mut)]
    pub report_release: Account<'info, ReportRelease>,
    pub org_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RevokeReportPermissions<'info> {
    #[account(mut)]
    pub report_release: Account<'info, ReportRelease>,
    pub org_authority: Signer<'info>,
}

#[error_code]
pub enum HiringError {
    #[msg("Invalid state transition")]
    InvalidTransition,
    #[msg("Stale revision")]
    StaleRevision,
}
