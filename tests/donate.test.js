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
    const creatorWalletBalance = await connection.getBalance(creatorWallet.publicKey);

    const amount = new anchor.BN(1000000000); // 1000$
    const ipfsHash = "some_ipfs_hash";
    const endingTimestamp = await getNowTs(provider) + 100000;
    const [holdingWalletOwnerPubkey, holdingWalletOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(HOLDING_PREFIX),
        donationData.publicKey.toBuffer(),
      ],
      program.programId,
    );

    donationHoldingWallet = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      holdingWalletOwnerPubkey,
      true,
    );

    const tx = await program.rpc.createDonation(
      amount,
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
    console.log("Your transaction signature", tx);

    const onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.amountCollecting.toString(), amount.toString());
    assert.equal(onchainDonationData.totalAmountReceived, 0);
    assert.equal(onchainDonationData.endingTimestamp, endingTimestamp);
    assert.equal(onchainDonationData.isClosed, false);
    assert.deepEqual(onchainDonationData.recipient.toString(), creatorDonationTokenAccount.address.toString());
    assert.deepEqual(onchainDonationData.donationProtocol, donationProtocolData.publicKey);
    assert.deepEqual(onchainDonationData.holdingWallet, donationHoldingWallet.address);
    assert.deepEqual(onchainDonationData.creatorData, creatorDataPubkey);
    assert.equal(onchainDonationData.holdingBump, holdingWalletOwnerBump);
    assert.equal(onchainDonationData.ipfsHash, ipfsHash);
  });

  it("donates and earns reward", async () => {
    await rechargeWallet(connection, contributorWallet.publicKey, 1000000000);
    const [contributorDataPubkey, contributorDataBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(CONTRIBUTOR_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        contributorWallet.publicKey.toBuffer(),
      ],
      program.programId,
    );
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

    const contributorDonationTokenAccount = await getOrCreateAssociatedTokenAccount(
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

    const contributorRewardTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      rewardsMintPubKey,
      contributorWallet.publicKey
    )

    // when treasury has not enough reward, contributor can't earn reward
    // but can donate
    const amount = new anchor.BN(1000000); // 1000$
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

    let balanceDonationHoldingWallet = await connection.getTokenAccountBalance(donationHoldingWallet.address);
    assert.equal(balanceDonationHoldingWallet.value.amount, amount.toString());
    let balanceContributorRewardTokenAccount = await connection.getTokenAccountBalance(contributorRewardTokenAccount.address);
    assert.equal(balanceContributorRewardTokenAccount.value.amount, "0");

    let onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.totalAmountReceived.toString(), amount.toString());
    assert.equal(onchainDonationData.isClosed, false);

    let onchainContributorData = await program.account.contributorData.fetch(contributorDataPubkey);
    assert.equal(onchainContributorData.totalAmountDonated.toString(), amount.toString());
    assert.equal(onchainContributorData.totalAmountEarned.toString(), 0);
    assert.equal(onchainContributorData.donationsCount.toString(), 1);

    // when treasury has anough reward, contributor can earn reward
    await mintTo(
      connection,
      payer,
      rewardsMintPubKey,
      treasuryTokenAccount.address,
      rewardMintAuthority,
      10000000000, // 10000$
    )

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

    balanceDonationHoldingWallet = await connection.getTokenAccountBalance(donationHoldingWallet.address);
    assert.equal(balanceDonationHoldingWallet.value.amount, amount.muln(2).toString());
    balanceContributorRewardTokenAccount = await connection.getTokenAccountBalance(contributorRewardTokenAccount.address);
    assert.equal(balanceContributorRewardTokenAccount.value.amount, "10000");

    onchainDonationData = await program.account.donationData.fetch(donationData.publicKey);
    assert.equal(onchainDonationData.totalAmountReceived.toString(), amount.muln(2).toString());
    assert.equal(onchainDonationData.isClosed, false);

    onchainContributorData = await program.account.contributorData.fetch(contributorDataPubkey);
    assert.equal(onchainContributorData.totalAmountDonated.toString(), amount.muln(2).toString());
    assert.equal(onchainContributorData.totalAmountEarned.toString(), "10000");
    assert.equal(onchainContributorData.donationsCount.toString(), 2);
  });
});
