import assert from "assert"
import protobuf from "protobufjs"
import { BigNumber } from "tronweb"
import { Hex, bytesToHex, hexToBigInt, hexToBytes, size, sliceHex } from "viem"
import { hexToBase58Address } from "./util"
import { USDTDecimals } from "./constants"
import { sha256 } from "js-sha256"

const root = protobuf.loadSync('src/random/transaction.proto')
const Raw = root.lookupType("Transaction.raw")

export interface DecodedUsdtTx {
    rawDataHex: string
    rawData: any,
    txID: string

    fromHexAddress: string,
    fromBase58Address: string,

    contractHexAddress: string,
    contractBase58Address: string,

    toHexAddress: string,
    toBase58Address: string,

    amountUint: BigNumber,
    amountHuman: BigNumber
}

export function decodeUsdtTransaction(rawDataHex: Hex): DecodedUsdtTx {
    const rawDataBytes = hexToBytes(rawDataHex)
    const decodedRawData = Raw.decode(rawDataBytes) as any
    const txID = sha256(rawDataBytes)

    const contract = decodedRawData.contract[0]
    assert(contract.type === 31) // 31 is TriggerSmartContract
    const contractData = bytesToHex(decodedRawData.contract[0].parameter.value)

    // "0a" is the argument id and "15" is the length of the "from" address
    assert(sliceHex(contractData, 0, 2) === '0x0a15')
    let fromHexAddress: string = sliceHex(contractData, 2, 23) // also known as "ownerAddress"
    
    // "12" is the argument id and "15" is the length of the contract address
    assert(sliceHex(contractData, 23, 25) === '0x1215')
    let contractHexAddress: string = sliceHex(contractData, 25, 46)

    // "22" is the argument id and "44" is the length of the calldata.
    // We limit to only "transfer" function on USDT, so the
    // calldata is always 68 ("44" = 68 in hex) bytes.
    assert(sliceHex(contractData, 46, 48) === '0x2244')

    // Calldata explanation:
    // 4 bytes - function selector
    // 32 bytes - first argument (to address)
    // 32 bytes - second argument (value uint256)
    const calldata = sliceHex(contractData, 48)
    assert(size(calldata) === 68)
 
    // 0xa9059cbb is the "transfer" function signature
    assert(sliceHex(calldata, 0, 4) === '0xa9059cbb')

    const arg0 = sliceHex(calldata, 4, 36)
    const arg1 = sliceHex(calldata, 36)

    let toHexAddress: string = sliceHex(arg0, 11)
    const amountUint = BigNumber(arg1)
    const amountHuman = amountUint.dividedBy(BigNumber(10).pow(USDTDecimals))

    // remove 0x prefix. Addresses on tron must start with "41"
    fromHexAddress = fromHexAddress.slice(2)
    contractHexAddress = contractHexAddress.slice(2)
    toHexAddress = toHexAddress.slice(2)

    const fromBase58Address = hexToBase58Address(fromHexAddress)
    const contractBase58Address = hexToBase58Address(contractHexAddress)
    const toBase58Address = hexToBase58Address(toHexAddress)

    console.log('Decoded:', decodedRawData)
    console.log('Decoded timestamp:', decodedRawData.timestamp, parseInt(decodedRawData.timestamp))
    const rawDataFormatted = {
        contract: [{
            parameter: {
                value: {
                    data: calldata.slice(2),
                    owner_address: fromHexAddress,
                    contract_address: contractHexAddress,
                },
                type_url: 'type.googleapis.com/protocol.TriggerSmartContract',
            },
            type: 'TriggerSmartContract',
            
        }],
        ref_block_bytes: bytesToHex(decodedRawData.refBlockBytes).slice(2),
        ref_block_hash: bytesToHex(decodedRawData.refBlockHash).slice(2),
        expiration: parseInt(decodedRawData.expiration),
        fee_limit: parseInt(decodedRawData.feeLimit),
        timestamp: parseInt(decodedRawData.timestamp),
    }

    return {
        rawDataHex: rawDataHex.slice(2),
        rawData: rawDataFormatted,
        txID,

        fromHexAddress,
        fromBase58Address,

        contractHexAddress,
        contractBase58Address,

        toHexAddress,
        toBase58Address,

        amountUint,
        amountHuman
    }
}