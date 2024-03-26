# Overview

The donation protocol implements on-chain creation of donation, contributor, creator data.
People who donate are eligible to receive token rewards.


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