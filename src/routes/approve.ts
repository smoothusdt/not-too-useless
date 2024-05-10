import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { SmoothRouterBase58, SmoothTransferFee, USDTAddressBase58, globalPino, tronWeb } from '../constants';
import { broadcastTx, checkAdminEnergy, getUsdtBalance, sendTrx } from '../network';
import { finishEnergyRentalForApproval, rentEnergyForApproval } from '../energy';
import { decodeApprovalTransaction } from '../encoding';
import { Hex } from 'viem';
import { BigNumber } from 'tronweb';

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

    pino.info({
        msg: "The approval transaction is valid!"
    })

    // TODO: check the user's bandwidth and account activation status before sending TRX.
    // If the account has not been activated yet - we just need to make an empty transaction, without any TRX.
    // If the account has enough bandwidth - we don't need this transaction at all.
    // TODO: Can also optimize this by bundling TRX send and energy rental into a single transaction.
    await sendTrx(BigNumber('0.35'), decodedApproveTx.fromBase58Address, pino)
    pino.info({
        msg: "Sent 0.35 trx to the user to pay for bandwidth and active the account."
    })

    await rentEnergyForApproval(decodedApproveTx.fromBase58Address, pino)
    pino.info({
        msg: "Rented energy on JustLendDAO for the approval transaction!"
    })

    const signedTx = {
        visible: false, // false = hex (not base58) addresses are used
        txID: decodedApproveTx.txID,
        raw_data: decodedApproveTx.rawData,
        raw_data_hex: decodedApproveTx.rawDataHex,
        signature: [body.approveTx.signature],
    }
    await broadcastTx(signedTx, pino)
    pino.info({
        msg: "Successfully executed the approval transaction!"
    })

    // The approval has been executed, so we can safely reply. We can finish energy rental later
    reply.send({
        success: true,
        txID: decodedApproveTx.txID,
    })

    // Logging now instead of the very end because we want to know for how long the user had to wait,
    // not how much time it took to execute everything.
    pino.info({
        msg: "Execution took",
        timeMs: Date.now() - requestBeginTs,
    })

    await finishEnergyRentalForApproval(decodedApproveTx.fromBase58Address, pino)
    pino.info({
        msg: "Finished energy rental after executing approval"
    })
})