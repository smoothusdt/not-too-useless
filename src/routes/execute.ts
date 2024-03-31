import { Type } from '@sinclair/typebox'
import { app } from "../app";
import { DecodedUsdtTx, decodeUsdtTransaction } from '../encoding';
import { broadcastTx } from '../network';

const schema = {
    body: Type.Object({
        mainTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
        feeTx: Type.Object({ rawDataHex: Type.String(), signature: Type.String() }),
    }),
}

app.post('/execute', { schema }, async function (request, reply) {
    const { mainTx, feeTx } = request.body

    let decodedMainTx: DecodedUsdtTx
    try {
        decodedMainTx = decodeUsdtTransaction(`0x${mainTx.rawDataHex}`)
    } catch (error: any) {
        return reply.code(429).send({ error: "mainTx.rawDataHex structure is bad" })
    }

    await broadcastTx(decodedMainTx, mainTx.signature)
    reply.send('OK')
})