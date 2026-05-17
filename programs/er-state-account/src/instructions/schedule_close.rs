use std::str::FromStr;

use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{prelude::*, InstructionData};
use tuktuk_program::{
    compile_transaction,
    tuktuk::{
        cpi::{accounts::QueueTaskV0, queue_task_v0},
        program::Tuktuk,
        types::TriggerV0,
    },
    types::QueueTaskArgsV0,
    TransactionSourceV0,
};

use crate::state::UserAccount;

#[derive(Accounts)]
pub struct ScheduleClose<'info> {
    #[account(
        mut,
        // address = Pubkey::from_str("Dhu3UEtRGE5iKzXJUiiFStJL4F63eW4nJMRd3dAg9WJK").unwrap()
    )]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Account<'info, UserAccount>,
    
    /// CHECK: Don't need to parse this account, just using it in CPI
    #[account(mut)]
    pub task_queue: UncheckedAccount<'info>,
    
    /// CHECK: Don't need to parse this account, just using it in CPI
    pub task_queue_authority: UncheckedAccount<'info>,
    
    /// CHECK: Initialized in CPI
    #[account(mut)]
    pub task: UncheckedAccount<'info>,
    
    /// CHECK: Via seeds
    #[account(
        mut,
        seeds = [b"queue_authority"],
        bump
    )]
    pub queue_authority: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub tuktuk_program: Program<'info, Tuktuk>,
}

impl<'info> ScheduleClose<'info> {
    pub fn schedule(&mut self, task_id: u16, bumps: &ScheduleCloseBumps) -> Result<()> {
        let (compiled_tx, _) = compile_transaction(
            vec![Instruction {
                program_id: crate::ID,
                accounts: crate::__cpi_client_accounts_crank_close::CrankClose {
                    user: self.user.to_account_info(),
                    user_account: self.user_account.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                }
                .to_account_metas(None)
                .to_vec(),
                data: crate::instruction::CrankClose.data(),
            }],
            vec![],
        )
        .unwrap();

        queue_task_v0(
            CpiContext::new_with_signer(
                self.tuktuk_program.to_account_info(),
                QueueTaskV0 {
                    payer: self.user.to_account_info(),
                    queue_authority: self.queue_authority.to_account_info(),
                    task_queue: self.task_queue.to_account_info(),
                    task_queue_authority: self.task_queue_authority.to_account_info(),
                    task: self.task.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                },
                &[&["queue_authority".as_bytes(), &[bumps.queue_authority]]],
            ),
            QueueTaskArgsV0 {
                trigger: TriggerV0::Now,
                transaction: TransactionSourceV0::CompiledV0(compiled_tx),
                crank_reward: Some(1000001),
                free_tasks: 0,
                id: task_id,
                description: "schedule update".to_string(),
            },
        )?;

        Ok(())
    }
}
