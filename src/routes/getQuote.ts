import { Type } from '@sinclair/typebox'
import { app } from '../app'
import { calculateQuote } from '../network'

const schema = {
    body: Type.Object({
        to: Type.String(),
        from: Type.String(), // unused, but is here for convenience
        amount: Type.String(), // unused, but is here for convenience
    }),
}

app.post('/get-quote', { schema }, async function (request, reply) {
    const { to } = request.body

    const quote = await calculateQuote(to)
    reply.send({
        feeInUSDT: quote.totalFeeUSDT
    })
})
