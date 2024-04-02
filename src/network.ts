import { BigNumber } from "tronweb"
import { AnanasFeeUSDT, TRXDecimals, TrxSingleTxBandwidth, USDTContract, USDTDecimals, tronWeb } from "./constants"
import { DecodedUsdtTx, decodeUsdtTransaction } from "./encoding"
import { humanToUint } from "./util"

// Update automatically by a background task
interface EnergyDataInterface {
    // The recipient does not own USDT yet
    usdtTransferToEmptyAccout: number

    // The recipient already has USDT
    usdtTransferToHolder: number

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
    usdtTransferToEmptyAccout: 64895,
    usdtTransferToHolder: 31895,
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

export async function calculateQuote(recipient: string) {
    const actualTransferEnergy = await estimateTransferEnergy(recipient)
    // The fee collector surely has some USDT already
    const feeTransferEnergy = latestEnergyData.usdtTransferToHolder
    const sumEnergyNeeded = actualTransferEnergy + feeTransferEnergy

    const trxForEnergy = BigNumber(sumEnergyNeeded).multipliedBy(latestEnergyData.trxPerEnergyUnit)
    const usdtForEnergy = trxForEnergy.multipliedBy(latestEnergyData.usdtPerTrx)

    const trxForBandwidth = TrxSingleTxBandwidth.multipliedBy(2)
    const usdtForBandwidth = trxForBandwidth.multipliedBy(latestEnergyData.usdtPerTrx)

    const networkFeeUSDT = usdtForEnergy.plus(usdtForBandwidth)
    const feeWithMarkup = networkFeeUSDT.plus(AnanasFeeUSDT)

    return {
        totalFeeUSDT: feeWithMarkup,
        sumEnergyNeeded,
        trxNeeded: trxForBandwidth
    }
}

/**
 * Fetches USDT balance for the given address and returns it in a human-readable format
 * @param address 
 */
export async function getUsdtBalance(address: string): Promise<BigNumber> {
    const balanceUint: BigNumber = await USDTContract.methods.balanceOf(address)
    const balanceHuman: BigNumber = balanceUint.dividedBy(BigNumber(10).pow(USDTDecimals))
    return balanceHuman
}

/**
 * Gets a detailed estimate on how much energy is needed for a USDT transfer
 * @param recipient 
 * @returns 
 */
export async function estimateTransferEnergy(recipient: string): Promise<number> {
    const recipientUsdtBalance: BigNumber = await USDTContract.methods.balanceOf(recipient).call();

    if (recipientUsdtBalance.eq(0)) {
        return latestEnergyData.usdtTransferToEmptyAccout
    }

    // implicit else
    return  latestEnergyData.usdtTransferToHolder
}

export async function broadcastTx(decodedTx: DecodedUsdtTx, signature: string) {
    const fullSendData = {
        visible: false, // false = hex (not base58) addresses are used
        txID: decodedTx.txID,
        raw_data: decodedTx.rawData,
        raw_data_hex: decodedTx.rawDataHex,
        signature: [signature],
    }
    console.log('Re-computed transaction:', JSON.stringify(fullSendData))
    const result = await tronWeb.trx.sendRawTransaction(fullSendData)
    console.log('Broadcasted a transaction:', result)
}

export async function sendTrx(to: string, amountHuman: BigNumber) {
    const amountUint = humanToUint(amountHuman, TRXDecimals)
    await tronWeb.trx.sendTrx(to, amountUint)
}
