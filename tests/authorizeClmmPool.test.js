const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { rechargeWallet, loadObjectFromJsonFile } = require("./common/utils");
const { createPoolState } = require("./common/amm_helper");

const TREASURY_PREFIX = 'treasury';
const AUTHORIZED_CLMM_PREFIX = 'authorized_clmm';
const AUTHORIZED_CLMM_POOL_PREFIX = 'authorized_clmm_pool';

const raydiumAmmIdl = loadObjectFromJsonFile('./app/src/idl/raydium-amm.json');

describe("Authorize CLMM pool", () => {
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
  })

  it("initializes donation protocol data", async () => {
    const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      rewardsMintPubKey,
      treasuryOwnerPK,
      allowOwnerOffCurve = true
    )

    const tx = await program.rpc.initializeDonationProtocol(
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
    console.log("Your transaction signature", tx);

    const onchainDonationProtocolData = await program.account.donationProtocolData.fetch(donationProtocolData.publicKey);
    assert.deepEqual(onchainDonationProtocolData.treasuryMint, rewardsMintPubKey);
    assert.deepEqual(onchainDonationProtocolData.treasury, treasuryTokenAccount.address);
    assert.deepEqual(onchainDonationProtocolData.donationMint, donationMintPubKey);
    assert.equal(onchainDonationProtocolData.minAmountToEarn.toString(), minAmountToEarn.toString());
    assert.equal(onchainDonationProtocolData.treasuryOwnerBump.toString(), treasuryOwnerBump.toString());
    assert.deepEqual(onchainDonationProtocolData.authority, payer.publicKey);
  });

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
    const newMintDecimals = 5; // BONK has 5 decimals
    const newDonationMintPubKey = await createMint(
      connection,
      payer,
      donationMintAuthority.publicKey,
      null,
      newMintDecimals
    );

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
    const [authorizedClmmPoolPubkey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(AUTHORIZED_CLMM_POOL_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        poolStateResult.poolId.toBuffer(),
      ],
      program.programId,
    );
    console.log("authorizedClmmPoolPubkey", authorizedClmmPoolPubkey.toString());
    console.log("authorizedClmmPubkey", authorizedClmmPubkey.toString());

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
});
