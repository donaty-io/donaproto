const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { getNowTs, rechargeWallet } = require('./common/utils');

const TREASURY_PREFIX = 'treasury';
const CREATOR_PREFIX = 'creator';
const HOLDING_PREFIX = 'holding';

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

    const [treasuryOwnerPK, treasuryOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(TREASURY_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      rewardsMintPubKey,
      treasuryOwnerPK,
      allowOwnerOffCurve = true
    )

    await program.rpc.initializeDonationProtocol(
      minAmountToEarn,
      treasuryOwnerBump,
      {
        accounts: {
          donationProtocolData: donationProtocolData.publicKey,
          treasury: treasuryTokenAccount.address,
          treasuryOwner: treasuryOwnerPK,
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
    console.log(`creatorWalletBalance: ${creatorWalletBalance}`);
  })

  it("creates a donation", async () => {
    const amount = new anchor.BN(1000000000); // 1000$
    const ipfsHash = "some_ipfs_hash";
    const endingTimestamp = await getNowTs(provider) + 100000;
    const donationData = anchor.web3.Keypair.generate();
    const [holdingWalletOwnerPubkey, holdingWalletOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(HOLDING_PREFIX),
        donationData.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const holdingWallet = await getOrCreateAssociatedTokenAccount(
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
          holdingWallet: holdingWallet.address,
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
    assert.deepEqual(onchainDonationData.holdingWallet, holdingWallet.address);
    assert.deepEqual(onchainDonationData.creatorData, creatorDataPubkey);
    assert.equal(onchainDonationData.holdingBump, holdingWalletOwnerBump);
    assert.equal(onchainDonationData.ipfsHash, ipfsHash);
  });

  it("fails to create a donation if ending timestamp in the past", async () => {
    const amount = new anchor.BN(1000000000); // 1000$
    const ipfsHash = "some_ipfs_hash";
    const endingTimestamp = await getNowTs(provider) - 1;
    const donationData = anchor.web3.Keypair.generate();
    const [holdingWalletOwnerPubkey, holdingWalletOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(HOLDING_PREFIX),
        donationData.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const holdingWallet = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      donationMintPubKey,
      holdingWalletOwnerPubkey,
      true,
    );

    try {
      await program.rpc.createDonation(
        amount,
        ipfsHash,
        new anchor.BN(endingTimestamp),
        holdingWalletOwnerBump,
        {
          accounts: {
            donationData: donationData.publicKey,
            donationProtocol: donationProtocolData.publicKey,
            holdingWallet: holdingWallet.address,
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
    } catch (error) {
      assert.equal(error.toString(), "AnchorError occurred. Error Code: InvalidEndingTimestamp. Error Number: 6000. Error Message: Invalid ending timestamp.");
    }
  });

  // TODO: add ipfs len validaion test
});
