import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { SmoothRouterBase58, globalPino, tronWeb } from '../constants';
import { checkAdminEnergy } from '../network';

const schema = {
    body: Type.Object({
        from: Type.String(),
        to: Type.String(),
        transferAmount: Type.Number(), // uint
        feeAmount: Type.Number(), // uint
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
        requestBody: request.body
    })
    const body = request.body

    // TODO: need to have a global mutex for the admin wallet so that we don't accidentally
    // end up running out of energy.
    await checkAdminEnergy(pino)

    // TODO: check that feeAmount is valid, that the user has enough USDT, that the user has approved our router to spend USDT and maybe some other stuff.
    // if (forma)

    const functionSelector = 'transfer(address,address,uint256,uint256,uint256,uint8,bytes32,bytes32)';
    const parameter = [
        { type: 'address', value: body.from },
        { type: 'address', value: body.to },
        { type: 'uint256', value: body.transferAmount },
        { type: 'uint256', value: body.feeAmount },
        { type: 'uint256', value: body.nonce },
        { type: 'uint8', value: body.v },
        { type: 'bytes32', value: body.r },
        { type: 'bytes32', value: body.s },
    ]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(SmoothRouterBase58, functionSelector, {}, parameter);
    const signedTx = await tronWeb.trx.sign(transaction)
    pino.info({
        msg: "Computed & signed a transfer transaction",
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
    pino.info({
        msg: "Successfully broadcasted the transfer transaction"
    })

    reply.send({
        success: true,
        txID: broadcastResult.transaction.txID
    })

    pino.info({
        msg: "Execution took",
        timeMs: Date.now() - requestBeginTs,
    })
})