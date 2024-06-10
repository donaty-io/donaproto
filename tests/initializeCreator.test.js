const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { TREASURY_PREFIX, CREATOR_PREFIX } = require("./common/seeds");


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
  })

  it("initializes creator data", async () => {
    const creatorDonationTokenAccount = await getOrCreateAssociatedTokenAccount(
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

    const [creatorDataPubkey, creatorDataBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(CREATOR_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        creatorWallet.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const tx = await program.rpc.initializeCreator(
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
    console.log("Your transaction signature", tx);

    // check data
    const onchainCreatorData = await program.account.creatorData.fetch(creatorDataPubkey);
    assert.ok(onchainCreatorData.donationProtocol.equals(donationProtocolData.publicKey));
    assert.equal(onchainCreatorData.donationsCreatedCount, 0);
    assert.equal(onchainCreatorData.donationsClosedCount, 0);
    assert.equal(onchainCreatorData.totalAmountReceived, 0);
    assert.equal(onchainCreatorData.totalAmountCollecting, 0);
  });
});
