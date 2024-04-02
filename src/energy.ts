import { Logger } from "pino";
import { TRXDecimals, tronWeb } from "./constants";
import { uintToHuman } from "./util";

const TGApiUrl = "https://www.tokengoodies.com/tronresourceexchange/exchange"
const TGApiKey = "88387866ae3847158f575b7b920e7bb2"

interface RentalDuration {
    blocks: number,
    multiplier: number
}

interface TGOrderOptions {
    min_bandwidth_price_in_sun: number,
    min_energy_price_in_sun: number,
    min_order_amount_in_sun: number,
    order_fees_address: string,
    rental_durations: RentalDuration[]
}

export interface EnergyQuote {
    minRentalDuration: RentalDuration
    tgFeeAddress: string
    basePriceInSun: number
    priceInSun: number
    minEnergy: number
}

export async function getTGEnergyQuote() {
    const response = await fetch(TGApiUrl, {
        method: 'POST',
        body: JSON.stringify({
            type: "api_get_create_order_values",
            action: "utils",
        }),
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            Origin: "https://www.tokengoodies.com",
        }
    })

    const orderOptions = await response.json() as TGOrderOptions
    const tgFeeAddress = orderOptions.order_fees_address
    const minRentalDuration = orderOptions.rental_durations[0]
    const basePriceInSun = orderOptions.min_energy_price_in_sun
    const priceInSun = Math.ceil(basePriceInSun * minRentalDuration.multiplier)
    const priceInTrx = uintToHuman(priceInSun, TRXDecimals)
    const minOrderAmountInSun = orderOptions.min_order_amount_in_sun
    const minEnergy = Math.ceil(minOrderAmountInSun / priceInSun)

    return {
        minRentalDuration,
        tgFeeAddress,
        basePriceInSun,
        priceInSun,
        priceInTrx,
        minOrderAmountInSun,
        minEnergy,
    }
}

export async function buyEnergy(energyAmount: number, sunToSpend: number, to: string, rawTGQuote: EnergyQuote, pino: Logger) {
    const trxPaymentTx = await tronWeb.transactionBuilder.sendTrx(rawTGQuote.tgFeeAddress, sunToSpend);
    const signedPaymentTx = await tronWeb.trx.sign(trxPaymentTx)

    const requestBody = {
        type: "order",
        action: "create",
        resourceid: 1, // 1 - energy, 0 - bandwidth
        order: {
            freezeto: to,
            amount: energyAmount,
            freezeperiod: 3, // legacy argument. Always 3.
            freezeperiodinblocks: rawTGQuote.minRentalDuration.blocks,
            priceinsun: rawTGQuote.priceInSun,
            priceinsunabsolute: rawTGQuote.basePriceInSun,
        },
        signedtxn: JSON.stringify(signedPaymentTx),
        api_key: TGApiKey,
    }

    pino.info({
        msg: "Making a buy order on tokengoodies!",
        data: requestBody
    })

    const response = await fetch(TGApiUrl, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        }
    })
    const data = await response.json() as any
    pino.info({
        msg: "Got a response from tokengoodies for the buy order",
        response: data
    })

    if (!data.success) {
        pino.info({ msg: "Failed to buy energy on tokengoodies :(" })
        throw new Error(`Failed to buy energy on tokengoodies! Message from TG: ${data.message}`)
    }

    pino.info({ msg: `Successfully bought ${energyAmount} energy to ${to}!` })
}
