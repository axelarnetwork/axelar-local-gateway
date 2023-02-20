/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

import { createNetwork, relay, stopAll, listen, getFee, getDepositAddress, deployContract, setLogger } from '../';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { Contract, Wallet } from 'ethers';
import { Network } from '../Network';
import chai from 'chai';
const { expect } = chai;

setLogger(() => null);
jest.setTimeout(300000);

interface NetworkUsdc extends Network {
    usdc?: Contract;
}

describe('relay', () => {
    let chain1: NetworkUsdc, chain2: NetworkUsdc;
    let user1: Wallet, user2: Wallet;
    beforeEach(async () => {
        chain1 = await createNetwork({ seed: '1' });
        [user1] = chain1.userWallets;
        chain1.usdc = await chain1.deployToken('Axelar Wrapped USDC', 'aUSDC', 6, BigInt(1e18)).then((c: any) => c.connect(user1));
        chain2 = await createNetwork({ seed: '2' });
        [user2] = chain2.userWallets;
        chain2.usdc = await chain2.deployToken('Axelar Wrapped USDC', 'aUSDC', 6, BigInt(1e18)).then((c: any) => c.connect(user2));
    });
    afterEach(async () => {
        stopAll();
    });
    describe('deposit address', () => {
        it('should generate a deposit address', async () => {
            const depositAddress = await getDepositAddress(chain1, chain2, user2.address, 'aUSDC');
            const amount = 12423532412;
            const fee = getFee();
            await chain1.giveToken(user1.address, 'aUSDC', BigInt(amount));
            await chain1.usdc?.transfer(depositAddress, amount).then((tx: any) => tx.wait());
            await relay();

            const balance = await chain2.usdc?.balanceOf(user2.address).then((b: any) => b.toNumber());
            expect(balance).to.equal(amount - fee);
        });

        it('should generate a deposit address to use twice', async () => {
            const depositAddress = getDepositAddress(chain1, chain2, user2.address, 'aUSDC');
            const amount1 = BigInt(12423532412);
            const amount2 = BigInt(5489763092348);
            const fee = BigInt(getFee());
            await chain1.giveToken(user1.address, 'aUSDC', amount1);
            await chain1.usdc?.transfer(depositAddress, amount1).then((tx: any) => tx.wait());
            await relay();
            expect(BigInt(await chain2.usdc?.balanceOf(user2.address))).to.equal(amount1 - fee);

            await chain1.giveToken(user1.address, 'aUSDC', amount2);
            await chain1.usdc?.transfer(depositAddress, amount2).then((tx: any) => tx.wait());
            await relay();
            expect(BigInt(await chain2.usdc?.balanceOf(user2.address))).to.equal(amount1 - fee + amount2 - fee);
        });

        it('should generate a deposit address remotely', async () => {
            const port = 8501;
            await listen(port);
            const depositAddress = await getDepositAddress(chain1, chain2, user2.address, 'aUSDC', port);
            const amount = BigInt(12423532412);
            const fee = BigInt(getFee());
            await chain1.giveToken(user1.address, 'aUSDC', amount);
            await chain1.usdc?.transfer(depositAddress, amount).then((tx: any) => tx.wait());
            await relay();
            expect(BigInt(await chain2.usdc?.balanceOf(user2.address))).to.equal(amount - fee);
        });
    });

    describe('send token', () => {
        it('should send some usdc over', async () => {
            const amount = BigInt(1e8);
            const fee = BigInt(getFee());
            await chain1.giveToken(user1.address, 'aUSDC', amount);
            await chain1.usdc?.approve(chain1.gateway.address, amount).then((tx: any) => tx.wait());
            await chain1.gateway
                .connect(user1)
                .sendToken(chain2.name, user2.address, 'aUSDC', amount)
                .then((tx: any) => tx.wait());
            await relay();
            expect(BigInt(await chain2.usdc?.balanceOf(user2.address))).to.equal(amount - fee);
        });
    });

    describe('call contract', () => {
        let ex1: Contract, ex2: Contract;
        const Executable = require('../artifacts/src/contracts/test/Executable.sol/Executable.json');

        const message = 'hello there executables!';
        const payload = defaultAbiCoder.encode(['string'], [message]);
        beforeEach(async () => {
            ex1 = await deployContract(user1, Executable, [chain1.gateway.address, chain1.gasService.address]);
            ex2 = await deployContract(user2, Executable, [chain2.gateway.address, chain1.gasService.address]);

            await await ex1.connect(user1).addSibling(chain2.name, ex2.address);
            await await ex2.connect(user2).addSibling(chain1.name, ex1.address);
        });
        it('should call a contract manually and fulfill the call', async () => {
            await chain1.gateway
                .connect(user1)
                .callContract(chain2.name, ex2.address, payload)
                .then((tx: any) => tx.wait());
            await relay();
            const filter = chain2.gateway.filters.ContractCallApproved();
            const args = (await chain2.gateway.queryFilter(filter))[0].args;
            await (await ex2.connect(user2).execute(args?.commandId, chain1.name, user1.address, payload)).wait();

            expect(await ex1.value()).to.equal('');
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(user1.address);
        });
        it('should pay for gas and call a contract manually', async () => {
            await chain1.gasService
                .connect(user1)
                .payNativeGasForContractCall(user1.address, chain2.name, ex2.address, payload, user1.address, { value: 1e6 })
                .then((tx: any) => tx.wait());
            await chain1.gateway
                .connect(user1)
                .callContract(chain2.name, ex2.address, payload)
                .then((tx: any) => tx.wait());
            await relay();

            expect(await ex1.value()).to.equal('');
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(user1.address);
        });
        it('should call a contract through the sibling and fulfill the call', async () => {
            await (await ex1.connect(user1).set(chain2.name, message)).wait();
            await relay();
            const filter = chain2.gateway.filters.ContractCallApproved();
            const args = (await chain2.gateway.queryFilter(filter))[0].args;
            await (await ex2.connect(user2).execute(args?.commandId, chain1.name, ex1.address, payload)).wait();

            expect(await ex1.value()).to.equal(message);
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(ex1.address);
        });
        it('should have the sibling pay for gas and make the call', async () => {
            await (await ex1.connect(user1).set(chain2.name, message, { value: BigInt(1e18) })).wait();
            await relay();

            expect(await ex1.value()).to.equal(message);
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(ex1.address);
        });
    });

    describe('call contract with token', () => {
        let ex1: Contract, ex2: Contract;
        let payload: string;
        const Executable = require('../artifacts/src/contracts/test/ExecutableWithToken.sol/ExecutableWithToken.json');

        const message = 'hello there executables!';
        const amount = 1234255675;

        beforeEach(async () => {
            payload = defaultAbiCoder.encode(['string', 'address'], [message, user2.address]);
            ex1 = await deployContract(user1, Executable, [chain1.gateway.address, chain1.gasService.address]);
            ex2 = await deployContract(user2, Executable, [chain2.gateway.address, chain1.gasService.address]);

            await ex1
                .connect(user1)
                .addSibling(chain2.name, ex2.address)
                .then((tx: any) => tx.wait());
            await ex2
                .connect(user2)
                .addSibling(chain1.name, ex1.address)
                .then((tx: any) => tx.wait());

            await chain1.giveToken(user1.address, 'aUSDC', BigInt(amount));
        });
        it('should call a contract manually and fulfill the call', async () => {
            await chain1.usdc?.approve(chain1.gateway.address, amount).then((tx: any) => tx.wait());
            await (await chain1.gateway.connect(user1).callContractWithToken(chain2.name, ex2.address, payload, 'aUSDC', amount)).wait();
            await relay();
            const filter = chain2.gateway.filters.ContractCallApprovedWithMint();
            const args = (await chain2.gateway.queryFilter(filter))[0].args;
            await (await ex2.connect(user2).executeWithToken(args?.commandId, chain1.name, user1.address, payload, 'aUSDC', amount)).wait();

            expect(await ex1.value()).to.equal('');
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(user1.address);
            expect((await chain2.usdc?.balanceOf(user2.address))?.toNumber()).to.equal(amount);
        });
        it('should pay for gas and call a contract manually', async () => {
            await await chain1.gasService
                .connect(user1)
                .payNativeGasForContractCallWithToken(user1.address, chain2.name, ex2.address, payload, 'aUSDC', amount, user1.address, {
                    value: 1e6,
                });

            await chain1.usdc?.approve(chain1.gateway.address, amount).then((tx: any) => tx.wait());
            await (await chain1.gateway.connect(user1).callContractWithToken(chain2.name, ex2.address, payload, 'aUSDC', amount)).wait();
            await relay();

            expect(await ex1.value()).to.equal('');
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(user1.address);
            expect((await chain2.usdc?.balanceOf(user2.address))?.toNumber()).to.equal(amount);
        });
        it('should call a contract through the sibling and fulfill the call', async () => {
            await chain1.usdc?.approve(ex1.address, amount).then((tx: any) => tx.wait());
            await ex1
                .connect(user1)
                .setAndSend(chain2.name, message, user2.address, 'aUSDC', amount)
                .then((tx: any) => tx.wait());
            await relay();
            const filter = chain2.gateway.filters.ContractCallApprovedWithMint();
            const args = (await chain2.gateway.queryFilter(filter))[0].args;
            await (await ex2.connect(user2).executeWithToken(args?.commandId, chain1.name, ex1.address, payload, 'aUSDC', amount)).wait();

            expect(await ex1.value()).to.equal(message);
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(ex1.address);
            expect((await chain2.usdc?.balanceOf(user2.address))?.toNumber()).to.equal(amount);
        });
        it('should have the sibling pay for gas and make the call', async () => {
            await chain1.usdc?.approve(ex1.address, amount).then((tx: any) => tx.wait());
            await (
                await ex1.connect(user1).setAndSend(chain2.name, message, user2.address, 'aUSDC', amount, {
                    value: 1e6,
                })
            ).wait();
            await relay();

            expect(await ex1.value()).to.equal(message);
            expect(await ex2.value()).to.equal(message);
            expect(await ex2.sourceChain()).to.equal(chain1.name);
            expect(await ex2.sourceAddress()).to.equal(ex1.address);
            expect((await chain2.usdc?.balanceOf(user2.address))?.toNumber()).to.equal(amount);
        });
    });
});
