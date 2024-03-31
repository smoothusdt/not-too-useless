import { hexToBytes } from 'viem'
import { app } from '../app'
import { tronWeb } from '../constants'
import { sha256 } from 'js-sha256'
import { recoverSigner } from '../util'

app.get('/example', {}, async function (request, reply) {
    const tx = await tronWeb.trx.getTransaction('7649536d483e526264f84bf79216e9efc66e7a8345eb458911f35cbd6c0cf0b9')
    console.log(tx)

    // const rawDataHex = '0x0a02859d2208c28a6ba5cf73aa2440b08fae83e9315aae01081f12a9010a31747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412740a154129051d76d72532352290811f6a1b197b301f4c4e121541a614f803b6fd780986a42c78ec9c7f77e6ded13c2244a9059cbb000000000000000000000000d353003dba6a27977df154b4f63d9e95c9818cb0000000000000000000000000000000000000000000000000000000001220cee070c5cfaa83e931900180a3c347' 
    // const calculatedTxID = sha256(hexToBytes(rawDataHex))
    // console.log('Calculated ID:', calculatedTxID)
    // console.log('Is the calculated ID equal the actual id???', calculatedTxID === tx.txID)
    // recoverSigner()

    tronWeb.trx.sendHexTransaction({
        // raw_data_hex: '',
        // signature: [''],
        // raw_data: {} as any,
    })

    reply.send('Have a cool day')
})