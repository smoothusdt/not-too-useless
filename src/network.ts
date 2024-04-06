import { BigNumber } from "tronweb"
import { AnanasFeeUSDT, EmergencyTrxToEmptyAccount, EmergencyTrxToHolder, TRXDecimals, TrxSingleTxBandwidth, USDTContract, USDTDecimals, UsdtPerTrx, UsdtToEmptyAccoutEnergy, UsdtToHolderEnergy, tronWeb } from "./constants"
import { DecodedUsdtTx } from "./encoding"
import { humanToUint } from "./util"
import { Logger } from "pino"
import { getTGEnergyQuote } from "./energy"

export async function calculateQuote(recipient: string, pino: Logger) {
    const tgQuote = await getTGEnergyQuote()

    let mainTransferEnergy: number
    let mainTransferEmergencyTrx: BigNumber
    const recipientUsdtBalance: BigNumber = await getUsdtBalance(recipient, pino)
    if (recipientUsdtBalance.eq(0)) {
        mainTransferEnergy = UsdtToEmptyAccoutEnergy
        mainTransferEmergencyTrx = EmergencyTrxToEmptyAccount
    } else {
        mainTransferEnergy = UsdtToHolderEnergy
        mainTransferEmergencyTrx = EmergencyTrxToHolder
    }

    // The fee collector surely has some USDT already
    const feeTransferEnergy = UsdtToHolderEnergy
    const feeTransferEmergencyTrx = EmergencyTrxToHolder

    const sumEnergyNeeded = mainTransferEnergy + feeTransferEnergy
    const sumEmergencyTrxNeeded = mainTransferEmergencyTrx.plus(feeTransferEmergencyTrx)
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
        sumEnergyNeeded,
        sumEmergencyTrxNeeded,
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
            mainTransferEmergencyTrx,
            feeTransferEmergencyTrx,
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

export async function getTxExecutionResult(txID: string, pino: Logger): Promise<any> {
    const startTs = Date.now()
    const timeout = 60000 // should never fucking timeout
    let executionResult;
    while (!executionResult) {
        pino.info({
            msg: "Checking transaction execution result",
            txID,
        })
        try {
            executionResult = await tronWeb.trx.getTransaction(txID)
        } catch (error: any) {
            if (Date.now() - startTs > timeout) {
                pino.error({
                    msg: "This is critical. We don't know anything about the transaction execution result even after an entire minute!!!",
                    txID: txID,
                })
                throw new Error('Did not find transaction execution result')
            }

            await new Promise(resolve => setTimeout(resolve, 3000))
            continue // means the transaction has not been included yet
        }
    }

    return executionResult;
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
    const broadcastResult = await tronWeb.trx.sendRawTransaction(fullSendData)
    if (!broadcastResult.result) {
        pino.error({
            msg: "Could not send the transaction!!",
            code: broadcastResult.code,
            message: broadcastResult.message,
        })
        throw new Error(`Could not send the transaction due to ${broadcastResult.message}`)
    }

    const executionResult = await getTxExecutionResult(broadcastResult.transaction.txID, pino)
    const contractRet = (executionResult as any).ret[0].contractRet
    if (contractRet === "SUCCESS") {
        pino.info({
            msg: "Transaction has been successfully executed!",
            txID: broadcastResult.transaction.txID,
        })
        return
    } else {
        pino.error({
            msg: "Transaction did not execute well!!",
            executionResult,
            contractRet,
        })
        throw new Error(`Failed to execute transaction ${broadcastResult.transaction.txID}`)
    }
}

export async function sendTrx(amountHuman: BigNumber, to: string, pino: Logger) {
    const amountUint = humanToUint(amountHuman, TRXDecimals)
    const result = await tronWeb.trx.sendTrx(to, amountUint)
    if (!result.result) {
        pino.error({
            msg: "Could not send the transaction!",
            code: result.code,
            message: result.message,
        })
        throw new Error('Could not send TRX')
    }
    pino.info({ msg: `Initiated a transfer of ${amountHuman} TRX to ${to}` })
    await getTxExecutionResult(result.transaction.txID, pino)
    pino.info({ msg: "TRX transfer has succeeded"})
}
