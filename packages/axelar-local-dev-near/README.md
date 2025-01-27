## Axelar Local Dev: Near Integration

This package enables you to set up a local development environment for cross-chain communication with the NEAR Protocol. Presently, we offer support for general message passing between NEAR and EVM chains (Note: Aptos support is yet to be implemented).

## Installation

To install this package, use the following command:

```bash
npm install @axelar-network/axelar-local-dev-near
```

## Configuration

To utilize the NEAR chain stack alongside the EVM chain stack, you will need to adjust the `createAndExport` function in your script. Specifically, create a `NearRelayer` instance and integrate it with your existing EVM relayer. Here's an example of how you might adjust the configuration:

```ts
const nearRelayer = new NearRelayer();
const relayers = { evm: new EvmRelayer({ nearRelayer }), near: nearRelayer };
```

Please refer to our [Standalone Environment Setup Guide](../../docs/guide_create_and_exports.md) for further details on configuring the `createAndExport` function.

## API Reference

NEAR local development enviroment is based on [near-workspaces-js](https://github.com/near/workspaces-js) and `NearNetwork` is an extension of `Worker` (available in [near-workspaces-js](https://github.com/near/workspaces-js) package). `NearNetwork` includes everything that `Worker` has and some additional funcionalities:

-   `createAccountAndDeployContract(accountId: string, contractWasmPath: string, nearAmount = 200)`: Allows user to quickly create a new NEAR account with a specified amount of NEAR (default - 200 NEAR) and deploy contract to it.

-   `callContract(account: NearAccount, contract: NearAccount, method: string, args: any, amount = 0)`: This method needs to be used to do any contract calls, it takes the account that will call the contract, contract that we want to call, method that we want to call, args and amount of NEAR that we wish to attach to the call.

-   `stopNetwork()`: Needs to be called at the end of the script, so it stops the `near-sandbox` process which is a local mini-NEAR blockchain.

Additionally we export a utility function:

-   `createNearNetwork(config?: Config)`: Creates an instance of `NearNetwork` and starts the `near-sandbox` process. It can take a `Config` object as described in [near-workspaces-js](https://github.com/near/workspaces-js).
