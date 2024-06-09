const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { rechargeWallet } = require("./common/utils");

const TREASURY_PREFIX = 'treasury';
const AUTHORIZED_CLMM_PREFIX = 'authorized_clmm';

describe("Authorize CLMM program", () => {
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
  const minAmountToCollect = new anchor.BN(1_000_000);
  const clmmProgramId = new anchor.web3.PublicKey("devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH");
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
    console.log(`treasuryPK: ${treasuryTokenAccount.address}`);

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

  it("fails to authorize clmm with wrong authority", async () => {
    try {
      await program.rpc.authorizeClmm(
        clmmProgramId,
        {
          accounts: {
            authorizedClmm: authorizedClmmPubkey,
            donationProtocol: donationProtocolData.publicKey,
            payer: wrongAuthority.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [wrongAuthority],
        }
      );
      assert.ok(false);
    } catch (err) {
      assert.equal(err.error.errorCode.code, "ConstraintRaw");
      assert.equal(err.error.errorCode.number, 2003);
      assert.equal(err.error.errorMessage, "A raw constraint was violated");
    }
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
});
