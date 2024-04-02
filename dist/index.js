// src/app.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";

// src/constants.ts
import { BigNumber, TronWeb } from "tronweb";

// src/usdtAbi.ts
var USDTAbi = [
  { "outputs": [{ "type": "uint256" }], "constant": true, "inputs": [{ "name": "who", "type": "address" }], "name": "balanceOf", "stateMutability": "View", "type": "Function" },
  { "outputs": [{ "type": "bool" }], "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "stateMutability": "Nonpayable", "type": "Function" }
];

// src/constants.ts
import PinoConstrucor from "pino";
var tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  headers: { "TRON-PRO-API-KEY": "a40790e5-a3f3-4cbe-9362-055eaf5d594d" },
  // MUST have TRX to buy energy 
  privateKey: "be5baf1bc2fb3a5f0a1dfa2194c5925e9313b350c6426846952543bbc40f94e1"
});
var USDTAddressBase58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
var USDTDecimals = 6;
var USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58);
var TRXDecimals = 6;
var UsdtToEmptyAccoutEnergy = 64895;
var UsdtToHolderEnergy = 31895;
var UsdtPerTrx = BigNumber(0.12);
var TrxSingleTxBandwidth = new BigNumber(0.4);
var AnanasFeeUSDT = new BigNumber(0.2);
var AnanasFeeCollector = "TQyMmeSrADWyxZsV6YvVu6XDV8hdq72ykb";
var globalPino = PinoConstrucor({
  level: "debug"
});

// src/app.ts
var app = fastify().withTypeProvider();
app.register(cors, {
  // put your options here
  origin: true
});
app.get("/", function(request, reply) {
  reply.send("ha-ha!");
});
app.setErrorHandler(function(error, request, reply) {
  globalPino.error({ msg: "Got an error!", errorName: error.name, errorMessage: error.message, errorStack: error.stack });
  return reply.code(500).send({ error: "Internal Server Error. Contact the developer immediately!" });
});
app.setNotFoundHandler((request, reply) => {
  const message = `Route ${request.method}:${request.url} not found`;
  reply.code(404).send({
    message,
    error: "Not Found",
    statusCode: 404
  });
});

// src/routes/example.ts
app.get("/example", {}, async function(request, reply) {
  reply.send("Have a cool day");
});

// src/routes/getQuote.ts
import { Type } from "@sinclair/typebox";

// src/network.ts
import { BigNumber as BigNumber3 } from "tronweb";

// src/util.ts
import { ADDRESS_PREFIX, getBase58CheckAddress, hexStr2byteArray, recoverAddress } from "tronweb/utils";
import { BigNumber as BigNumber2 } from "tronweb";
function humanToUint(amountHuman, decimals) {
  return amountHuman.multipliedBy(BigNumber2(10).pow(decimals)).decimalPlaces(0).toNumber();
}
function uintToHuman(amountUint, decimals) {
  return BigNumber2(amountUint).dividedBy(BigNumber2(10).pow(decimals)).decimalPlaces(decimals);
}
function hexToBase58Address(hexAddress) {
  return getBase58CheckAddress(hexStr2byteArray(hexAddress.replace(/^0x/, ADDRESS_PREFIX)));
}
function recoverSigner(txID, signature) {
  const signerHexAddress = recoverAddress("0x" + txID, "0x" + signature);
  const signerBase58Address = hexToBase58Address(signerHexAddress);
  return {
    signerHexAddress,
    signerBase58Address
  };
}

// src/energy.ts
var TGApiUrl = "https://www.tokengoodies.com/tronresourceexchange/exchange";
var TGApiKey = "88387866ae3847158f575b7b920e7bb2";
async function getTGEnergyQuote() {
  const response = await fetch(TGApiUrl, {
    method: "POST",
    body: JSON.stringify({
      type: "api_get_create_order_values",
      action: "utils"
    }),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Origin: "https://www.tokengoodies.com"
    }
  });
  const orderOptions = await response.json();
  const tgFeeAddress = orderOptions.order_fees_address;
  const minRentalDuration = orderOptions.rental_durations[0];
  const basePriceInSun = orderOptions.min_energy_price_in_sun;
  const priceInSun = Math.ceil(basePriceInSun * minRentalDuration.multiplier);
  const priceInTrx = uintToHuman(priceInSun, TRXDecimals);
  const minOrderAmountInSun = orderOptions.min_order_amount_in_sun;
  const minEnergy = Math.ceil(minOrderAmountInSun / priceInSun);
  return {
    minRentalDuration,
    tgFeeAddress,
    basePriceInSun,
    priceInSun,
    priceInTrx,
    minOrderAmountInSun,
    minEnergy
  };
}
async function buyEnergy(energyAmount, sunToSpend, to, rawTGQuote, pino) {
  const trxPaymentTx = await tronWeb.transactionBuilder.sendTrx(rawTGQuote.tgFeeAddress, sunToSpend);
  const signedPaymentTx = await tronWeb.trx.sign(trxPaymentTx);
  const requestBody = {
    type: "order",
    action: "create",
    resourceid: 1,
    // 1 - energy, 0 - bandwidth
    order: {
      freezeto: to,
      amount: energyAmount,
      freezeperiod: 3,
      // legacy argument. Always 3.
      freezeperiodinblocks: rawTGQuote.minRentalDuration.blocks,
      priceinsun: rawTGQuote.priceInSun,
      priceinsunabsolute: rawTGQuote.basePriceInSun
    },
    signedtxn: JSON.stringify(signedPaymentTx),
    api_key: TGApiKey
  };
  pino.info({
    msg: "Making a buy order on tokengoodies!",
    data: requestBody
  });
  const response = await fetch(TGApiUrl, {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
  const data = await response.json();
  pino.info({
    msg: "Got a response from tokengoodies for the buy order",
    response: data
  });
  if (!data.success) {
    pino.info({ msg: "Failed to buy energy on tokengoodies :(" });
    throw new Error(`Failed to buy energy on tokengoodies! Message from TG: ${data.message}`);
  }
  pino.info({ msg: `Successfully bought ${energyAmount} energy to ${to}!` });
}

// src/network.ts
async function calculateQuote(recipient, pino) {
  const tgQuote = await getTGEnergyQuote();
  let mainTransferEnergy;
  const recipientUsdtBalance = await getUsdtBalance(recipient, pino);
  if (recipientUsdtBalance.eq(0)) {
    mainTransferEnergy = UsdtToEmptyAccoutEnergy;
  } else {
    mainTransferEnergy = UsdtToHolderEnergy;
  }
  const feeTransferEnergy = UsdtToHolderEnergy;
  const sumEnergyNeeded = mainTransferEnergy + feeTransferEnergy;
  const energyToBuy = Math.max(sumEnergyNeeded, tgQuote.minEnergy);
  const trxForEnergy = BigNumber3(energyToBuy).multipliedBy(tgQuote.priceInTrx);
  const sunToSpendForEnergy = humanToUint(trxForEnergy, USDTDecimals);
  const usdtForEnergy = trxForEnergy.multipliedBy(UsdtPerTrx);
  const trxForBandwidth = TrxSingleTxBandwidth.multipliedBy(2);
  const usdtForBandwidth = trxForBandwidth.multipliedBy(UsdtPerTrx);
  const networkFeeUSDT = usdtForEnergy.plus(usdtForBandwidth);
  const feeWithMarkup = networkFeeUSDT.plus(AnanasFeeUSDT);
  const quote = {
    totalFeeUSDT: feeWithMarkup,
    energyToBuy,
    sunToSpendForEnergy,
    trxNeeded: trxForBandwidth,
    rawTGQuote: tgQuote
  };
  pino.info({
    msg: "Calculated a quote!",
    quote,
    quoteDetails: {
      mainTransferEnergy,
      feeTransferEnergy,
      trxForEnergy,
      usdtForEnergy,
      trxForBandwidth,
      usdtForBandwidth,
      networkFeeUSDT,
      feeWithMarkup,
      sumEnergyNeeded
    }
  });
  return quote;
}
async function getUsdtBalance(address, pino) {
  let balanceUint = await USDTContract.methods.balanceOf(address).call();
  balanceUint = BigNumber3(balanceUint.toString());
  const balanceHuman = balanceUint.dividedBy(BigNumber3(10).pow(USDTDecimals));
  pino.info({
    msg: "Fetched user's USDT balance",
    user: address,
    balance: balanceHuman.toString()
  });
  return balanceHuman;
}
async function broadcastTx(decodedTx, signature, pino) {
  const fullSendData = {
    visible: false,
    // false = hex (not base58) addresses are used
    txID: decodedTx.txID,
    raw_data: decodedTx.rawData,
    raw_data_hex: decodedTx.rawDataHex,
    signature: [signature]
  };
  pino.info({
    msg: "Broadcasting transaction!",
    fullSendData
  });
  const result = await tronWeb.trx.sendRawTransaction(fullSendData);
  if (!result.result) {
    pino.error({
      msg: "Could not send the transaction!!"
    });
    throw new Error("Could not send the transaction!");
  }
}
async function sendTrx(amountHuman, to, pino) {
  const amountUint = humanToUint(amountHuman, TRXDecimals);
  await tronWeb.trx.sendTrx(to, amountUint);
  pino.info({ msg: `Sent ${amountHuman} TRX to ${to}` });
}

// src/routes/getQuote.ts
var schema = {
  body: Type.Object({
    to: Type.String(),
    from: Type.String(),
    // unused, but is here for convenience
    amount: Type.String()
    // unused, but is here for convenience
  })
};
app.post("/get-quote", { schema }, async function(request, reply) {
  const pino = globalPino.child({ requestId: crypto.randomUUID() });
  pino.info({
    msg: "Got a new request!",
    url: request.url,
    requestBody: request.body
  });
  const { to } = request.body;
  const quote = await calculateQuote(to, pino);
  reply.send({
    feeInUSDT: quote.totalFeeUSDT
  });
});

// src/routes/execute.ts
import { Type as Type2 } from "@sinclair/typebox";

// src/encoding.ts
import assert from "assert";
import protobuf from "protobufjs";
import { BigNumber as BigNumber4 } from "tronweb";
import { bytesToHex, hexToBytes, size, sliceHex } from "viem";
import { sha256 } from "js-sha256";
var root = protobuf.loadSync("src/transaction.proto");
var Raw = root.lookupType("Transaction.raw");
function decodeUsdtTransaction({ rawDataHex, signature }) {
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
  const amountUint = BigNumber4(arg1);
  const amountHuman = amountUint.dividedBy(BigNumber4(10).pow(USDTDecimals));
  fromHexAddress = fromHexAddress.slice(2);
  contractHexAddress = contractHexAddress.slice(2);
  toHexAddress = toHexAddress.slice(2);
  const fromBase58Address = hexToBase58Address(fromHexAddress);
  const contractBase58Address = hexToBase58Address(contractHexAddress);
  const toBase58Address = hexToBase58Address(toHexAddress);
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
  const { signerHexAddress, signerBase58Address } = recoverSigner(txID, signature);
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
    amountHuman,
    signerHexAddress,
    signerBase58Address
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
  const pino = globalPino.child({ requestId: crypto.randomUUID() });
  pino.info({
    msg: "Got a new request!",
    url: request.url,
    requestBody: request.body
  });
  const { mainTx, feeTx } = request.body;
  let decodedMainTx;
  try {
    decodedMainTx = decodeUsdtTransaction({ rawDataHex: `0x${mainTx.rawDataHex}`, signature: mainTx.signature });
  } catch (error) {
    return reply.code(429).send({ error: "mainTx.rawDataHex structure is bad" });
  }
  let decodedFeeTx;
  try {
    decodedFeeTx = decodeUsdtTransaction({ rawDataHex: `0x${feeTx.rawDataHex}`, signature: feeTx.signature });
  } catch (error) {
    return reply.code(429).send({ error: "feeTx.rawDataHex structure is bad" });
  }
  const senderBase58Address = decodedMainTx.fromBase58Address;
  if (decodedFeeTx.fromBase58Address !== senderBase58Address) {
    return reply.code(429).send({ error: "mainTx and feeTx must be sent from the same address" });
  }
  if (decodedMainTx.signerBase58Address !== senderBase58Address || decodedFeeTx.signerBase58Address !== senderBase58Address) {
    return reply.code(429).send({ error: `Either mainTx or feeTx was signed incorrectly. The signed has to be the person from whom USDT is being sent, which is ${senderBase58Address}` });
  }
  const userBalance = await getUsdtBalance(senderBase58Address, pino);
  const userWantsToSend = decodedMainTx.amountHuman.plus(decodedFeeTx.amountHuman);
  if (userBalance < userWantsToSend) {
    return reply.code(429).send({ error: `The user needs to have at least ${userWantsToSend} USDT, but they only have ${userBalance}` });
  }
  const {
    totalFeeUSDT,
    energyToBuy,
    sunToSpendForEnergy,
    trxNeeded,
    rawTGQuote
  } = await calculateQuote(senderBase58Address, pino);
  if (decodedFeeTx.amountHuman < totalFeeUSDT) {
    return reply.code(429).send({ error: `The fee must be at least ${totalFeeUSDT}, but feeTx transfers only ${decodedFeeTx.amountHuman} USDT` });
  }
  if (decodedFeeTx.toBase58Address !== AnanasFeeCollector) {
    return reply.code(429).send({ error: `the recipient in the feeTx must be ${AnanasFeeCollector}, but it was ${decodedFeeTx.toBase58Address}` });
  }
  pino.info({ msg: "Data submitted by the user is valid! Executing the transfer now!" });
  reply.code(200).send({
    mainTxID: decodedMainTx.txID
  });
  await buyEnergy(energyToBuy, sunToSpendForEnergy, senderBase58Address, rawTGQuote, pino);
  await sendTrx(trxNeeded, senderBase58Address, pino);
  await broadcastTx(decodedFeeTx, feeTx.signature, pino);
  pino.info({ msg: "Successfully executed the fee transaction!" });
  await broadcastTx(decodedMainTx, mainTx.signature, pino);
  pino.info({ msg: "Successfully executed the actual transfer transaction!" });
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
