import { Logger } from "pino"
import { ChainName, EnvironmentName, ExplorerUrl, JL_SCALE, JustLendContract, StakedSunPerEnergyUint, TRXDecimals, TRXPrice, tronWeb } from "./constants"
import { uintToHuman } from "./util"
import { BigNumber } from "tronweb"

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN
if (!TG_BOT_TOKEN) {
    throw new Error('TG_BOT_TOKEN .env variable is not set')
}

export const BotUrl = 'https://api.telegram.org/bot' + TG_BOT_TOKEN
const NotificationsChatId = -4249996549

export async function sendTelegramNotification(message: string, pino: Logger) {
    message = `On ${ChainName}, ${EnvironmentName}.\n` + message
    pino.info({
        msg: 'Sending a telegram notification',
        message
    })
    const url = `${BotUrl}/sendMessage`
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            chat_id: NotificationsChatId,
            text: message,
            parse_mode: 'HTML',
            link_preview_options: {
                is_disabled: true
            }
        }),
        headers: {
            'Content-Type': 'application/json',
        }
    })
    const data = await response.json() as any
    if (data.ok === true) {
        pino.info({
            msg: 'Successfully sent a telegram notification',
        })
    } else {
        pino.error({
            msg: 'Failed to send a telegram notification!!!',
            tgResponse: data,
        })
        throw new Error('Failed to send a telegram notification!')
    }
}

export async function getLocationByIp(ip: string): Promise<string> {
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`)
        const result = await response.json() as any
        const location = `${result.country}, ${result.regionName}`
        return location
    } catch {
        // we don't care about what error happened since this is just informational
        return undefined
    }
}

// Logs error, sends a telegram notification and throws
export async function produceError(message: string, context: any, pino: Logger) {
    pino.error({
        msg: message,
        context
    })
    await sendTelegramNotification(`Alert!!! ${message}`, pino)
    throw new Error(message)
}

// Formats a transaction message to be used in a telegram notification
export async function formatTxMessage(txName: string, txID: string, pino: Logger): Promise<string> {
    pino.info({
        msg: 'Making a formatted telegram message for transaction',
        txName,
        txID
    })
    const receipt = await tronWeb.trx.getUnconfirmedTransactionInfo(txID)
    const explorerUrl = `${ExplorerUrl}/transaction/${txID}`

    const rentalRateRaw = await JustLendContract.methods._rentalRate(
        0, // extra amount - we don't care, we just want to se the current rate
        1, // resource type (1 = energy)
    ).call()
    const rentalRate = new BigNumber(rentalRateRaw.toString())
    // How much SUN we need to pay to get 1 energy unit per day
    const sunPerDayPrice = StakedSunPerEnergyUint
        .multipliedBy(rentalRate)
        .multipliedBy(86400)
        .dividedBy(JL_SCALE)
        .decimalPlaces(0)
        .toNumber()

    const rentedEnergyUsed = receipt.receipt?.energy_usage || 0
    const trxForRentedEnergy = uintToHuman(rentedEnergyUsed * sunPerDayPrice, TRXDecimals)
    const trxBurntForExtraEnergy = uintToHuman(receipt.receipt?.energy_fee || 0, TRXDecimals)

    const rentedBandwidthUsed = receipt.receipt?.net_usage || 0
    const trxBurntForExtraBandwidth = uintToHuman(receipt.receipt?.net_fee || 0, TRXDecimals)

    const totalTrxSpent = trxForRentedEnergy.plus(trxBurntForExtraEnergy).plus(trxBurntForExtraBandwidth)
    const totalUsdtSpent = totalTrxSpent.multipliedBy(TRXPrice)

    const formattedMessage = `<a href="${explorerUrl}">${txName}</a>. Total fee: ${totalTrxSpent.toFixed(2)} TRX (~ ${totalUsdtSpent.toFixed(2)} USDT). Rented energy used: ${rentedEnergyUsed} (~${trxForRentedEnergy.toFixed(2)} TRX). Burnt for extra energy: ${trxBurntForExtraEnergy.toFixed(2)} TRX. Rented / free bandwidth used: ${rentedBandwidthUsed}. Burnt for extra bandwidth: ${trxBurntForExtraBandwidth.toFixed(2)} TRX.`
    return formattedMessage
}