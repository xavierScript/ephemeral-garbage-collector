use anchor_lang::prelude::*;
use crate::state::UserAccount;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct CrankClose<'info> {
    /// CHECK: The cranker passes the original user's pubkey here so the rent can be refunded securely.
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    
    #[account(
        mut,
        close = user,
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccount>>,
    pub system_program: Program<'info, System>,
}

impl<'info> CrankClose<'info> {
    pub fn close(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;
        
        // Check if 60 seconds have passed since last activity
        require!(
            current_time - self.user_account.last_active > 60,
            ErrorCode::NotOldEnough
        );

        // Account logic handles closing and rent refund automatically via the `close = user` macro.
        Ok(())
    }
}
