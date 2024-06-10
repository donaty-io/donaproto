const borsh = require('borsh');
const anchor = require("@coral-xyz/anchor");
const fs = require('fs');

async function getNowTs(provider) {
  const accountInfo = await provider.connection.getAccountInfo(anchor.web3.SYSVAR_CLOCK_PUBKEY);
  const reader = new borsh.BinaryReader(accountInfo.data);
  slot = reader.readU64().toNumber();
  epoch_start_timestamp = reader.readU64().toNumber();
  epoch = reader.readU64().toNumber();
  leader_schedule_epoch = reader.readU64().toNumber();
  unix_timestamp = reader.readU64().toNumber();
  
  return unix_timestamp;
}

async function rechargeWallet(connection, wallet, lamports) {
  const sig = await connection.requestAirdrop(wallet, lamports);
  await connection.confirmTransaction(sig);
  return wallet;
}

const loadObjectFromJsonFile = (filePath) => {
  try {
    const jsonString = fs.readFileSync(filePath, 'utf8');
    const object = JSON.parse(jsonString);
    return object;
  } catch (err) {
    console.error(`Error loading object from JSON file: ${err}`);
    return null;
  }
};

module.exports = {
  getNowTs,
  rechargeWallet,
  loadObjectFromJsonFile,
};
