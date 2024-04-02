import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { DecodedUsdtTx, decodeUsdtTransaction } from '../encoding';
import { broadcastTx, calculateQuote, getUsdtBalance, sendTrx } from '../network';
import { AnanasFeeCollector } from '../constants';
import { buyEnergy } from '../energy';

const schema = {
    body: Type.Object({
        mainTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
        feeTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
    }),
}

app.post('/execute', { schema }, async function (request, reply) {
    const { mainTx, feeTx } = request.body

    let decodedMainTx: DecodedUsdtTx
    try {
        decodedMainTx = decodeUsdtTransaction({ rawDataHex: `0x${mainTx.rawDataHex}`, signature: mainTx.signature })
    } catch (error: any) {
        return reply.code(429).send({ error: "mainTx.rawDataHex structure is bad" })
    }

    let decodedFeeTx: DecodedUsdtTx
    try {
        decodedFeeTx = decodeUsdtTransaction({ rawDataHex: `0x${feeTx.rawDataHex}`, signature: feeTx.signature })
    } catch (error: any) {
        return reply.code(429).send({ error: "feeTx.rawDataHex structure is bad" })
    }

    const senderBase58Address = decodedMainTx.fromBase58Address
    if (decodedFeeTx.fromBase58Address !== senderBase58Address) {
        return reply.code(429).send({ error: "mainTx and feeTx must be sent from the same address" })
    }

    if (decodedMainTx.signerBase58Address !== senderBase58Address || decodedFeeTx.signerBase58Address !== senderBase58Address) {
        return reply.code(429).send({ error: `Either mainTx or feeTx was signed incorrectly. The signed has to be the person from whom USDT is being sent, which is ${senderBase58Address}` })
    }

    const userBalance = await getUsdtBalance(decodedMainTx.fromBase58Address)
    const userWantsToSend = decodedMainTx.amountHuman.plus(decodedFeeTx.amountHuman)
    if (userBalance < userWantsToSend) {
        return reply.code(429).send({ error: `The user needs to have at least ${userWantsToSend} USDT, but they only have ${userBalance}` })
    }

    const { totalFeeUSDT, sumEnergyNeeded, trxNeeded } = await calculateQuote(decodedMainTx.toBase58Address)
    if (decodedFeeTx.amountHuman < totalFeeUSDT) {
        return reply.code(429).send({ error: `The fee must be at least ${totalFeeUSDT}, but feeTx transfers only ${decodedFeeTx.amountHuman} USDT` })
    }

    if (decodedFeeTx.toBase58Address !== AnanasFeeCollector) {
        return reply.code(429).send({ error: `the recipient in the feeTx must be ${AnanasFeeCollector}, but it was ${decodedFeeTx.toBase58Address}` })
    }

    // User's input validated! Return the tx id and then actually execute the transaction. 
    reply.code(200).send({
        mainTxID: decodedMainTx.txID
    })

    // Fund the account with the resources
    await buyEnergy(sumEnergyNeeded, decodedMainTx.fromBase58Address)
    await sendTrx(senderBase58Address, trxNeeded)

    // Execute the transactions
    await broadcastTx(decodedFeeTx, feeTx.signature)
    await broadcastTx(decodedMainTx, mainTx.signature)
})