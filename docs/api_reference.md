## API Reference

This module exports the following types:

- `CreateLocalOptions`: Options to setup multiple local chains using `createAndExport` (see below). All are optional.
  - `chainOutputPath`: A path to save a json file with all the information for the chains that are setup.
  - `accountsToFund`: A list of addresses to fund.
  - `fundAmount`: A string representing the amount of ether to fund accounts with. Defaults to `100 ETH`.
  - `chains`: A list with all of the chain names (also determines the number of created networks). Defaults to `["Moonbeam", "Avalanche", "Fantom", "Ethereum", "Polygon"]`.
  - `relayInterval`?: amount of time between relay of events in miliseconds. Defaults to `2000`.
  - `port`: Port to listen to. Defaults to `8500`.
  - `afterRelay`: A function `(relayData: RelayData) => void` which will be called after each relay. Mainly to be used for debugging.
  - `callback`: A function `(network: Network, info: any) => Promise<null>` that will be called right after setting up each network. Use this to setup additional features, like deploying contracts that already exist on testnet/mainnet.
- `CloneLocalOptions`: An extension of `CreateLocalOptions` that also includes:
  - `env`: a `string` whose value is either `mainnet` or `testnet`, or an `array` of `ChainCloneData`.
  - `chains`: These now act as a filter for which chains to fork. Defaults to all the chains.
  - `networkInfo`: The `NetworkInfo` (see below) which overwrites the default parameters.
- `Network`: This object type is used to handle most functionality within the module. It has the following properties:
  - `name`: The name of the network.
  - `chainId`: The chainId of the network.
  - `provider`: The `ethers.Provider` for the network.
  - `userWallets`: A list of funded `ethers.Wallet` objects.
  - `gateway`: An `ethers.Contract` object corresponding to the Axelar Gateway on the network.
  - `gasReceiver`: An `ethers.Contract` object corresponding to the AxelarGasReceiver that receives gas for remote execution. It expects gas between the same two `relay()`s to function properly.
  - `ownerWallet`, `operatorWallet`, `relayerWallet`, `adminWallets` `threshold` `lastRelayedBlock`: These are for configuring the gateway and relaying.
  - `deployToken(name, symbol, decimals, cap)`: Deploys a new token on the network. For a token to be supported properly it needs to be deployed on all created networks.
  - `getTokenContract(sybmol)`: Returns an `ethers.Contract` linked to the ERC20 token represented by `symbol`.
  - `giveToken(address, symbol, amount)`: Gives `amount` of `symbol` token to `address`.
  - `getInfo()`: Returns an object with all the information about the `Network`.
  - `relay()`: This method is either equivalent to calling the local instance of this module's `relay()` (see below) or, for remote networks, the host's instance of `relay()`.
- `NetworkOptions` This type is used as an input to create networks and can include the following. All are optional.
  - `ganacheOptions`: Additional options to be passed into `require(ganache).provider`.
  - `dbPath`: Where to save/find the db for a network already created. Will not save unless specified.
  - `port`: Which port to listen to for this network. Will not listen to any port unless specified.
  - `name`: The name of the network. Defaults to `Chain {n}` where `n` is the index of the network.
  - `chainId`: The chainId of the network, defaults to `n`.
  - `seed`: A seed that determines the addresses of funded accounts and contract addresses.
- `ChainCloneData`: Data needed to for a network. `mainnetInfo` and `testnetInfo` can both be used as `ChainCloneData`.
  - `name`: Name of the network to create.
    `gateway`: The (preexisting) address of the gateway.
    `rpc`: A url to an RPC to connect to the chain to fork.
    `chainId`: The chain id, as a `Number`.
    `gasService`: The (preexisting) address of the gasService.
    `constAddressDeployer`: The (preexisting) address of the constAddressDeployer.;
    `tokenName`: The name of the native token on this chain.
    `tokenSymbol`: The symbol of the native token on this chain.
    `tokens`: An object with all the registered axelar tokens
- `NetworkSetup`: This type is used as an input to setup networks and can include the following. All but `ownerKey` are optional.
  - `name`: The name of the network. Defaults to `Chain {n}` where `n` is the index of the network.
  - `chainId`: The chainId of the network, defaults to `n`.
  - `ownerKey`: A funded `ethers.Wallet` that will be used for deployments.
  - `userKeys`: A list funded `ethers.Wallet`.
  - `operatorKey`, `relayerKey`, `adminKeys`, `threshold`: Optional info for gateway setup.
- `NetworkInfo`: Information of a chain, used to get an already setup network. They can be obtained by `getInfo()` for any existing network.
  - `name`: The name of the network. Defaults to `Chain {n}` where `n` is the index of the network.
  - `chainId`: The chainId of the network, defaults to `n`.
  - `userKeys`: The user private keys.
  - `ownerKey`: The owner private key.
  - `operatorKey`: The operator private key.
  - `relayerKey`: The relayer private key.
  - `adminKeys`: The admin private key.
  - `threshold`: The threshold of signers on the gateway.
  - `lastRelayedBlock`: The last block that events were replayed up to.
  - `gatewayAddress`: The address of the Axelar gateway.
  - `usdcAddress`: The address of USDC.
  - `gasReceiverAddress`: The address of the `gasService` contract.
  - `constAddressDeployerAddress`: The address of the `constAddressDeployer` contract.

The following is exported by this module.

- `createAndExport(CreateLocalOptions)`: Creates and sets up a number of networks, and listens for RPC for all of them on a single port.
- `forkAndExport(CloneLocalOptions)`: Like the above but forks either mainnet or testnet. Takes longer and spams RPCs so only use if you need something else deployed.
- `createNetwork(NetworkOptions)`: Creates a new `Network`.
- `getNetwork(urlOrProvider, NetworkInfo=null)`: Return `Network` hosted elsewhere into this instance.
- `setupNetwork(urlOrProvider, NetworkSetup)`: Deploy the gateway and USDC Token on a remote blockchain and return the corresponding `Network`. The only value that is required in `NetworkSetup` is `ownerKey` which is a wallet of a funded account.
- `listen(port, callback = null)`: This will serve all the created networks on port `port`. Each network is served at `/i` where `i` is the index of the network in `networks` (the first network created is at `/0` and so on).
- `getAllNetworks(url)`: This will retreive all the networks served by `listen` called from a different instance.
- `relay()`: A function that passes all the messages to all the gateways and calls the appropriate `IAxelarExecutable` contracts.
- `getDepostiAddress(sourceNetwork, destinationNetwork, destinationAddress, symbol)`: This function generates a deposit address on `network1` that will route any funds of type `symbol` deposited there (minus some fee) to the `destinationAddress` in `network2`.
- `getFee(sourceNetwork, destinationNetwork, symbol)`: returns the fee for transferring funds. Is set to a constant `1,000,000`.
- `getGasPrice(sourceNetwork, destinationNetwork, tokenOnSource)`: returns the gas price to execute on `destinationChain`, to be payed in `sourceChain` in token specified by `tokenOnSource` (which is given as an address). `tokenOnSource=AddressZero` corresponds to the native token of the source chain. It always returns `1` but may change in the future.
- `stop(network)`: Destroys the network and removes it from the list of tracked networks.
- `stopAll()`: Stops all tracked networks.
- `networks`: A list of all the `Network`s in this instance.

## Smart Contracts

To use the Networks created you need to interact with the deployed `AxelarGateway` contract. You can send remote contract calls to the contracts implementing the `IAxelarExecutable` interface.

### `AxelarGateway`

This contract exposes three functions to use:

- `sendToken(string destinationChain, string destinationAddress, string symbol, uint256 amount)`: The `destinationChain` has to match the network name for the token to reach its destination after relaying. The `destinationAddress` is the human-readable version of the address, prefixed with `0x`. This is a `string` instead of an `address` because in the real world you can send token to non-evm chains that have other address formats as well. `tokenSymbol` has to match one of the tokens that are deployed in the network, by default just UST but additional tokens can be added (see `deployToken` under `Network`).
- `callContract(string destinationChain, string contractDestinationAddress, bytes payload)`: See above for `destinationChain` and `contractDestinationAddress`. `payload` is the information passed to the contract on the destination chain. Use `abi.encode` to produce `payload`s.
- `callContractWithToken(string destinationChain, string contractDestinationAddress, bytes payload, string symbol, uint256 amount)`: This is a combination of the above two functions, but the token has to arrive at the contract that is executing.

### `IAxelarExecutable`

This interface is to be implemented for a contract to be able to receive remote contract calls. There are two functions that can be overriden, but depending on the use you may only choose to override one of them only.

- `_execute(string memory sourceChain, string memory sourceAddress, bytes calldata payload)`: This will automatically be called when Axelar relays all messages. `sourceChain` and `sourceAddress` can be used to validate who is making the contract call, and `payload` can be decoded with `abi.decode` to produce any data needed.
- `_executeWithToken(string memory sourceChain, string memory sourceAddress, bytes calldata payload, string memory symbol, uinst256 amount)`: This is the same as above but it is guaranteed to have also received `amount` token specified by `symbol`. You can use \_getTokenAddress(symbol) to obtain the address of the ERC20 token received.

### `AxelarGasReceiver`

This contract is automatically deployed and can be used to pay gas for the destination contract execution on the source chain. Smart contracts calling `callContract` and `callContractWithToken` should also handle paying for gas. It exposes [many functions](https://github.com/axelarnetwork/axelar-cgp-solidity/blob/feat/gas-receiver/src/util/AxelarGasReceiver.sol), but the main ones are

- `receiveGas(string destinationChain, string destinationAddress, bytes payload, address gasToken, uint256 gasAmount)`: Receives `gasAmount` of `gasToken` to execute the contract call specified. The execution will use a gasLimit of `gasAmount / getGasPrice(...)` (see [above](#functionality) for `getGasPrice`).
- `receiveGasNative(string destinationChain, string destinationAddress, bytes payload)`: As above with the native token as the `gasToken` and `msg.value` as the `gasAmount`.
- `receiveGasWithToken(string destinationChain, string destinationAddress, bytes payload, string symbol, uint256 amountThrough, address gasToken, uint256 gasAmount)`, `receiveGasNtiveWithToken(string destinationChain, string destinationAddress, bytes payload, string symbol, uint256 amountThrough)`: Similar to the above functions but they are for `callContractWithToken` instead of `callContract`.
- `ReceiveGas(Native)AndCallRemote(WithToken)(...)`: There are four such functions that will also pass the call to the gateway after receiving gas, for convenience.
