import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { DecodedUsdtTx, decodeUsdtTransaction } from '../encoding';
import { broadcastTx, calculateQuote, getUsdtBalance, sendTrx } from '../network';
import { AnanasFeeCollector, globalPino } from '../constants';
import { buyEnergy } from '../energy';

const schema = {
    body: Type.Object({
        mainTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
        feeTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
    }),
}

app.post('/execute', { schema }, async function (request, reply) {
    const pino = globalPino.child({ requestId: crypto.randomUUID() })
    pino.info({
        msg: "Got a new request!",
        url: request.url,
        requestBody: request.body
    })
    const { mainTx, feeTx } = request.body

    let decodedMainTx: DecodedUsdtTx
    try {
        decodedMainTx = decodeUsdtTransaction({ rawDataHex: `0x${mainTx.rawDataHex}`, signature: mainTx.signature })
    } catch (error: any) {
        return reply.code(429).send({ success: false, error: "mainTx.rawDataHex structure is bad" })
    }
    pino.info({
        msg: "Decoded mainTx",
        decodedMainTx,
    })

    let decodedFeeTx: DecodedUsdtTx
    try {
        decodedFeeTx = decodeUsdtTransaction({ rawDataHex: `0x${feeTx.rawDataHex}`, signature: feeTx.signature })
    } catch (error: any) {
        return reply.code(429).send({ success: false, error: "feeTx.rawDataHex structure is bad" })
    }
    pino.info({
        msg: "Decoded feeTx",
        decodedFeeTx,
    })

    const senderBase58Address = decodedMainTx.fromBase58Address
    if (decodedFeeTx.fromBase58Address !== senderBase58Address) {
        return reply.code(429).send({ success: false, error: "mainTx and feeTx must be sent from the same address" })
    }

    if (decodedMainTx.signerBase58Address !== senderBase58Address || decodedFeeTx.signerBase58Address !== senderBase58Address) {
        return reply.code(429).send({ success: false, error: `Either mainTx or feeTx was signed incorrectly. The signed has to be the person from whom USDT is being sent, which is ${senderBase58Address}` })
    }

    const userBalance = await getUsdtBalance(senderBase58Address, pino)
    const userWantsToSend = decodedMainTx.amountHuman.plus(decodedFeeTx.amountHuman)
    if (userBalance < userWantsToSend) {
        return reply.code(429).send({ success: false, error: `The user needs to have at least ${userWantsToSend} USDT, but they only have ${userBalance}` })
    }

    const {
        totalFeeUSDT,
        energyToBuy,
        sunToSpendForEnergy,
        trxNeeded,
        rawTGQuote,
    } = await calculateQuote(senderBase58Address, pino)

    if (decodedFeeTx.amountHuman < totalFeeUSDT) {
        return reply.code(429).send({ success: false, error: `The fee must be at least ${totalFeeUSDT}, but feeTx transfers only ${decodedFeeTx.amountHuman} USDT` })
    }

    if (decodedFeeTx.toBase58Address !== AnanasFeeCollector) {
        return reply.code(429).send({ success: false, error: `the recipient in the feeTx must be ${AnanasFeeCollector}, but it was ${decodedFeeTx.toBase58Address}` })
    }

    pino.info({ msg: "Data submitted by the user is valid! Executing the transfer now!" })

    // Fund the account with the resources. It's important to send TRX first because
    // if the account is not activated, we need to pay a 1 TRX activation fee.
    await sendTrx(trxNeeded, senderBase58Address, pino)
    await buyEnergy(energyToBuy, sunToSpendForEnergy, senderBase58Address, rawTGQuote, pino)

    // Execute the transactions
    await broadcastTx(decodedFeeTx, feeTx.signature, pino)
    pino.info({ msg: "Successfully executed the fee transaction!" })

    await broadcastTx(decodedMainTx, mainTx.signature, pino)
    pino.info({ msg: "Successfully executed the actual transfer transaction!" })

    reply.code(200).send({
        success: true,
        mainTxID: decodedMainTx.txID
    })
})