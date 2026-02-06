# Arrow TC

This repository contains the Arrow TC project for HackMoney 2026

since we need architectural design for some categories, here we go.

## Overview

Arrow is a social web3 platform for DeFi traders.

Users can follow other users and copy their trades, also tip them for their contributions.

## Architecture

- client
- contracts
- abis
- server
- shared

## Frontend

done in vite + react
following atomic design patterns

## Contracts

solidity contracts are in contracts/src

we using openzeppelin as they provide battle tested contracts templates
also because uniswap suggests using their contracts in the docs

We basically aiming for the following with the contracts:

- be able to deploy the contracts to any uniswap v4 pool
- be able to follow other users and copy their trades
- be able to tip them for their contributions

for testing we can run:

``` bash
forge test -vv          → unit tests
forge test -vvvv        → full execution traces
forge test --gas-report → gas costs per function (importnt stuff)
```

This document is a living document, so changes are welcome and expected.
