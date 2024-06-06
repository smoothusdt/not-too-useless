import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { globalPino } from '../constants';
import { sendTelegramNotification } from '../notifications';
import { setSencryptionKey } from '../db';

const schema = {
    body: Type.Object({
        deviceId: Type.String(),
        encryptionKey: Type.String(),
        pin: Type.Number()
    }),
}

app.post('/setEncryptionKey', { schema }, async function (request, reply) {
    const pino = globalPino.child({ requestId: crypto.randomUUID() })
    pino.info({
        msg: "Got a new request!",
        url: request.url,
        requestBody: request.body,
        headers: request.headers,
        ip: request.ip
    })
    try {
        const { deviceId, encryptionKey, pin } = request.body
        await setSencryptionKey(deviceId, encryptionKey, pin)
        pino.info({ msg: "Set an encryption key" })
        return reply.code(200).send({
            success: true
        })
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