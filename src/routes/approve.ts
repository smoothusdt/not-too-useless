import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { SmoothRouterBase58, USDTAddressBase58, globalPino, tronWeb } from '../constants';
import { broadcastTx, checkAdminEnergy } from '../network';
import { finishEnergyRentalForApproval, rentEnergyForApproval } from '../energy';
import { decodeApprovalTransaction } from '../encoding';
import { Hex } from 'viem';

const schema = {
    body: Type.Object({
        approveTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
    }),
}

app.post('/approve', { schema }, async function (request, reply) {
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

    const decodedApproveTx = decodeApprovalTransaction({
        rawDataHex: body.approveTx.rawDataHex as Hex,
        signature: body.approveTx.signature,
    })
    pino.info({
        msg: 'Decoded the approve transaction',
        decodedApproveTx
    })

    // Validate the approveTx contents
    if (decodedApproveTx.contractBase58Address !== USDTAddressBase58) {
        pino.warn({
            msg: 'Bad approval tx. Wrong decodedApproveTx.contractBase58Address',
        })

        return reply.code(429).send({
            success: false,
            error: `The approval transaction can only trigger the USDT contract (${USDTAddressBase58})`
        })
    }

    if (decodedApproveTx.spenderBase58Address !== SmoothRouterBase58) {
        pino.warn({
            msg: 'Bad approval tx. Wrong spender address'
        })

        return reply.code(429).send({
            success: false,
            error: `The approval transaction must be approving the smooth usdt router (${SmoothRouterBase58})`
        })
    }

    if (decodedApproveTx.amountHex.toLowerCase() !== '0x' + 'f'.repeat(64)) {
        pino.warn({
            msg: 'Bad amount in the approval tx'
        })

        return reply.code(429).send({
            success: false,
            error: `The approved amount must be max (0xffff...ffff)`
        })
    }

    await rentEnergyForApproval(decodedApproveTx.fromBase58Address, pino)
    const signedTx  = {
        visible: false, // false = hex (not base58) addresses are used
        txID: decodedApproveTx.txID,
        raw_data: decodedApproveTx.rawData,
        raw_data_hex: decodedApproveTx.rawDataHex,
        signature: [body.approveTx.signature],
    }
    await broadcastTx(signedTx, pino)
    await finishEnergyRentalForApproval(decodedApproveTx.fromBase58Address, pino)

    reply.send({
        success: true,
        txID: decodedApproveTx.txID,
    })

    pino.info({
        msg: "Execution took",
        timeMs: Date.now() - requestBeginTs,
    })
})