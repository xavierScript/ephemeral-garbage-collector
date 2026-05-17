#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

mod state;
mod instructions;
mod errors;

use instructions::*;
use errors::*;

declare_id!("FuZHJm6zPn3jFyhsWCr7SRgi1F7dzBN1SE6cCetyKrsi");

#[ephemeral]
#[program]
pub mod er_state_account {

    use super::*;

    pub fn initialize(ctx: Context<InitUser>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)?;
        
        Ok(())
    }

    pub fn update(ctx: Context<UpdateUser>, new_data: u64) -> Result<()> {
        ctx.accounts.update(new_data)?;
        
        Ok(())
    }

    pub fn update_commit(ctx: Context<UpdateCommit>, new_data: u64) -> Result<()> {
        ctx.accounts.update_commit(new_data)?;
        
        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>) -> Result<()> {
        ctx.accounts.delegate()?;
        
        Ok(())
    }

    pub fn undelegate(ctx: Context<Undelegate>) -> Result<()> {
        ctx.accounts.undelegate()?;
        
        Ok(())
    }

    pub fn close(ctx: Context<CloseUser>) -> Result<()> {
        ctx.accounts.close()?;
        
        Ok(())
    }

    pub fn schedule_close(ctx: Context<ScheduleClose>, task_id: u16) -> Result<()> {
        ctx.accounts.schedule(task_id, &ctx.bumps)?;
        
        Ok(())
    }

    pub fn crank_close(ctx: Context<CrankClose>) -> Result<()> {
        ctx.accounts.close()?;
        
        Ok(())
    }
}

