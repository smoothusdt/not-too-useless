import { BigNumber, TronWeb } from "tronweb"
import { RelayerBase58Address, MinAdminEnergy, TRXDecimals, USDTContract, USDTDecimals, tronWeb } from "./constants"
import { humanToUint, uintToHuman } from "./util"
import { Logger } from "pino"
import { produceError, sendTelegramNotification } from "./notifications"
import { Block } from "./tronWebTypes/APIResponse"


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
    pino.info({
        msg: "Fetching transaction receipt",
        txID,
    })
    while (true) {
        const txInfo = await tronWeb.trx.getUnconfirmedTransactionInfo(txID)
        pino.info({
            msg: "Fetched transaction info. Checking whether it's non-empty",
            txID,
            txInfo,
        })
        if (txInfo && txInfo.id) {
            return txInfo
        }
        if (Date.now() - startTs > timeout) {
            await produceError('Could not get the transaction receipt after a long time! This is extremly bad!!!!', { txID }, pino)
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
        await produceError(
            `Could not send the transaction due to ${broadcastResult.message}`,
            {
                code: broadcastResult.code,
                message: broadcastResult.message
            },
            pino,
        )
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
        await produceError(
            'Transaction did not execute well!!',
            {
                txReceipt,
                txID: broadcastResult.transaction.txID
            },
            pino
        )
    }
}

export async function sendTrx(amountHuman: BigNumber, to: string, pino: Logger): Promise<string> {
    const amountUint = humanToUint(amountHuman, TRXDecimals)
    const result = await tronWeb.trx.sendTrx(to, amountUint)
    if (!result.result) {
        await produceError(
            'Could not send TRX',
            {
                code: result.code,
                message: result.message,
                amountHuman,
                to
            },
            pino
        )
    }
    pino.info({ msg: `Initiated a transfer of ${amountHuman} TRX to ${to}` })
    await getTxReceipt(result.transaction.txID, pino)
    pino.info({ msg: "TRX transfer has succeeded" })
    
    return result.transaction.txID
}

// A function that can be fired from anywhere at any time to log
// the current state of Smooth USDT into telegram and the database
export async function logRelayerState(pino: Logger) {
    pino.info({
        msg: 'Fetching & logging Smooth USDT state'
    })
    const relayerResources = await tronWeb.trx.getAccountResources(RelayerBase58Address)
    pino.info({
        msg: "Fetched relayer resources",
        relayerResources,
    })

    const relayerEenergyUsed: number = relayerResources.EnergyUsed || 0;
    const relayerEnergyLimit: number = relayerResources.EnergyLimit || 0;
    const relayerEnergyBalance = relayerEnergyLimit - relayerEenergyUsed
    const energyPercentageUsed = (relayerEenergyUsed / relayerEnergyLimit * 100).toFixed(2)

    const relayerTrxBalance = uintToHuman(await tronWeb.trx.getBalance(RelayerBase58Address), TRXDecimals).toFixed(0)
    
    // TODO: need to query JustLendDao to see when we need to extend energy rental.
    const message = `Relayer state.
Relayer's energy: ${relayerEenergyUsed} / ${relayerEnergyLimit} (${energyPercentageUsed}%) is used. ${relayerEnergyBalance} energy is available.
Relayer's balance: ${relayerTrxBalance} TRX.`
    
    await sendTelegramNotification(message, pino)
}

let latestConfirmedBlock: Block

export async function getLatestConfirmedBlock(pino: Logger): Promise<Block> {
    const maxLatestBlockAge = 3600 * 2 * 1000 // 2 hours (in milliseconds)
    if (!latestConfirmedBlock || Date.now() - latestConfirmedBlock.block_header.raw_data.timestamp >  maxLatestBlockAge) {
        const msg = 'Latest confirmed block was not up-to-date!'
        pino.warn({
            msg,
        })
        const telegramMessage = `Warning! ${msg}`
        await sendTelegramNotification(telegramMessage, pino)
        latestConfirmedBlock = await tronWeb.trx.getConfirmedCurrentBlock()
    }

    return latestConfirmedBlock
}

// An infinite loop that updates the latest confirmed block every hour.
// In transactions, Tron allows to use reference block that is up to 2 days old,
// but we are updating the latest confirmed block every hour just to be sure it's ok.
export async function updateLatestConfirmedBlockLoop(pino: Logger) {
    const interval = 3600 * 1000 // 1 hour (in milliseconds)
    while (true) {
        try {
            latestConfirmedBlock = await tronWeb.trx.getConfirmedCurrentBlock()
            pino.info({
                msg: 'Updated latest confirmed block',
                blockTimestamp: latestConfirmedBlock.block_header.raw_data.timestamp,
                blockID: latestConfirmedBlock.blockID,
            })
        } catch (error: any) {
            await produceError('Could not update latestConfirmedBlock!!!', { error }, pino)
        }
        await new Promise(resolve => setTimeout(resolve, interval))
    }
}