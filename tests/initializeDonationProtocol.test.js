const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { TREASURY_PREFIX } = require("./common/seeds");


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
  const minAmountToCollect = new anchor.BN(1_000_000);

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
  })

  it("initializes donation protocol data", async () => {
    const minAmountToEarn = new anchor.BN(1000);
    const donationProtocolData = anchor.web3.Keypair.generate();
    const [treasuryOwnerPubkey, treasuryOwnerBump] = anchor.web3.PublicKey.findProgramAddressSync(
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
      treasuryOwnerPubkey,
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
    console.log("Your transaction signature", tx);

    const onchainDonationProtocolData = await program.account.donationProtocolData.fetch(donationProtocolData.publicKey);
    assert.deepEqual(onchainDonationProtocolData.treasuryMint, rewardsMintPubKey);
    assert.deepEqual(onchainDonationProtocolData.treasury, treasuryTokenAccount.address);
    assert.deepEqual(onchainDonationProtocolData.donationMint, donationMintPubKey);
    assert.equal(onchainDonationProtocolData.minAmountToEarn.toString(), minAmountToEarn.toString());
    assert.equal(onchainDonationProtocolData.treasuryOwnerBump.toString(), treasuryOwnerBump.toString());
  });
});
