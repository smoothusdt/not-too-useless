import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { SmoothRouterBase58, SmoothTransferFee, USDTDecimals, globalPino, tronWeb } from '../constants';
import { uintToHuman } from '../util';
import { formatTxMessage, getLocationByIp, produceError, sendTelegramNotification } from '../notifications';
import { makeBlockHeader } from '../network';
import { checkRelayerState } from '../energy';

const schema = {
    body: Type.Object({
        usdtAddress: Type.String(), // base58
        from: Type.String(),
        to: Type.String(),
        transferAmount: Type.Number(), // uint
        feeAmount: Type.Number(), // uint
        feeCollector: Type.String(), // Base58 fee collector address
        nonce: Type.Number(),
        v: Type.Number(),
        r: Type.String(), // Hex
        s: Type.String(), // Hex
    }),
}

app.post('/transfer', { schema }, async function (request, reply) {
    const pino = globalPino.child({ requestId: crypto.randomUUID() })
    const requestBeginTs = Date.now()
    pino.info({
        msg: "Got a new request!",
        url: request.url,
        requestBody: request.body,
        headers: request.headers,
        ip: request.ip
    })
    try {
        const body = request.body

        const humanFee = uintToHuman(body.feeAmount, USDTDecimals)
        if (!humanFee.eq(SmoothTransferFee)) {
            pino.warn({
                msg: "The fee in the transfer was incorrect!",
                submittedUintFee: body.feeAmount,
                submittedHumanFee: humanFee,
                requiredHumanFee: SmoothTransferFee,
            })
            return reply.code(429).send({
                success: false,
                error: `The fee must be exactly ${SmoothTransferFee} USDT`
            })
        }

        const beforeGetBlock = Date.now()
        const functionSelector = 'transfer(address,address,address,uint256,address,uint256,uint256,uint8,bytes32,bytes32)';
        const parameter = [
            { type: 'address', value: body.usdtAddress },
            { type: 'address', value: body.from },
            { type: 'address', value: body.to },
            { type: 'uint256', value: body.transferAmount },
            { type: 'address', value: body.feeCollector },
            { type: 'uint256', value: body.feeAmount },
            { type: 'uint256', value: body.nonce },
            { type: 'uint8', value: body.v },
            { type: 'bytes32', value: body.r },
            { type: 'bytes32', value: body.s },
        ]
        const beforeCreateTransactionTs = Date.now()
        const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
            SmoothRouterBase58,
            functionSelector,
            {
                blockHeader: await makeBlockHeader(pino),
                txLocal: true
            },
            parameter,
        );
        const beforeSignTransactionTs = Date.now()
        const signedTx = await tronWeb.trx.sign(transaction)
        pino.info({
            msg: "Computed & signed a transfer transaction",
            signedTx
        })

        const beforeBroadcastTransactionTs = Date.now()
        const broadcastResult = await tronWeb.trx.sendRawTransaction(signedTx)
        if (!broadcastResult.result) {
            await produceError(
                `Could not send the transaction due to ${broadcastResult.message}`,
                // Not logging the transaction object since it will take a lot of space and
                // has been logged a few lines above anyway.
                {
                    code: broadcastResult.code,
                    message: broadcastResult.message,
                },
                pino
            )
        }
        pino.info({
            msg: "Successfully broadcasted the transfer transaction"
        })

        const beforeReplyTs = Date.now()
        reply.send({
            success: true,
            txID: broadcastResult.transaction.txID
        })

        const executionTook = Date.now() - requestBeginTs
        pino.info({
            msg: "Execution took",
            timeMs: executionTook,
            requestBeginTs,
            beforeGetBlock,
            beforeCreateTransactionTs,
            beforeSignTransactionTs,
            beforeBroadcastTransactionTs,
            beforeReplyTs
        })

        // Wait for 3 seconds so that the transaction is included in a block
        await new Promise(resolve => setTimeout(resolve, 3000))
        const location = await getLocationByIp((request.headers['true-client-ip'] as string) || request.ip)
        const txDetailsMessage = await formatTxMessage('Transfer', broadcastResult.transaction.txID, pino)
        await sendTelegramNotification(`Executed a transfer for ${body.from}! From ${request.ip}, ${location}. It took ${executionTook}ms to reply.\n${txDetailsMessage}`, pino)
        await checkRelayerState(pino)
    } catch (error: any) {
        pino.error({
            msg: 'Got an unhandled error',
            error: error.message
        })
        const telegramMessage = `Alert!!! ${error.message}`
        await sendTelegramNotification(telegramMessage, pino)
        throw error
    }
})