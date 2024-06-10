const anchor = require("@coral-xyz/anchor");
const {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount
} = require('@solana/spl-token');
const os = require('os');
const assert = require('assert');
const { TREASURY_PREFIX, CONTRIBUTOR_PREFIX } = require("./common/seeds");


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
  const contributorWallet = anchor.web3.Keypair.generate();
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

    await program.rpc.initializeDonationProtocol(
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
  })

  it("initializes contributor data", async () => {
    const [contributorDataPubkey, contributorDataBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(CONTRIBUTOR_PREFIX),
        donationProtocolData.publicKey.toBuffer(),
        contributorWallet.publicKey.toBuffer(),
      ],
      program.programId,
    );

    const tx = await program.rpc.initializeContributor(
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
    console.log("Your transaction signature", tx);

    // check data
    const onchainContributorData = await program.account.contributorData.fetch(contributorDataPubkey);
    assert.ok(onchainContributorData.donationProtocol.equals(donationProtocolData.publicKey));
    assert.equal(onchainContributorData.totalAmountDonated, 0);
    assert.equal(onchainContributorData.totalAmountEarned, 0);
    assert.equal(onchainContributorData.donationsCount, 0);
    assert.equal(onchainContributorData.bump, contributorDataBump);
  });
});
