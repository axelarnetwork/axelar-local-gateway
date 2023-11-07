import path from "path";
import {
  CosmosClient,
  AxelarListener,
  IBCRelayerService,
  AxelarCosmosContractCallEvent,
  AxelarIBCEvent,
} from "..";

describe("E2E - Listener", () => {
  let wasmClient: CosmosClient;
  let srcChannelId: string;
  let axelarListener: AxelarListener;
  let ibcRelayer: IBCRelayerService;
  let testMnemonic =
    "illness step primary sibling donkey body sphere pigeon inject antique head educate";

  beforeAll(async () => {
    ibcRelayer = await IBCRelayerService.create(testMnemonic);
    await ibcRelayer.setup();
    axelarListener = new AxelarListener(ibcRelayer.axelarClient.chainInfo);
    wasmClient = ibcRelayer.wasmClient;
    srcChannelId = ibcRelayer.srcChannelId || "channel-0";
  });

  afterAll((done) => {
    axelarListener?.stop();
    done();
  });

  async function executeContractCall() {
    // Upload the wasm contract
    const _path = path.resolve(__dirname, "../..", "wasm/send_receive.wasm");
    const response = await wasmClient.uploadWasm(_path);
    console.log("Uploaded wasm:", response.codeId);

    // Instantiate the contract
    const { client, address: senderAddress } =
      await wasmClient.generateRandomSigningClient();

    const { contractAddress } = await client.instantiate(
      senderAddress,
      response.codeId,
      {
        channel: srcChannelId,
      },
      "amazing random contract",
      "auto"
    );
    console.log("Deployed contract:", contractAddress);

    const denom = wasmClient.chainInfo.denom;

    const execution = await client.execute(
      senderAddress,
      contractAddress,
      {
        send_message_evm: {
          destination_chain: "ethereum",
          destination_address: "0x49324C7f83568861AB1b66E547BB1B66431f1070",
          message: "Hello",
        },
      },
      "auto",
      "test",
      [{ amount: "100000", denom }]
    )

    console.log("Executed:", execution.transactionHash);

    const heights = await ibcRelayer.relay();
    console.log("Relayed at heights:", heights);
  }

  // async function executeContractCallWithToken() {
  //   // Upload the wasm contract
  //   const _path = path.resolve(__dirname, "../..", "wasm/multi_send.wasm");
  //   const response = await wasmClient.uploadWasm(_path);
  //   console.log("Uploaded wasm:", response.codeId);

  //   // Instantiate the contract
  //   const { client } = wasmClient;
  //   const ownerAddress = await wasmClient.getOwnerAccount();
  //   const { contractAddress } = await client.instantiate(
  //     ownerAddress,
  //     response.codeId,
  //     {
  //       channel: srcChannelId,
  //     },
  //     "amazing random contract",
  //     "auto"
  //   );
  //   console.log("Deployed contract:", contractAddress);

  //   const denom = wasmClient.chainInfo.denom;

  //   const execution = await client.execute(
  //     ownerAddress,
  //     contractAddress,
  //     {
  //       multi_send_to_evm: {
  //         destination_chain: "ethereum",
  //         destination_address: "0x49324C7f83568861AB1b66E547BB1B66431f1070",
  //         recipients: ["0x49324C7f83568861AB1b66E547BB1B66431f1070"],
  //       },
  //     },
  //     "auto",
  //     "test",
  //     [{ amount: "1000000", denom }]
  //   );

  //   // console.log(JSON.stringify(execution, null, 2));

  //   // // while (true) {
  //   const packets = await relayerClient.relayPackets();
  //   // // sleep 5
  //   // // await new Promise((r) => setTimeout(r, 5000));
  //   // // }
  // }

  it("should receive ibc events from call contract", (done) => {
    (async () => {
      axelarListener.listen(AxelarIBCEvent, (args) => {
        console.log("Any event", args);
      });
      axelarListener.listen(AxelarCosmosContractCallEvent, async (args) => {
        console.log("Received ContractCall", args);
        done();
      });

      // axelarListener.listen(AxelarCosmosContractCallWithTokenEvent, (args) => {
      //   console.log("Received ContractCallWithToken:", args);
      //   done();
      // });

      try {
        await executeContractCall();
      } catch (e) {
        console.log(e);
        done();
      }
    })();
  });
});
