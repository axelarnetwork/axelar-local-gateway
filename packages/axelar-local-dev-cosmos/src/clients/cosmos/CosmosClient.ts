import fs from "fs";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice } from "@cosmjs/stargate";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { CosmosChain, CosmosChainInfo } from "../../types";
import { getOwnerAccount } from "../../docker";
import { readFileSync } from "../../utils";

export class CosmosClient {
  public chainInfo: Required<CosmosChainInfo>;
  public owner: DirectSecp256k1HdWallet;
  public client: SigningCosmWasmClient;
  public gasPrice: GasPrice;

  private constructor(
    chainInfo: Required<CosmosChainInfo>,
    owner: DirectSecp256k1HdWallet,
    client: SigningCosmWasmClient
  ) {
    this.chainInfo = chainInfo;
    this.owner = owner;
    this.client = client;
    this.gasPrice = GasPrice.fromString(`1${chainInfo.denom}`);
  }

  static async create(
    chain: CosmosChain = "wasm",
    config: Omit<CosmosChainInfo, "owner"> = { prefix: chain }
  ) {
    const defaultDenom = chain === "wasm" ? "uwasm" : "uaxl";
    const chainInfo = {
      denom: config.denom || defaultDenom,
      lcdUrl: config.lcdUrl || `http://localhost/${chain}-lcd`,
      rpcUrl: config.rpcUrl || `http://localhost/${chain}-rpc`,
      wsUrl: config.wsUrl || `ws://localhost/${chain}-rpc/websocket`,
    };

    const walletOptions = {
      prefix: chain,
    };

    const { address, mnemonic } = await getOwnerAccount(chain);

    const owner = await DirectSecp256k1HdWallet.fromMnemonic(
      mnemonic,
      walletOptions
    );

    const client = await SigningCosmWasmClient.connectWithSigner(
      chainInfo.rpcUrl,
      owner,
      { gasPrice: GasPrice.fromString(`1${chainInfo.denom}`) }
    );

    return new CosmosClient(
      {
        ...chainInfo,
        owner: {
          mnemonic,
          address,
        },
        prefix: chain,
      },
      owner,
      client
    );
  }

  getBalance(address: string, denom?: string) {
    return this.client
      .getBalance(address, denom || this.chainInfo.denom)
      .then((res) => res.amount);
  }

  getChainInfo(): Omit<CosmosChainInfo, "owner"> {
    return {
      prefix: this.chainInfo.prefix,
      denom: this.chainInfo.denom,
      lcdUrl: this.chainInfo.lcdUrl,
      rpcUrl: this.chainInfo.rpcUrl,
      wsUrl: this.chainInfo.wsUrl,
    };
  }

  async fundWallet(address: string, amount: string) {
    const ownerAddress = await this.getOwnerAccount();

    // TODO: Handle when owner account doesn't have enough balance
    return this.client
      .sendTokens(
        ownerAddress,
        address,
        [
          {
            amount,
            denom: this.chainInfo.denom,
          },
        ],
        1.8
      )
      .then((res) => {
        if (res.code !== 0) {
          throw new Error(res.rawLog || "Failed to fund wallet");
        }
        return res;
      });
  }

  async uploadWasm(path: string) {
    const wasm = readFileSync(path);

    return this.client.upload(
      this.getOwnerAccount(),
      new Uint8Array(wasm),
      1.8
    );
  }

  getOwnerAccount() {
    return this.chainInfo.owner.address;
  }

  async generateRandomSigningClient(
    chain: CosmosChain = "wasm",
    amount: string = "10000000"
  ) {
    const wallet = await DirectSecp256k1HdWallet.generate(12, {
      prefix: chain,
    });
    const account = await wallet.getAccounts().then((accounts) => accounts[0]);

    await this.fundWallet(account.address, amount);

    const client = await SigningCosmWasmClient.connectWithSigner(
      this.chainInfo.rpcUrl,
      wallet,
      {
        gasPrice: this.gasPrice,
      }
    );

    return {
      client,
      address: account.address,
    };
  }
}
