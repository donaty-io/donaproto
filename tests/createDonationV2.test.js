const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint,
  mintTo
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { rechargeWallet, loadObjectFromJsonFile, getNowTs } = require("./common/utils");
const { createPoolState } = require("./common/amm_helper");
const {
  TREASURY_PREFIX,
  AUTHORIZED_CLMM_PREFIX,
  AUTHORIZED_CLMM_POOL_PREFIX,
  HOLDING_PREFIX,
  CREATOR_PREFIX
} = require("./common/seeds");

const raydiumAmmIdl = loadObjectFromJsonFile('./app/src/idl/raydium-amm.json');

describe("Create donation V2", () => {
  const homedir = os.homedir();
  process.env.ANCHOR_WALLET = `${homedir}/.config/solana/id.json`;
  const program = anchor.workspace.Donaproto;
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const clmmProgramId = new anchor.web3.PublicKey("devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH");
  const ammConfigPubkey = new anchor.web3.PublicKey("GVSwm4smQBYcgAJU7qjFHLQBHTc4AdB3F2HbZp6KqKof");
  const clmmProgram = new anchor.Program(
    raydiumAmmIdl,
    clmmProgramId,
    provider
  )

  const connection = provider.connection;
  const { payer } = program.provider.wallet
  const donationMintAuthority = payer;
  const donationMintDecimals = 6;
  let donationMintPubKey, rewardsMintPubKey
  const rewardMintAuthority = payer;
  const rewardMintDecimals = 9;
  const minAmountToCollect = new anchor.BN(1_000_000);
  const minAmountToEarn = new anchor.BN(1000);
  const donationProtocolData = anchor.web3.Keypair.generate();
  const [treasuryOwnerPK, treasuryOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(TREASURY_PREFIX),
      donationProtocolData.publicKey.toBuffer(),
    ],
    program.programId,
  );
  const [authorizedClmmPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(AUTHORIZED_CLMM_PREFIX),
      donationProtocolData.publicKey.toBuffer(),
      clmmProgramId.toBuffer(),
    ],
    program.programId,
  );
  const wrongAuthority = anchor.web3.Keypair.generate();
  const newMintDecimals = 5; // BONK has 5 decimals
  let newDonationMintPubKey;
  let authorizedClmmPoolPubkey;
  let poolStatePubkey;
  const creatorWallet = anchor.web3.Keypair.generate();
  let creatorDataPubkey, creatorDataBump;
  let creatorDonationTokenAccount;

  before(async () => {
    await rechargeWallet(connection, wrongAuthority.publicKey, 1e9);
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

    newDonationMintPubKey = await createMint(
      connection,
      payer,
      donationMintAuthority.publicKey,
      null,
      newMintDecimals
    );

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
      minAmountToCollect,
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
      newDonationMintPubKey,
      creatorWallet.publicKey
    )

    await mintTo(
      connection,
      payer,
      newDonationMintPubKey,
      creatorDonationTokenAccount.address,
      donationMintAuthority,
      10_000_000_000
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

  it("authorizes clmm", async () => {
    const tx = await program.rpc.authorizeClmm(
      clmmProgramId,
      {
        accounts: {
          authorizedClmm: authorizedClmmPubkey,
          donationProtocol: donationProtocolData.publicKey,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      }
    );
    console.log("Authorize CLMM transaction signature", tx);

    const onchainAuthorizedClmm = await program.account.authorizedClmm.fetch(authorizedClmmPubkey);
    assert.deepEqual(onchainAuthorizedClmm.donationProtocol, donationProtocolData.publicKey);
    assert.deepEqual(onchainAuthorizedClmm.programId, clmmProgramId);
  });

  it("authorizes clmm pool", async () => {
    const tokenMint0 = await getMint(connection, donationMintPubKey);
    const tokenMint1 = await getMint(connection, newDonationMintPubKey);

    const price = 36626.12336; // USDC(token0) per BONK(token1) = 36626.12336
    const openTime = new anchor.BN(0);
    const poolStateResult = await createPoolState(
      clmmProgram,
      connection,
      payer,
      {
        ammConfigPubkey,
        tokenMint0,
        tokenMint1,
        price,
        openTime,
      }
    );
    [authorizedClmmPoolPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(AUTHORIZED_CLMM_POOL_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        poolStateResult.poolId.toBuffer(),
      ],
      program.programId,
    );
    poolStatePubkey = poolStateResult.poolId;

    const tx = await program.rpc.authorizeClmmPool(
      {
        accounts: {
          authorizedClmmPool: authorizedClmmPoolPubkey,
          poolState: poolStateResult.poolId,
          ammConfig: ammConfigPubkey,
          donationProtocol: donationProtocolData.publicKey,
          donationAmmMint: newDonationMintPubKey,
          authorizedClmm: authorizedClmmPubkey,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      }
    );
    console.log("Authorize CLMM Pool transaction signature", tx);

    const onchainAuthorizedClmmPool = await program.account.authorizedClmmPool.fetch(authorizedClmmPoolPubkey);
    assert.deepEqual(onchainAuthorizedClmmPool.donationProtocol, donationProtocolData.publicKey);
    assert.deepEqual(onchainAuthorizedClmmPool.poolState, poolStateResult.poolId);
    assert.deepEqual(onchainAuthorizedClmmPool.programId, clmmProgramId);
    assert.deepEqual(onchainAuthorizedClmmPool.token, newDonationMintPubKey);
  });

  it("creates a donation", async () => {
    const amount = new anchor.BN(1_000_000_000); // 1000$
    const ipfsHash = "some_ipfs_hash";
    const endingTimestamp = await getNowTs(provider) + 100_000;
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
      newDonationMintPubKey,
      holdingWalletOwnerPubkey,
      true,
    );

    const tx = await program.rpc.createDonationV2(
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
          donationMint: newDonationMintPubKey,
          defaultDonationMint: donationMintPubKey,
          authorizedClmmPool: authorizedClmmPoolPubkey,
          poolState: poolStatePubkey,
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
    assert.deepEqual(onchainDonationData.donationMint, newDonationMintPubKey);
  });
});
