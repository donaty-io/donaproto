const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { getNowTs, rechargeWallet } = require('./common/utils');

const TREASURY_PREFIX = 'treasury';
const CREATOR_PREFIX = 'creator';
const HOLDING_PREFIX = 'holding';
const CONTRIBUTOR_PREFIX = 'contributor';

describe("donaproto", () => {
  const homedir = os.homedir();
  process.env.ANCHOR_WALLET = `${homedir}/.config/solana/id.json`;
  const program = anchor.workspace.Donaproto;
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const { payer } = program.provider.wallet
  const donationMintAuthority = payer;
  const donationMintDecimals = 6;
  let donationMintPubKey, rewardsMintPubKey
  const rewardMintAuthority = payer;
  const rewardMintDecimals = 9;
  const donationProtocolData = anchor.web3.Keypair.generate();
  const minAmountToEarn = new anchor.BN(1000);
  const creatorWallet = anchor.web3.Keypair.generate();
  let creatorDataPubkey, creatorDataBump;
  let creatorDonationTokenAccount;
  const donationData = anchor.web3.Keypair.generate();
  const contributorWallet = anchor.web3.Keypair.generate();
  let treasuryTokenAccount, treasuryOwnerPubkey, treasuryOwnerBump;
  let donationHoldingWallet;
  let holdingWalletOwnerPubkey, holdingWalletOwnerBump;
  const donationAmount = new anchor.BN(1000000000); // 1000$
  const [contributorDataPubkey, contributorDataBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(CONTRIBUTOR_PREFIX),
      donationProtocolData.publicKey.toBuffer(),
      contributorWallet.publicKey.toBuffer(),
    ],
    program.programId,
  );
  let contributorDonationTokenAccount, contributorRewardTokenAccount;

  before(async () => {
    donationMintPubKey = await createMint(
      provider.connection,
      payer,
      donationMintAuthority.publicKey,
      null,
      donationMintDecimals
    );

    rewardsMintPubKey = await createMint(
      connection,
      payer,
      rewardMintAuthority.publicKey,
      null,
      rewardMintDecimals
    )

    const [treasuryOwnerPubkeyFound, treasuryOwnerBumpFound] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TREASURY_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
      ],
      program.programId,
    );
    treasuryOwnerPubkey = treasuryOwnerPubkeyFound;
    treasuryOwnerBump = treasuryOwnerBumpFound;

    treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      rewardsMintPubKey,
      treasuryOwnerPubkey,
      allowOwnerOffCurve = true
    )

    await program.rpc.initializeDonationProtocol(
      minAmountToEarn,
      treasuryOwnerBump,
      {
        accounts: {
          donationProtocolData: donationProtocolData.publicKey,
          treasury: treasuryTokenAccount.address,
          treasuryOwner: treasuryOwnerPubkey,
          treasuryMint: rewardsMintPubKey,
          donationMint: donationMintPubKey,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [donationProtocolData],
      }
    );

    creatorDonationTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      creatorWallet.publicKey
    )

    await mintTo(
      connection,
      payer,
      donationMintPubKey,
      creatorDonationTokenAccount.address,
      donationMintAuthority,
      10000000000
    )

    const [creatorDataPubkeyFound, creatorDataBumpFound] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(CREATOR_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        creatorWallet.publicKey.toBuffer(),
      ],
      program.programId,
    );
    creatorDataPubkey = creatorDataPubkeyFound;
    creatorDataBump = creatorDataBumpFound;

    await program.rpc.initializeCreator(
      {
        accounts: {
          creatorData: creatorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          creatorWalletAddress: creatorWallet.publicKey,
          payer: payer.publicKey,
          donationMint: donationMintPubKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      },
    );

    // check data
    const onchainCreatorData = await program.account.creatorData.fetch(creatorDataPubkey);
    assert.ok(onchainCreatorData.donationProtocol.equals(donationProtocolData.publicKey));
    assert.equal(onchainCreatorData.donationsCreatedCount, 0);
    assert.equal(onchainCreatorData.donationsClosedCount, 0);
    assert.equal(onchainCreatorData.totalAmountReceived, 0);
    assert.equal(onchainCreatorData.totalAmountCollecting, 0);

    // top up creator wallet to be able to pay for createDonation tx
    await rechargeWallet(connection, creatorWallet.publicKey, 1000000000);

    const ipfsHash = "some_ipfs_hash";
    const endingTimestamp = await getNowTs(provider) + 100000;
    const [holdingWalletOwnerPubkeyFound, holdingWalletOwnerBumpFound] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(HOLDING_PREFIX),
        donationData.publicKey.toBuffer(),
      ],
      program.programId,
    );
    holdingWalletOwnerPubkey = holdingWalletOwnerPubkeyFound;
    holdingWalletOwnerBump = holdingWalletOwnerBumpFound;

    donationHoldingWallet = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      holdingWalletOwnerPubkey,
      true,
    );

    await program.rpc.createDonation(
      donationAmount,
      ipfsHash,
      new anchor.BN(endingTimestamp),
      holdingWalletOwnerBump,
      {
        accounts: {
          donationData: donationData.publicKey,
          donationProtocol: donationProtocolData.publicKey,
          holdingWallet: donationHoldingWallet.address,
          holdingWalletOwner: holdingWalletOwnerPubkey,
          recipient: creatorDonationTokenAccount.address,
          creatorData: creatorDataPubkey,
          donationMint: donationMintPubKey,
          creatorWalletAddress: creatorWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [donationData, creatorWallet],
      }
    );

    const onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.amountCollecting.toString(), donationAmount.toString());
    assert.equal(onchainDonationData.totalAmountReceived, 0);
    assert.equal(onchainDonationData.endingTimestamp, endingTimestamp);
    assert.equal(onchainDonationData.isClosed, false);
    assert.deepEqual(onchainDonationData.recipient.toString(), creatorDonationTokenAccount.address.toString());
    assert.deepEqual(onchainDonationData.donationProtocol, donationProtocolData.publicKey);
    assert.deepEqual(onchainDonationData.holdingWallet, donationHoldingWallet.address);
    assert.deepEqual(onchainDonationData.creatorData, creatorDataPubkey);
    assert.equal(onchainDonationData.holdingBump, holdingWalletOwnerBump);
    assert.equal(onchainDonationData.ipfsHash, ipfsHash);

    await rechargeWallet(connection, contributorWallet.publicKey, 1000000000);
    await program.rpc.initializeContributor(
      contributorDataBump,
      {
        accounts: {
          contributorData: contributorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          contributorWalletAddress: contributorWallet.publicKey,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      },
    );

    contributorDonationTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      contributorWallet.publicKey
    )
    await mintTo(
      connection,
      payer,
      donationMintPubKey,
      contributorDonationTokenAccount.address,
      donationMintAuthority,
      10000000000, // 10000$
    )

    contributorRewardTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      rewardsMintPubKey,
      contributorWallet.publicKey
    )
  });

  it("cannot withdraw funds when neither the amount nor the ending date has been reached and withdraw when amount goal is met", async () => {
    // when treasury has anough reward, contributor can earn reward
    await mintTo(
      connection,
      payer,
      rewardsMintPubKey,
      treasuryTokenAccount.address,
      rewardMintAuthority,
      10000000000, // 10000$
    )

    const amount = new anchor.BN(10000000); // 10$
    await program.rpc.donate(
      amount,
      {
        accounts: {
          donationData: donationData.publicKey,
          contributorData: contributorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          userTokenWallet: contributorDonationTokenAccount.address,
          userRewardTokenWallet: contributorRewardTokenAccount.address,
          rewardTreasury: treasuryTokenAccount.address,
          rewardTreasuryOwner: treasuryOwnerPubkey,
          holdingWallet: donationHoldingWallet.address,
          donationMint: donationMintPubKey,
          rewardMint: rewardsMintPubKey,
          userWallet: contributorWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [contributorWallet],
      }
    );

    try {
      await program.rpc.withdrawFunds({
        accounts: {
          donationData: donationData.publicKey,
          creatorData: creatorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          holdingWallet: donationHoldingWallet.address,
          holdingWalletOwner: holdingWalletOwnerPubkey,
          recipientTokenWallet: creatorDonationTokenAccount.address,
          donationMint: donationMintPubKey,
          payer: creatorWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [creatorWallet],
      });
    } catch (err) {
      assert.equal(err.toString(), "AnchorError occurred. Error Code: DonationEndingReqiuirementsNotMet. Error Number: 6004. Error Message: Donation ending requirements not met.");
    }

    const donationAmountLeft = donationAmount.sub(amount);
    await program.rpc.donate(
      donationAmountLeft,
      {
        accounts: {
          donationData: donationData.publicKey,
          contributorData: contributorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          userTokenWallet: contributorDonationTokenAccount.address,
          userRewardTokenWallet: contributorRewardTokenAccount.address,
          rewardTreasury: treasuryTokenAccount.address,
          rewardTreasuryOwner: treasuryOwnerPubkey,
          holdingWallet: donationHoldingWallet.address,
          donationMint: donationMintPubKey,
          rewardMint: rewardsMintPubKey,
          userWallet: contributorWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [contributorWallet],
      }
    );

    await program.rpc.withdrawFunds({
      accounts: {
        donationData: donationData.publicKey,
        creatorData: creatorDataPubkey,
        donationProtocol: donationProtocolData.publicKey,
        holdingWallet: donationHoldingWallet.address,
        holdingWalletOwner: holdingWalletOwnerPubkey,
        recipientTokenWallet: creatorDonationTokenAccount.address,
        donationMint: donationMintPubKey,
        payer: creatorWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [creatorWallet],
    });

    const onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.isClosed, true);
    const onchainCreatorData = await program.account.creatorData.fetch(creatorDataPubkey);
    assert.equal(onchainCreatorData.totalAmountReceived, donationAmount.toString());
    assert.equal(onchainCreatorData.donationsClosedCount, 1);
  });

  it('withdraw funds when the ending date has been reached', async () => {
    const donationData = anchor.web3.Keypair.generate();
    const endingTimestamp = await getNowTs(provider) + 2;

    const ipfsHash = "some_ipfs_hash";
    const [holdingWalletOwnerPubkey, holdingWalletOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(HOLDING_PREFIX),
        donationData.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const donationHoldingWallet = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      holdingWalletOwnerPubkey,
      true,
    );

    await program.rpc.createDonation(
      donationAmount,
      ipfsHash,
      new anchor.BN(endingTimestamp),
      holdingWalletOwnerBump,
      {
        accounts: {
          donationData: donationData.publicKey,
          donationProtocol: donationProtocolData.publicKey,
          holdingWallet: donationHoldingWallet.address,
          holdingWalletOwner: holdingWalletOwnerPubkey,
          recipient: creatorDonationTokenAccount.address,
          creatorData: creatorDataPubkey,
          donationMint: donationMintPubKey,
          creatorWalletAddress: creatorWallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [donationData, creatorWallet],
      }
    );

    let onchainCreatorData = await program.account.creatorData.fetch(creatorDataPubkey);
    assert.equal(onchainCreatorData.donationsCreatedCount, 2);

    const amount = new anchor.BN(10000000); // 10$
    await program.rpc.donate(
      amount,
      {
        accounts: {
          donationData: donationData.publicKey,
          contributorData: contributorDataPubkey,
          donationProtocol: donationProtocolData.publicKey,
          userTokenWallet: contributorDonationTokenAccount.address,
          userRewardTokenWallet: contributorRewardTokenAccount.address,
          rewardTreasury: treasuryTokenAccount.address,
          rewardTreasuryOwner: treasuryOwnerPubkey,
          holdingWallet: donationHoldingWallet.address,
          donationMint: donationMintPubKey,
          rewardMint: rewardsMintPubKey,
          userWallet: contributorWallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [contributorWallet],
      }
    );
    
    console.log("waiting ending timestamp expiration for 2 seconds");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await program.rpc.withdrawFunds({
      accounts: {
        donationData: donationData.publicKey,
        creatorData: creatorDataPubkey,
        donationProtocol: donationProtocolData.publicKey,
        holdingWallet: donationHoldingWallet.address,
        holdingWalletOwner: holdingWalletOwnerPubkey,
        recipientTokenWallet: creatorDonationTokenAccount.address,
        donationMint: donationMintPubKey,
        payer: creatorWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [creatorWallet],
    });

    const onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.isClosed, true);
    onchainCreatorData = await program.account.creatorData.fetch(creatorDataPubkey);
    assert.equal(onchainCreatorData.totalAmountReceived, donationAmount.add(amount).toString());
    assert.equal(onchainCreatorData.donationsClosedCount, 2);
  })
});
