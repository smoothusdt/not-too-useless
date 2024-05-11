import { TronWeb } from "tronweb";
import { SmoothRouterBase58, USDTAddressBase58 } from "../constants";
import { recoverSigner } from "../util";
import { NetworkConfig } from "../constants/networkConfig";

const tronWeb = new TronWeb({
    fullHost: NetworkConfig.rpcUrl,
    headers: { "TRON-PRO-API-KEY": 'a40790e5-a3f3-4cbe-9362-055eaf5d594d' } as any,

    // MUST have TRX to buy energy. As well as energy to execute transfers. 
    privateKey: process.env.USER_PRIVATE_KEY
}) 

async function main() {
    const host = 'localhost:3000'
    console.log('Signing approval transaction', host)

    const functionSelector = 'approve(address,uint256)';
    const parameter = [
        { type: 'address', value: SmoothRouterBase58 },
        { type: 'uint256', value: '0x' + 'f'.repeat(64) },
    ]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        USDTAddressBase58,
        functionSelector,
        {},  
        parameter,
    );
    const signedTx = await tronWeb.trx.sign(transaction)
    console.log('Signed the approval with:', recoverSigner(signedTx.txID, signedTx.signature[0]))
    console.log(signedTx)

    console.log('Sending the approval tx to the api')
    const startTs = Date.now()
    const response = await fetch(`http://${host}/approve`, {
        method: 'POST',
        body: JSON.stringify({
            approveTx: {
                rawDataHex: '0x' + signedTx.raw_data_hex,
                signature: signedTx.signature,
            }
        }),
        headers: {
            'Content-Type': 'application/json',
        }
    })
    console.log('Response:', await response.text())
    console.log('API execution took:', Date.now() - startTs)
}

main()