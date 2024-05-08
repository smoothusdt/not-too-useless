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

    // TODO: need to have a global mutex for the admin wallet so that we don't accidentally
    // end up running out of energy when executing multiple transactions in parallel.
    await checkAdminEnergy(pino)

    pino.info({
        msg: "Admin's energy is sufficient! Decoding the approval tx now."
    })
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
        msg: "The approval transaction is valid! Checking the user's USDT balance now."
    })

    const userUsdtBalance = await getUsdtBalance(decodedApproveTx.fromBase58Address, pino)
    if (userUsdtBalance.lt(SmoothTransferFee)) {
        pino.warn({
            msg: 'User USDT balance is too low',
            userUsdtBalance,
            requiredBalance: SmoothTransferFee
        })
        return reply.code(429).send({
            success: false,
            error: `The user must have at least ${SmoothTransferFee} USDT to execute approval`
        })
    }
    pino.info({
        msg: "The user has enough USDT! Executing the approval flow now!"
    })

    // TODO: check the user's bandwidth and account activation status before sending TRX.
    // If the has not been activated yet - we just need to make an empty transaction, without any TRX.
    // If the account has enough bandwidth - we don't need this transaction at all.
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

    await finishEnergyRentalForApproval(decodedApproveTx.fromBase58Address, pino)
    pino.info({
        msg: "Finished energy rental after executing approval"
    })

    reply.send({
        success: true,
        txID: decodedApproveTx.txID,
    })

    pino.info({
        msg: "Execution took",
        timeMs: Date.now() - requestBeginTs,
    })
})