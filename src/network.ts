import { BigNumber } from "tronweb"
import { AnanasFeeUSDT, TRXDecimals, TrxSingleTxBandwidth, USDTContract, USDTDecimals, UsdtPerTrx, UsdtToEmptyAccoutEnergy, UsdtToHolderEnergy, tronWeb } from "./constants"
import { DecodedUsdtTx } from "./encoding"
import { humanToUint } from "./util"
import { Logger } from "pino"
import { getTGEnergyQuote } from "./energy"

export async function calculateQuote(recipient: string, pino: Logger) {
    const tgQuote = await getTGEnergyQuote()

    let mainTransferEnergy: number
    const recipientUsdtBalance: BigNumber = await getUsdtBalance(recipient, pino)
    if (recipientUsdtBalance.eq(0)) {
        mainTransferEnergy = UsdtToEmptyAccoutEnergy
    } else {
        mainTransferEnergy = UsdtToHolderEnergy
    }

    // The fee collector surely has some USDT already
    const feeTransferEnergy = UsdtToHolderEnergy

    const sumEnergyNeeded = mainTransferEnergy + feeTransferEnergy
    const energyToBuy = Math.max(sumEnergyNeeded, tgQuote.minEnergy)

    const trxForEnergy = BigNumber(energyToBuy).multipliedBy(tgQuote.priceInTrx)
    const sunToSpendForEnergy = humanToUint(trxForEnergy, USDTDecimals)
    const usdtForEnergy = trxForEnergy.multipliedBy(UsdtPerTrx)

    const trxForBandwidth = TrxSingleTxBandwidth.multipliedBy(2)
    const usdtForBandwidth = trxForBandwidth.multipliedBy(UsdtPerTrx)

    const networkFeeUSDT = usdtForEnergy.plus(usdtForBandwidth)
    const feeWithMarkup = networkFeeUSDT.plus(AnanasFeeUSDT)

    const quote = {
        totalFeeUSDT: feeWithMarkup,
        energyToBuy,
        sunToSpendForEnergy,
        trxNeeded: trxForBandwidth,    
        rawTGQuote: tgQuote,
    }
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
            sumEnergyNeeded,
        }
    })


    return quote
}

/**
 * Fetches USDT balance for the given address and returns it in a human-readable format
 * @param address 
 */
export async function getUsdtBalance(address: string, pino: Logger): Promise<BigNumber> {
    let balanceUint: BigNumber = await USDTContract.methods.balanceOf(address).call()
    balanceUint = BigNumber(balanceUint.toString()) // for some reason we need an explicit conversion
    
    const balanceHuman: BigNumber = balanceUint.dividedBy(BigNumber(10).pow(USDTDecimals))
    pino.info({
        msg: "Fetched user's USDT balance",
        user: address,
        balance: balanceHuman.toString(),
    })
    return balanceHuman
}

export async function broadcastTx(decodedTx: DecodedUsdtTx, signature: string, pino: Logger) {
    const fullSendData = {
        visible: false, // false = hex (not base58) addresses are used
        txID: decodedTx.txID,
        raw_data: decodedTx.rawData,
        raw_data_hex: decodedTx.rawDataHex,
        signature: [signature],
    }
    pino.info({
        msg: "Broadcasting transaction!",
        fullSendData
    })
    const result = await tronWeb.trx.sendRawTransaction(fullSendData)
    if (!result.result) {
        pino.error({
            msg: "Could not send the transaction!!"
        })
        throw new Error('Could not send the transaction!')
    }
}

export async function sendTrx(amountHuman: BigNumber, to: string, pino: Logger) {
    const amountUint = humanToUint(amountHuman, TRXDecimals)
    await tronWeb.trx.sendTrx(to, amountUint)
    pino.info({ msg: `Sent ${amountHuman} TRX to ${to}` })
}
