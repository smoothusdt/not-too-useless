import { Type } from '@sinclair/typebox'
import { app } from '../app'
import { calculateQuote } from '../network'
import { globalPino } from '../constants'

const schema = {
    body: Type.Object({
        to: Type.String(),
        from: Type.String(), // unused, but is here for convenience
        amount: Type.String(), // unused, but is here for convenience
    }),
}

app.post('/get-quote', { schema }, async function (request, reply) {
    const pino = globalPino.child({ requestId: crypto.randomUUID() })
    pino.info({
        msg: "Got a new request!",
        url: request.url,
        requestBody: request.body
    })
    const { to } = request.body

    const quote = await calculateQuote(to, pino)
    reply.send({
        feeInUSDT: quote.totalFeeUSDT
    })
})
