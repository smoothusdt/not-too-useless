import { BigNumber } from "tronweb"
import { USDTContract, tronWeb } from "./constants"
import { DecodedUsdtTx, decodeUsdtTransaction } from "./encoding"

// Update automatically by a background task
interface EnergyDataInterface {
    // The recipient does not own USDT yet
    usdtTransferToEmptyAccout: BigNumber

    // The recipient already has USDT
    usdtTransferToHolder: BigNumber

    // Price on tokengoodies.com for energy
    trxPerEnergyUnit: BigNumber

    // How many USDT tokens is one TRX token worth
    // e.g. 1 TRX = 0.12 USDT
    usdtPerTrx: BigNumber

    // When this energy data was set
    setAt: Date
}

// MUST always have the latest fee data
export let latestEnergyData: EnergyDataInterface = {
    usdtTransferToEmptyAccout: new BigNumber(64895),
    usdtTransferToHolder: new BigNumber(31895),
    trxPerEnergyUnit: new BigNumber(0.00009),
    usdtPerTrx: new BigNumber(0.12),
    setAt: new Date(),
}

/**
 * Fetches latest energy data from the blockchain and puts it in
 * the latestEnergyData variable.
 */
export async function updateEnergyData() {

}

/**
 * Gets a detailed estimate on how much energy is needed for a USDT transfer
 * @param recipient 
 * @returns 
 */
export async function getTransferEnergyEstimate(recipient: string): Promise<BigNumber> {
    const recipientUsdtBalance: BigNumber = await USDTContract.methods.balanceOf(recipient).call();

    if (recipientUsdtBalance.eq(0)) {
        return latestEnergyData.usdtTransferToEmptyAccout
    }

    // implicit else
    return  latestEnergyData.usdtTransferToHolder
}

export async function broadcastTx(decodedTx: DecodedUsdtTx, signature: string) {
    const fullSendData = {
        visible: false, // always using hex addresses
        txID: decodedTx.txID,
        raw_data: decodedTx.rawData,
        raw_data_hex: decodedTx.rawDataHex,
        signature: [signature],
    }
    console.log('Re-computed transaction:', JSON.stringify(fullSendData))
    const result = await tronWeb.trx.sendRawTransaction(fullSendData)
    console.log('Broadcasted a transaction:', result)
}