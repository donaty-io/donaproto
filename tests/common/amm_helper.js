const anchor = require("@coral-xyz/anchor");
const { SqrtPriceMath, ClmmInstrument, getPdaPoolId } = require("@raydium-io/raydium-sdk-v2");
const {
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const Decimal = require('decimal.js');

async function createPoolState(
  program,
  connection,
  payer,
  {
    ammConfigPubkey,
    tokenMint0,
    tokenMint1,
    price,
    openTime,
  }
) {
  const [mintA, mintB, initPrice] = new anchor.BN(new anchor.web3.PublicKey(tokenMint0.address).toBuffer()).gt(
    new anchor.BN(new anchor.web3.PublicKey(tokenMint1.address).toBuffer()),
  )
    ? [tokenMint1, tokenMint0, new Decimal(1).div(new Decimal(price))]
    : [tokenMint0, tokenMint1, new Decimal(price)];

  const initialPriceX64 = SqrtPriceMath.priceToSqrtPriceX64(initPrice, mintA.decimals, mintB.decimals);
  try {
    const { publicKey: poolId } = await getPdaPoolId(program.programId, ammConfigPubkey, mintA.address, mintB.address);
    const createPoolStateInstData = await ClmmInstrument.createPoolInstructions({
      connection,
      programId: program.programId,
      owner: payer.publicKey,
      mintA,
      mintB,
      ammConfigId: ammConfigPubkey,
      initialPriceX64,
      startTime: openTime,
      forerunCreate: false,
    })

    const tx = new anchor.web3.Transaction().add(...createPoolStateInstData.instructions);
    const txSignature = await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer, ...createPoolStateInstData.signers]);
    console.log(`Pool state account created: ${txSignature}`);

    return {
      poolId,
      mintA,
      mintB,
      success: true,
    }
  } catch (err) {
    console.error('Error creating pool state account:', err);
    throw err;
  }
}

async function createObservation(connection, clmmProgramId, payer, observationKeypair) {
  const tx = new anchor.web3.Transaction();
  const OBSERVATION_SIZE = 41 + 80 + 52 * 1000;

  const inst = anchor.web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: observationKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(
      OBSERVATION_SIZE
    ),
    space: OBSERVATION_SIZE,
    programId: clmmProgramId,
  });

  tx.add(inst)

  const txSignature = await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer, observationKeypair]);
  console.log(`Observation transaction signature: ${txSignature}`);
}

module.exports = {
  createObservation,
  createPoolState,
};
