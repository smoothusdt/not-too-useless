import { BigNumber } from "tronweb"
import { ChainID, SmoothFeeCollector, SmoothRouterBase58, USDTAddressBase58, USDTDecimals, tronWeb } from "../constants"
import { humanToUint } from "../util";
import { Hex, encodePacked, hexToBytes, hexToNumber, keccak256, sliceHex } from "viem";
import dotenv from "dotenv"
dotenv.config()

async function signTransferMessage(
    chainId: bigint,
    routerBase58: string,
    usdtBase58: string,
    fromBase58: string,
    toBase58: string,
    transferAmount: BigNumber,
    feeCollectorBase58: string,
    feeAmount: BigNumber,
    nonce: bigint,
): Promise<Hex> {
    console.log('Signing transfer message')

    const routerHex = '0x' + tronWeb.utils.address.toHex(routerBase58).slice(2) as Hex
    const usdtHex = '0x' + tronWeb.utils.address.toHex(usdtBase58).slice(2) as Hex
    const fromHex = '0x' + tronWeb.utils.address.toHex(fromBase58).slice(2) as Hex
    const toHex = '0x' + tronWeb.utils.address.toHex(toBase58).slice(2) as Hex
    const feeCollectorHex = '0x' + tronWeb.utils.address.toHex(feeCollectorBase58).slice(2) as Hex
    const transferAmountUint = BigInt(humanToUint(transferAmount, USDTDecimals))
    const feeAmountUint = BigInt(humanToUint(feeAmount, USDTDecimals))

    console.log('Creating a signature with parameters:', { chainId, routerHex, fromHex, toHex, transferAmountUint, feeCollectorHex, feeAmountUint, nonce })
    const encodePackedValues = encodePacked(
        ['string', 'uint256', 'address', 'address', 'address', 'address', 'uint256', 'address', 'uint256', 'uint256'],
        ['Smooth', chainId, routerHex, usdtHex, fromHex, toHex, transferAmountUint, feeCollectorHex, feeAmountUint, nonce],
    )
    console.log('EncodePacked values:', encodePackedValues)

    const digestHex = keccak256(encodePackedValues)
    const digestBytes = hexToBytes(digestHex)
    console.log('Digest:', digestHex, digestBytes)

    const signature = tronWeb.trx.signMessageV2(digestBytes, process.env.USER_PRIVATE_KEY) as Hex
    return signature
}

async function main() {
    console.log('Begin', process.env.USER_PRIVATE_KEY)

    const fromBase58 = tronWeb.address.fromPrivateKey(process.env.USER_PRIVATE_KEY) as string;
    console.log('Transferring from:', fromBase58)

    const usdtAddress = USDTAddressBase58
    const toBase58 = 'TPz8d7CMRW8QF4NY3nsS4D2VjvCqsDjCBN'
    const transferAmount = BigNumber('3')
    const feeCollector = SmoothFeeCollector
    const feeAmount = BigNumber('1.5')
    const nonce = 4

    const signature = await signTransferMessage(
        BigInt(ChainID),
        SmoothRouterBase58,
        usdtAddress,
        fromBase58,
        toBase58,
        transferAmount,
        feeCollector,
        feeAmount,
        BigInt(nonce),
    )
    console.log('Full signature:', signature)

    const r = sliceHex(signature, 0, 32)
    const s = sliceHex(signature, 32, 64)
    const v = hexToNumber(sliceHex(signature, 64))
    console.log('r s v:', { r, s, v })

    console.log('Calling the api!')
    const startTs = Date.now()
    const response = await fetch('http://localhost:3000/transfer', {
        method: 'POST',
        body: JSON.stringify({
            usdtAddress,
            from: fromBase58,
            to: toBase58,
            transferAmount: humanToUint(transferAmount, USDTDecimals),
            feeCollector,
            feeAmount: humanToUint(feeAmount, USDTDecimals),
            nonce,
            v,
            r,
            s
        }),
        headers: {
            'Content-Type': 'application/json',
        }
    })
    console.log('Response:', await response.text())
    console.log('Successfully transferred! Execution took:', Date.now() - startTs)
}

main()
