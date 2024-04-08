# Overview

The donation protocol implements on-chain creation of donation, contributor, creator data.
People who donate are eligible to receive token rewards.

## Protocol data design
![Solana Donation](https://github.com/donaty-io/donaproto/assets/3645723/5773ddc5-f67f-4765-9f58-f342890f12d1)



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
