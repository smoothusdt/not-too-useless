import { BigNumber, TronWeb } from "tronweb"
import { RelayerBase58Address, TRXDecimals, USDTContract, USDTDecimals, tronWeb } from "./constants"
import { humanToUint, uintToHuman } from "./util"
import { Logger } from "pino"
import { produceError, sendTelegramNotification } from "./notifications"
import { Block, BlockHeader } from "./tronWebTypes/APIResponse"
import { Transaction } from "./tronWebTypes/Transaction"
import { TransactionInfo } from "./tronWebTypes/Trx"


/**
 * Fetches USDT balance for the given address and returns it in a human-readable format
 * @param address 
 */
export async function getUsdtBalance(address: string, pino: Logger): Promise<BigNumber> {
    pino.info({
        msg: "Fetching USDT balance",
        address
    })
    let balanceUint = await USDTContract.methods.balanceOf(address).call()
    // We need an epxlicit conversion because tronWeb is a peace of crap and
    // contract calls return a BigNumber, but it's an ethers BigNumber,
    // whereas we want a TronWeb's BigNumber.
    balanceUint = BigNumber(balanceUint.toString())

    const balanceHuman: BigNumber = balanceUint.dividedBy(BigNumber(10).pow(USDTDecimals))
    pino.info({
        msg: "Fetched user's USDT balance",
        user: address,
        balance: balanceHuman.toString(),
    })
    return balanceHuman
}

export async function getTxReceipt(txID: string, pino: Logger): Promise<TransactionInfo> {
    const startTs = Date.now()
    const timeout = 60000 // should never timeout
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
    }
    // implicit else
    await produceError(
        'Transaction did not execute well!!',
        {
            txReceipt,
            txID: broadcastResult.transaction.txID
        },
        pino
    )

}

export async function sendTrx(amountHuman: BigNumber, to: string, pino: Logger): Promise<string> {
    const amountUint = humanToUint(amountHuman, TRXDecimals)
    const startTs = Date.now()
    const transaction = await tronWeb.transactionBuilder.sendTrx(to, amountUint, RelayerBase58Address, {
        blockHeader: await makeBlockHeader(pino)
    })
    pino.info({
        msg: 'Time to build a send trx tx',
        time: Date.now() - startTs
    })
    const signedTx = await tronWeb.trx.sign(transaction)
    const result = await tronWeb.trx.sendRawTransaction(signedTx)
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

let latestConfirmedBlock: Block

export async function getLatestConfirmedBlock(pino: Logger): Promise<Block> {
    const maxLatestBlockAge = 3600 * 2 * 1000 // 2 hours (in milliseconds)
    if (!latestConfirmedBlock || Date.now() - latestConfirmedBlock.block_header.raw_data.timestamp > maxLatestBlockAge) {
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

export async function makeBlockHeader(pino: Logger): Promise<Partial<Transaction['raw_data']>> {
    const block = await getLatestConfirmedBlock(pino)
    const timestamp = Date.now()
    const expiration = timestamp + 60000 // expires in 1 minute
    const blockHeader = {
        ref_block_bytes: block.blockID.slice(6 * 2, 8 * 2),
        ref_block_hash: block.blockID.slice(8 * 2, 16 * 2),
        timestamp,
        expiration
    }
    pino.info({
        msg: 'Made a block header',
        blockHeader
    })
    return blockHeader
}