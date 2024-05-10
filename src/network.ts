import { BigNumber, TronWeb } from "tronweb"
import { RelayerBase58Address, MinAdminEnergy, TRXDecimals, USDTContract, USDTDecimals, tronWeb, SmoothRouterBase58, SmoothRouterContract } from "./constants"
import { humanToUint } from "./util"
import { Logger } from "pino"


/**
 * Fetches USDT balance for the given address and returns it in a human-readable format
 * @param address 
 */
export async function getUsdtBalance(address: string, pino: Logger): Promise<BigNumber> {
    pino.info({
        msg: "Fetching USDT balance",
        address
    })
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

export async function getTxReceipt(txID: string, pino: Logger): Promise<any> {
    const startTs = Date.now()
    const timeout = 60000 // should never fucking timeout
    while (true) {
        pino.info({
            msg: "Checking transaction receipt",
            txID,
        })
        const txInfo = await tronWeb.trx.getUnconfirmedTransactionInfo(txID)
        pino.info({
            msg: "Fetched transaction info",
            txID,
            txInfo,
        })
        if (txInfo && txInfo.id) {
            return txInfo
        }
        if (Date.now() - startTs > timeout) {
            throw new Error('Could not get the transaction receipt after a long time! This is extremly bad!!!!')
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
}

// Broadcasts a transaction and waits for its execution.
// Throws an error if transaction fails.
export async function broadcastTx(signedTx: any, pino: Logger) {
    pino.info({
        msg: "Broadcasting transaction!",
        signedTx
    })
    const broadcastResult = await tronWeb.trx.sendRawTransaction(signedTx)
    if (!broadcastResult.result) {
        pino.error({
            msg: "Could not send the transaction!!",
            code: broadcastResult.code,
            message: broadcastResult.message,
        })
        throw new Error(`Could not send the transaction due to ${broadcastResult.message}`)
    }

    const txReceipt = await getTxReceipt(broadcastResult.transaction.txID, pino)
    // If txReceipt.receipt.result is not defined - it is a TRX transfer.
    // We always consider it successful.
    if (!txReceipt.receipt || !txReceipt.receipt.result || txReceipt.receipt.result === 'SUCCESS') {
        pino.info({
            msg: "Transaction has been successfully executed!",
            txID: broadcastResult.transaction.txID,
            executionResult: txReceipt.receipt.result,
        })
        return
    } else {
        pino.error({
            msg: "Transaction did not execute well!!",
            txReceipt,
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
    await getTxReceipt(result.transaction.txID, pino)
    pino.info({ msg: "TRX transfer has succeeded"})
}

// Throws, logs, and notifies the devs via TBD if the admin wallet doesn't have enough energy.
// This is extremly bad if happens as it breaks the core functionality!!
export async function checkAdminEnergy(pino: Logger) {
    pino.info({
        msg: "Checking how much energy admin has"
    })

    const adminResources = await tronWeb.trx.getAccountResources(RelayerBase58Address)
    pino.info({
        msg: "Fetched admin resources",
        adminResources,
    })

    let energyBalance: number = 0;
    if (!adminResources.EnergyLimit) {
        energyBalance = 0
    } else {
        const energyUsed = adminResources.EnergyUsed || 0 // can be undefined if zero
        energyBalance = adminResources.EnergyLimit - energyUsed
    }

    pino.info({
        msg: "Admin's energy balance",
        energyBalance
    })

    if (energyBalance < MinAdminEnergy) {
        // Suuuuuuuuuuuuuuper bad
        const msg = "The admin wallet does not have enough energy!!!!!!!!!!!!!!"
        pino.error({
            msg
        })

        // TODO: important. Also notify via a discord / telegram bot or a service like that

        throw new Error(msg)
    }

    pino.info({
        msg: "Admin's energy is sufficient! Great!"
    })
}