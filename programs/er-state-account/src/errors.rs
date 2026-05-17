use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The account is not old enough to be closed yet")]
    NotOldEnough,
}
