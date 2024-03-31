// src/app.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";
var app = fastify().withTypeProvider();
app.register(cors, {
  // put your options here
  origin: true
});
app.get("/", function(request, reply) {
  reply.send("ha-ha!");
});
app.setNotFoundHandler((request, reply) => {
  const message = `Route ${request.method}:${request.url} not found`;
  console.log(message);
  reply.code(404).send({
    message,
    error: "Not Found",
    statusCode: 404
  });
});

// src/constants.ts
import { BigNumber, TronWeb } from "tronweb";

// src/usdtAbi.ts
var USDTAbi = [{ "outputs": [{ "type": "uint256" }], "constant": true, "inputs": [{ "name": "who", "type": "address" }], "name": "balanceOf", "stateMutability": "View", "type": "Function" }, { "outputs": [{ "type": "bool" }], "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "stateMutability": "Nonpayable", "type": "Function" }];

// src/constants.ts
var tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  headers: { "TRON-PRO-API-KEY": "a40790e5-a3f3-4cbe-9362-055eaf5d594d" },
  privateKey: "01"
  // doesn't matter
});
var USDTAddressBase58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
var USDTDecimals = 6;
var USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58);
var MinEnergyOnTG = new BigNumber(56e3);
var TrxSingleTxBandwidth = new BigNumber(0.4);
var AnanasFeeUSDT = new BigNumber(0.2);

// src/routes/example.ts
app.get("/example", {}, async function(request, reply) {
  const tx = await tronWeb.trx.getTransaction("7649536d483e526264f84bf79216e9efc66e7a8345eb458911f35cbd6c0cf0b9");
  console.log(tx);
  tronWeb.trx.sendHexTransaction({
    // raw_data_hex: '',
    // signature: [''],
    // raw_data: {} as any,
  });
  reply.send("Have a cool day");
});

// src/routes/getQuote.ts
import { Type } from "@sinclair/typebox";

// src/network.ts
import { BigNumber as BigNumber2 } from "tronweb";
var latestEnergyData = {
  usdtTransferToEmptyAccout: new BigNumber2(64895),
  usdtTransferToHolder: new BigNumber2(31895),
  trxPerEnergyUnit: new BigNumber2(9e-5),
  usdtPerTrx: new BigNumber2(0.12),
  setAt: /* @__PURE__ */ new Date()
};
async function getTransferEnergyEstimate(recipient) {
  const recipientUsdtBalance = await USDTContract.methods.balanceOf(recipient).call();
  if (recipientUsdtBalance.eq(0)) {
    return latestEnergyData.usdtTransferToEmptyAccout;
  }
  return latestEnergyData.usdtTransferToHolder;
}
async function broadcastTx(decodedTx, signature) {
  const fullSendData = {
    visible: false,
    // always using hex addresses
    txID: decodedTx.txID,
    raw_data: decodedTx.rawData,
    raw_data_hex: decodedTx.rawDataHex,
    signature: [signature]
  };
  console.log("Re-computed transaction:", JSON.stringify(fullSendData));
  const result = await tronWeb.trx.sendRawTransaction(fullSendData);
  console.log("Broadcasted a transaction:", result);
}

// src/util.ts
import { ADDRESS_PREFIX, getBase58CheckAddress, hexStr2byteArray, recoverAddress } from "tronweb/utils";
async function makeUnsignedTransaction(from, to, amountHuman) {
  const functionSelector = "transfer(address,uint256)";
  const parameter = [{ type: "address", value: to }, { type: "uint256", value: 100 }];
  const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(USDTAddressBase58, functionSelector, {}, parameter);
  console.log("Transaction:", transaction);
  console.log("Serialized transaction:", JSON.stringify(transaction));
  const data = "0x" + transaction.raw_data.contract[0].parameter.value.data;
  console.log("contract:", transaction.raw_data.contract[0].parameter.value);
}
function hexToBase58Address(hexAddress) {
  return getBase58CheckAddress(hexStr2byteArray(hexAddress.replace(/^0x/, ADDRESS_PREFIX)));
}

// src/routes/getQuote.ts
var schema = {
  body: Type.Object({
    from: Type.String(),
    to: Type.String(),
    amount: Type.String()
    // amount in human-readable format
  })
};
async function calculateQuote(recipient) {
  const actualTransferEnergy = await getTransferEnergyEstimate(recipient);
  const feeTransferEnergy = latestEnergyData.usdtTransferToHolder;
  const sumEnergyNeeeded = actualTransferEnergy.plus(feeTransferEnergy);
  const trxForEnergy = sumEnergyNeeeded.multipliedBy(latestEnergyData.trxPerEnergyUnit);
  const usdtForEnergy = trxForEnergy.multipliedBy(latestEnergyData.usdtPerTrx);
  const trxForBandwidth = TrxSingleTxBandwidth.multipliedBy(2);
  const usdtForBandwidth = trxForBandwidth.multipliedBy(latestEnergyData.usdtPerTrx);
  const networkFeeUSDT = usdtForEnergy.plus(usdtForBandwidth);
  const feeWithMarkup = networkFeeUSDT.plus(AnanasFeeUSDT);
  return {
    totalTxFeeUSDT: feeWithMarkup
  };
}
app.post("/get-quote", { schema }, async function(request, reply) {
  const { from, to, amount } = request.body;
  const quote = await calculateQuote(to);
  await makeUnsignedTransaction(from, to, amount);
  reply.send({
    mainTx: {},
    feeTx: {},
    feeInUSDT: quote.totalTxFeeUSDT
  });
});

// src/routes/execute.ts
import { Type as Type2 } from "@sinclair/typebox";

// src/encoding.ts
import assert from "assert";
import protobuf from "protobufjs";
import { BigNumber as BigNumber3 } from "tronweb";
import { bytesToHex, hexToBytes, size, sliceHex } from "viem";
import { sha256 } from "js-sha256";
var root = protobuf.loadSync("src/random/transaction.proto");
var Raw = root.lookupType("Transaction.raw");
function decodeUsdtTransaction(rawDataHex) {
  const rawDataBytes = hexToBytes(rawDataHex);
  const decodedRawData = Raw.decode(rawDataBytes);
  const txID = sha256(rawDataBytes);
  const contract = decodedRawData.contract[0];
  assert(contract.type === 31);
  const contractData = bytesToHex(decodedRawData.contract[0].parameter.value);
  assert(sliceHex(contractData, 0, 2) === "0x0a15");
  let fromHexAddress = sliceHex(contractData, 2, 23);
  assert(sliceHex(contractData, 23, 25) === "0x1215");
  let contractHexAddress = sliceHex(contractData, 25, 46);
  assert(sliceHex(contractData, 46, 48) === "0x2244");
  const calldata = sliceHex(contractData, 48);
  assert(size(calldata) === 68);
  assert(sliceHex(calldata, 0, 4) === "0xa9059cbb");
  const arg0 = sliceHex(calldata, 4, 36);
  const arg1 = sliceHex(calldata, 36);
  let toHexAddress = sliceHex(arg0, 11);
  const amountUint = BigNumber3(arg1);
  const amountHuman = amountUint.dividedBy(BigNumber3(10).pow(USDTDecimals));
  fromHexAddress = fromHexAddress.slice(2);
  contractHexAddress = contractHexAddress.slice(2);
  toHexAddress = toHexAddress.slice(2);
  const fromBase58Address = hexToBase58Address(fromHexAddress);
  const contractBase58Address = hexToBase58Address(contractHexAddress);
  const toBase58Address = hexToBase58Address(toHexAddress);
  console.log("Decoded:", decodedRawData);
  console.log("Decoded timestamp:", decodedRawData.timestamp, parseInt(decodedRawData.timestamp));
  const rawDataFormatted = {
    contract: [{
      parameter: {
        value: {
          data: calldata.slice(2),
          owner_address: fromHexAddress,
          contract_address: contractHexAddress
        },
        type_url: "type.googleapis.com/protocol.TriggerSmartContract"
      },
      type: "TriggerSmartContract"
    }],
    ref_block_bytes: bytesToHex(decodedRawData.refBlockBytes).slice(2),
    ref_block_hash: bytesToHex(decodedRawData.refBlockHash).slice(2),
    expiration: parseInt(decodedRawData.expiration),
    fee_limit: parseInt(decodedRawData.feeLimit),
    timestamp: parseInt(decodedRawData.timestamp)
  };
  return {
    rawDataHex: rawDataHex.slice(2),
    rawData: rawDataFormatted,
    txID,
    fromHexAddress,
    fromBase58Address,
    contractHexAddress,
    contractBase58Address,
    toHexAddress,
    toBase58Address,
    amountUint,
    amountHuman
  };
}

// src/routes/execute.ts
var schema2 = {
  body: Type2.Object({
    mainTx: Type2.Object({ rawDataHex: Type2.String(), signature: Type2.String() }),
    feeTx: Type2.Object({ rawDataHex: Type2.String(), signature: Type2.String() })
  })
};
app.post("/execute", { schema: schema2 }, async function(request, reply) {
  const { mainTx, feeTx } = request.body;
  let decodedMainTx;
  try {
    decodedMainTx = decodeUsdtTransaction(`0x${mainTx.rawDataHex}`);
  } catch (error) {
    return reply.code(429).send({ error: "mainTx.rawDataHex structure is bad" });
  }
  await broadcastTx(decodedMainTx, mainTx.signature);
  reply.send("OK");
});

// src/index.ts
var port = Number(process.env.PORT ?? "3000");
var host = process.env.HOST ?? "0.0.0.0";
app.listen({ port, host }, function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  } else {
    console.log(`Server is now listening on port ${port}`);
  }
});
