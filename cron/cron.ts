import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { createCronJob, 
    cronJobTransactionKey, 
    getCronJobForName, 
    init as initCron 
} from "@helium/cron-sdk";
import {
  compileTransaction,
  init,
  taskQueueAuthorityKey
} from "@helium/tuktuk-sdk";
import { 
    LAMPORTS_PER_SOL, 
    SystemProgram, 
    TransactionInstruction 
} from "@solana/web3.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sendInstructions } from "@helium/spl-utils";

// Make sure to export the IDL of your program
import { ErStateAccount } from "../target/types/er_state_account";

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .options({
        cronName: {
            type: "string",
            description: "The name of the cron job to create",
            demandOption: true,
        },
        queueName: {
            type: "string",
            description: "The name of the task queue to use",
            demandOption: true,
        },
        rpcUrl: {
            type: "string",
            description: "Your Solana RPC URL",
            demandOption: true,
        },
        fundingAmount: {
            type: "number",
            description: "Amount of SOL to fund the cron job with (in lamports)",
            default: 0.01 * LAMPORTS_PER_SOL,
        },
        })
        .help()
        .alias("help", "h").argv as any;

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const wallet = provider.wallet as anchor.Wallet;

    console.log("Using wallet:", wallet.publicKey.toBase58());
    console.log("RPC URL:", argv.rpcUrl);

    const program = await init(provider);
    const cronProgram = await initCron(provider);
    // You should substitute this with your created Task Queue address
    const taskQueue = new anchor.web3.PublicKey("97jKQ98Na3Yd4H1yMeCfJ6CE8ShfTdu1Y8X6A46jqNSF"); 

    const taskQueueAuthorityPda = taskQueueAuthorityKey(taskQueue, wallet.publicKey)[0];
    const taskQueueAuthorityInfo = await provider.connection.getAccountInfo(taskQueueAuthorityPda);

    if (!taskQueueAuthorityInfo) {
        console.log("Initializing task queue authority for wallet...");
        await program.methods
            .addQueueAuthorityV0()
            .accounts({
                payer: wallet.publicKey,
                queueAuthority: wallet.publicKey,
                taskQueue,
            })
            .rpc({ skipPreflight: true });
        console.log("Task queue authority initialized!");
    } else {
        console.log("Task queue authority already exists");
    }

    let cronJob = await getCronJobForName(cronProgram, argv.cronName);
    console.log("Cron Job:", cronJob);
    if (!cronJob) {
        console.log("Creating new cron job...");
        const { pubkeys: { cronJob: cronJobPubkey } } = await (await createCronJob(cronProgram, {
            tuktukProgram: program,
            taskQueue,
            args: {
                name: argv.cronName,
                schedule: "0 * * * * *", 
                freeTasksPerTransaction: 0,
                numTasksPerQueueCall: 1,
            }
        }))
        .rpcAndKeys({ skipPreflight: false });
        cronJob = cronJobPubkey;
        console.log("Funding cron job with", argv.fundingAmount / LAMPORTS_PER_SOL, "SOL");
        await sendInstructions(provider, [
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: cronJob,
            lamports: argv.fundingAmount,
        }),
        ]);
        
        const erProgram = anchor.workspace.ErStateAccount as Program<ErStateAccount>;
        
        const userAccount = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("user"), wallet.publicKey.toBuffer()], 
            erProgram.programId
        )[0];

        // Create the CrankClose instruction instead of CrankUpdate
        const closeInstruction = await erProgram.methods.crankClose()
            .accountsPartial({
                user: wallet.publicKey,
                userAccount: userAccount,
                systemProgram: anchor.web3.SystemProgram.programId
            }).instruction();

        console.log("Compiling instructions...");
        const { transaction, remainingAccounts } = compileTransaction(
            [closeInstruction],
            []
        );

        await cronProgram.methods
        .addCronTransactionV0({
            index: 0,
            transactionSource: {
            compiledV0: [transaction],
            },
        })
        .accounts({
            payer: wallet.publicKey,
            cronJob,
            cronJobTransaction: cronJobTransactionKey(cronJob, 0)[0],
        })
        .remainingAccounts(remainingAccounts)
        .rpc({ skipPreflight: true });
        console.log(`Cron job created!`);
    } else {
        console.log("Cron job already exists");
    }

    console.log("Cron job address:", cronJob?.toBase58());
    console.log(`\nYour Auto-Close Instruction will be posted every minute. Watch for transactions on task queue ${taskQueue.toBase58()}. To stop the cron job, use the tuktuk-cli:`);
    console.log(`tuktuk -u ${argv.rpcUrl} cron-transaction close --cron-name ${argv.cronName} --id 0`);
    console.log(`tuktuk -u ${argv.rpcUrl} cron close --cron-name ${argv.cronName}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
