# Overview

The donation protocol implements on-chain creation of donation, contributor, creator data.
People who donate are eligible to receive token rewards.

## Protocol data design
![Solana Donation](https://github.com/donaty-io/donaproto/assets/3645723/5773ddc5-f67f-4765-9f58-f342890f12d1)

## Create fundraising in SPL token different from defaults
Donation protocol supports default SPL token mint in which organizations can collect fundraisings.
Calculation of donors rewards, contributors and creators statistics depend on default token.
So in order to introduce different fundraising token mint we integrate v2 instructions with Raydium CLMM and sdk-v2.
Raydium CLMM `PoolState` is used to get current token pair price and calculate fair rewards and statistics.

### Authorize CLMM program and PoolState
In order to be able to create fundraising in different token then default new donation must be authorized by donation protocol authority.
New donation mints are allowed with high liquidity on DEX and have tradable pair linked with USDC token.
```mermaid
sequenceDiagram
    autonumber
    actor Creator
    actor Authority
    participant DonationProtocol
    participant OnChain

    Creator->>Authority: requests support of new fundraising token mint
    loop Verify requests
        Authority->>Authority: Check DEX liquidity regarding USDC token 
    end
    Authority->>DonationProtocol: authorize clmm program
    DonationProtocol->>OnChain: create authorized clmm program data
    Authority->>DonationProtocol: authorize clmm pool state
    DonationProtocol->>OnChain: create authorized clmm pool data
    Authority->>Creator: notify creator about requested token mint support
    Note left of Authority: Creator can start to create fundraising in requested token 
```

### Fundraising flow v2
```mermaid
sequenceDiagram
    autonumber
    actor Creator
    actor Contributor
    participant DonationProtocol
    participant OnChain

    Creator->>DonationProtocol: createDonationV2
    DonationProtocol->>OnChain: update data
    Note left of OnChain: verify donation mint and intialize data
    loop Fundraising
        Contributor->>DonationProtocol: donateV2(amount)
        DonationProtocol->>OnChain: update data
        Note left of OnChain: transfer and add amount to fundraising,<br>convert amount to default_amount base on PoolState,<br>+default_amount to statistic and transfer rewards in default amount
    end

    Creator->>DonationProtocol: withdrawFundsV2
    DonationProtocol->>OnChain: update data
    Note left of OnChain: transfer total_amount_received in donation_mint,<br>calculate default_amount base on PoolState,<br>add default_amount to total_amount_received
```

# Environment Setup

1. Install Anchor 0.29.0 from https://www.anchor-lang.com/docs/installation

## Build and test source code

### Build programs
```
$ anchor build
```

### Test programs
1. Generate payer if it doesn't exist yet
```
$ solana-keygen new
```
2. Run the functional and integration tests. First it builds and deploys the smart contract then tests are executed locally.
```
$ anchor test
```

### Deploy Program
```
$ anchor deploy --program-name donaproto --provider.cluster devnet --provider.wallet /path_to_authority_keypair/private_key.json 
```
