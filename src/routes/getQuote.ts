import { Type } from '@sinclair/typebox'
import { app } from '../app'
import { getTransferEnergyEstimate as getTransferEnergy, latestEnergyData } from '../network'
import { AnanasFeeUSDT, TrxSingleTxBandwidth } from '../constants'
import { makeUnsignedTransaction } from '../util'

const schema = {
    body: Type.Object({
        from: Type.String(),
        to: Type.String(),
        amount: Type.String(), // amount in human-readable format
    }),
}

export async function calculateQuote(recipient: string) {
    const actualTransferEnergy = await getTransferEnergy(recipient)
    // The fee collector surely has some USDT already
    const feeTransferEnergy = latestEnergyData.usdtTransferToHolder
    const sumEnergyNeeeded = actualTransferEnergy.plus(feeTransferEnergy)

    const trxForEnergy = sumEnergyNeeeded.multipliedBy(latestEnergyData.trxPerEnergyUnit)
    const usdtForEnergy = trxForEnergy.multipliedBy(latestEnergyData.usdtPerTrx)
    
    const trxForBandwidth = TrxSingleTxBandwidth.multipliedBy(2)
    const usdtForBandwidth = trxForBandwidth.multipliedBy(latestEnergyData.usdtPerTrx)

    const networkFeeUSDT = usdtForEnergy.plus(usdtForBandwidth)
    const feeWithMarkup = networkFeeUSDT.plus(AnanasFeeUSDT)

    return {
        totalTxFeeUSDT: feeWithMarkup,
    }
}

app.post('/get-quote', { schema }, async function (request, reply) {
    const { from, to, amount } = request.body

    const quote = await calculateQuote(to)

    await makeUnsignedTransaction(from, to, amount)

    reply.send({
        mainTx: {},
        feeTx: {},
        feeInUSDT: quote.totalTxFeeUSDT
    })
})
