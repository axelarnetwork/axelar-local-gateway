'use strict';

import { ethers } from 'ethers';
import { setJSON } from './utils';
import { Network, NetworkOptions } from './Network';
import { RelayData, evmRelayer, aptosRelayer, relay } from './relay';
import { createNetwork, forkNetwork, listen, stopAll } from './networkUtils';
import { testnetInfo, mainnetInfo } from './info';

let interval: any;

export interface CreateLocalOptions {
    chainOutputPath?: string;
    accountsToFund?: string[];
    fundAmount?: string;
    chains?: string[];
    relayInterval?: number;
    port?: number;
    ws?: boolean;
    afterRelay?: (relayData: RelayData) => void;
    callback?: (network: Network, info: any) => Promise<void>;
}

export interface CloneLocalOptions {
    chainOutputPath?: string;
    accountsToFund?: string[];
    fundAmount?: string;
    env?: string | any;
    chains?: string[];
    relayInterval?: number;
    port?: number;
    networkOptions?: NetworkOptions;
    afterRelay?: (relayData: RelayData) => void;
    callback?: (network: Network, info: any) => Promise<null>;
}

let relaying = false;
export async function createAndExport(options: CreateLocalOptions = {}) {
    const defaultOptions = {
        chainOutputPath: './local.json',
        accountsToFund: [],
        fundAmount: ethers.utils.parseEther('100').toString(),
        chains: ['Moonbeam', 'Avalanche', 'Fantom', 'Ethereum', 'Polygon'],
        port: 8500,
        relayInterval: 2000,
    };
    const _options = { ...defaultOptions, ...options };
    const localChains: Record<string, any>[] = [];

    for (let i = 0; i < _options.chains.length; i++) {
        const wsPort = _options.port + i;
        const ganacheOptions = {
            server: _options.ws && {
                ws: true,
                port: wsPort,
            },
        };
        const name = _options.chains[i];
        const chain = await createNetwork({
            name: name,
            seed: name,
            ganacheOptions,
        });
        const testnet = testnetInfo.find((info: any) => {
            return info.name === name;
        });
        const rpc = _options.ws ? `http://localhost:${wsPort}` : `http://localhost:${_options.port}/${i}`;
        const info = {
            ...chain.getCloneInfo(),
            rpc,
            ws: _options.ws && `ws://localhost:${wsPort}`,
            tokenName: testnet?.tokenName,
            tokenSymbol: testnet?.tokenSymbol,
        };
        localChains.push(info);

        const [user] = chain.userWallets;
        for (const account of _options.accountsToFund) {
            await user
                .sendTransaction({
                    to: account,
                    value: _options.fundAmount,
                })
                .then((tx) => tx.wait());
        }
        if (_options.callback) await _options.callback(chain, info);
    }
    if (!_options.ws) {
        listen(_options.port);
    }
    interval = setInterval(async () => {
        if (relaying) return;
        relaying = true;
        await relay().catch(() => undefined);
        if (_options.afterRelay) {
            _options.afterRelay(evmRelayer.relayData);
            _options.afterRelay(aptosRelayer.relayData);
        }
        relaying = false;
    }, _options.relayInterval);

    setJSON(localChains, _options.chainOutputPath);
}

export async function forkAndExport(options: CloneLocalOptions = {}) {
    const defaultOptions = {
        chainOutputPath: './local.json',
        accountsToFund: [],
        fundAmount: ethers.utils.parseEther('100').toString(),
        env: 'mainnet',
        chains: [],
        port: 8500,
        relayInterval: 2000,
        networkOptions: {},
    } as CloneLocalOptions;
    for (const option in defaultOptions) (options as any)[option] = (options as any)[option] || (defaultOptions as any)[option];
    const chains_local: Record<string, any>[] = [];
    if (options.env != 'mainnet' && options.env != 'testnet') {
        console.log(`Forking ${options.env.length} chains from custom data.`);
    }
    const chainsRaw = options.env == 'mainnet' ? mainnetInfo : options.env == 'testnet' ? testnetInfo : options.env;

    const chains =
        options.chains?.length == 0
            ? chainsRaw
            : chainsRaw.filter(
                  (chain: any) => options.chains?.find((name) => name.toLocaleLowerCase() == chain.name.toLocaleLowerCase()) != null
              );

    let i = 0;
    for (const chain of chains) {
        const network = await forkNetwork(chain, options.networkOptions);

        const info = network.getCloneInfo() as any;
        info.rpc = `http://localhost:${options.port}/${i}`;
        (info.tokenName = chain?.tokenName), (info.tokenSymbol = chain?.tokenSymbol), chains_local.push(info);
        const [user] = network.userWallets;
        for (const account of options.accountsToFund!) {
            await user
                .sendTransaction({
                    to: account,
                    value: options.fundAmount,
                })
                .then((tx) => tx.wait());
        }
        if (options.callback) await options.callback!(network, info);
        i++;
    }
    listen(options.port!);
    interval = setInterval(async () => {
        await evmRelayer.relay();
        if (options.afterRelay) options.afterRelay(evmRelayer.relayData);
    }, options.relayInterval);
    setJSON(chains_local, options.chainOutputPath!);
}

export async function destroyExported() {
    stopAll();
    if (interval) {
        clearInterval(interval);
    }
    evmRelayer.contractCallGasEvents.length = 0;
    evmRelayer.contractCallWithTokenGasEvents.length = 0;
    aptosRelayer.contractCallGasEvents.length = 0;
}
