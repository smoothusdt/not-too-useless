import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { globalPino } from '../constants';
import { sendTelegramNotification } from '../notifications';
import { getEncryptionKey } from '../db';
import { PinError } from '../errors';

const schema = {
    body: Type.Object({
        deviceId: Type.String(),
        pin: Type.String()
    }),
}

app.post('/getEncryptionKey', { schema }, async function (request, reply) {
    const pino = globalPino.child({ requestId: crypto.randomUUID() })
    pino.info({
        msg: "Got a new request!",
        url: request.url,
        requestBody: request.body,
        headers: request.headers,
        ip: request.ip
    })
    try {
        const { deviceId, pin } = request.body
        try {
            const encryptionKey = await getEncryptionKey(deviceId, pin)
            pino.info({ msg: "Found an encryption key" })
            return reply.code(200).send({
                success: true,
                encryptionKey,
            })
        } catch (error: any) {
            if (!(error instanceof PinError)) throw error // something unknown 

            pino.info({ msg: "Not returning encryption key due to", error: error.toJson() })
            return reply.code(429).send({
                success: false,
                error: error.toJson()
            })
        }

    } catch (error: any) {
        pino.error({
            msg: 'Got an unhandled error',
            error: error.message,
        })
        const telegramMessage = `Alert!!! ${error.message}`
        await sendTelegramNotification(telegramMessage, pino)
        throw error
    } finally {
        pino.info({ msg: "Finished processing request" })
    }
})