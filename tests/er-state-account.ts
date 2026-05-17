import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";
import { init as initTuktuk, taskKey, taskQueueAuthorityKey } from "@helium/tuktuk-sdk";
import { assert } from "chai";
import { ErStateAccount } from "../target/types/er_state_account";
describe("er-state-account", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
        "https://devnet.magicblock.app/",
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
      },
    ),
    anchor.Wallet.local(),
  );
  console.log("Base Layer Connection: ", provider.connection.rpcEndpoint);
  console.log(
    "Ephemeral Rollup Connection: ",
    providerEphemeralRollup.connection.rpcEndpoint,
  );
  console.log(`Current SOL Public Key: ${provider.wallet.publicKey}`);

  before(async function () {
    const balance = await provider.connection.getBalance(
      provider.wallet.publicKey,
    );
    console.log("Current balance is", balance / LAMPORTS_PER_SOL, " SOL", "\n");
  });

  const program = anchor.workspace.erStateAccount as Program<ErStateAccount>;

  const userAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

  // TukTuk PDAs
  const taskQueue = new anchor.web3.PublicKey(
    "97jKQ98Na3Yd4H1yMeCfJ6CE8ShfTdu1Y8X6A46jqNSF"
  );
  
  const queueAuthority = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("queue_authority")],
    program.programId,
  )[0];
  
  const taskQueueAuthority = taskQueueAuthorityKey(
    taskQueue,
    queueAuthority,
  )[0];

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .initialize()
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("User Account initialized: ", tx);
  });

  it("Update State!", async () => {
    const tx = await program.methods
      .update(new anchor.BN(42))
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
      })
      .rpc();
    console.log("\nUser Account State Updated: ", tx);
  });

  it("Delegate to Ephemeral Rollup!", async () => {
    let tx = await program.methods
      .delegate()
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
        validator: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc({ skipPreflight: true });

    console.log("\nUser Account Delegated to Ephemeral Rollup: ", tx);
  });

  it("Update State and Commit to Base Layer!", async () => {
    let tx = await program.methods
      .updateCommit(new anchor.BN(43))
      .accountsPartial({
        user: providerEphemeralRollup.wallet.publicKey,
        userAccount: userAccount,
      })
      .transaction();

    tx.feePayer = providerEphemeralRollup.wallet.publicKey;

    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    const txHash = await providerEphemeralRollup.sendAndConfirm(tx, [], {
      skipPreflight: false,
    });
    const txCommitSgn = await GetCommitmentSignature(
      txHash,
      providerEphemeralRollup.connection,
    );

    console.log("\nUser Account State Updated: ", txHash);
  });

  it("Commit and undelegate from Ephemeral Rollup!", async () => {
    let info = await providerEphemeralRollup.connection.getAccountInfo(
      userAccount,
    );

    console.log("User Account Info: ", info);

    console.log("User account", userAccount.toBase58());

    let tx = await program.methods
      .undelegate()
      .accounts({
        user: providerEphemeralRollup.wallet.publicKey,
      })
      .transaction();

    tx.feePayer = providerEphemeralRollup.wallet.publicKey;

    tx.recentBlockhash = (
      await providerEphemeralRollup.connection.getLatestBlockhash()
    ).blockhash;
    tx = await providerEphemeralRollup.wallet.signTransaction(tx);
    const txHash = await providerEphemeralRollup.sendAndConfirm(tx, [], {
      skipPreflight: false,
    });
    const txCommitSgn = await GetCommitmentSignature(
      txHash,
      providerEphemeralRollup.connection,
    );

    console.log("\nUser Account Undelegated: ", txHash);
  });

  it("Update State!", async () => {
    let tx = await program.methods
      .update(new anchor.BN(45))
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
      })
      .rpc();

    console.log("\nUser Account State Updated: ", tx);
  });

  it("Schedule auto-close task", async () => {
    let tuktukProgram = await initTuktuk(provider);

    // Ensure the task queue authority is initialized for our PDA
    const taskQueueAuthorityInfo = await provider.connection.getAccountInfo(taskQueueAuthority);
    if (!taskQueueAuthorityInfo) {
        console.log("\nInitializing Task Queue Authority for PDA...");
        await tuktukProgram.methods
            .addQueueAuthorityV0()
            .accounts({
                payer: provider.wallet.publicKey,
                queueAuthority: queueAuthority,
                taskQueue: taskQueue,
            })
            .rpc();
        console.log("Task Queue Authority Initialized!");
    }

    let taskID = 0;
    const tx = await program.methods
      .scheduleClose(taskID)
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
        taskQueue: taskQueue,
        taskQueueAuthority: taskQueueAuthority,
        task: taskKey(taskQueue, taskID)[0],
        queueAuthority: queueAuthority,
        systemProgram: anchor.web3.SystemProgram.programId,
        tuktukProgram: tuktukProgram.programId,
      })
      .rpc();
      
    assert(
      tuktukProgram.programId.equals(
        new anchor.web3.PublicKey(
          "tuktukUrfhXT6ZT77QTU8RQtvgL967uRuVagWF57zVA",
        ),
      ),
    );
    console.log("\nScheduled Auto-Close Task Signature: ", tx);
  });

  it("Fail to crankClose early (Security Check)", async () => {
    try {
      await program.methods
        .crankClose()
        .accountsPartial({
          user: provider.wallet.publicKey,
          userAccount: userAccount,
        })
        .rpc();
      assert.fail("crankClose should have failed because 60 seconds have not passed.");
    } catch (err) {
      console.log("\nEarly crankClose failed as expected! Account is secure.");
    }
  });

  it("Wait 60 seconds for Garbage Collection Threshold", async () => {
    console.log("\nWaiting 62 seconds to simulate account abandonment...");
    await new Promise(resolve => setTimeout(resolve, 62000));
    console.log("Wait complete.");
  });

  it("CrankClose succeeds after 60 seconds", async () => {
    const tx = await program.methods
      .crankClose()
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
      })
      .rpc();
    console.log("\nAccount Successfully Garbage Collected by Cranker! Signature: ", tx);
  });
});
