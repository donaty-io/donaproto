#!/usr/bin/env bash

set -e
cd "$(dirname "$0")/.."

set -x
solana config set --url localhost

solana-keygen new

anchor test

exit 0