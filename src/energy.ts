import { tronWeb } from "./constants";

const TGApiUrl = "https://www.tokengoodies.com/tronresourceexchange/exchange"
const TGApiKey = "88387866ae3847158f575b7b920e7bb2"

interface TGOrderOptions {
    min_bandwidth_price_in_sun: number,
    min_energy_price_in_sun: number,
    min_order_amount_in_sun: number,
    order_fees_address: string,
    rental_durations: { blocks: number, multiplier: number }[]
}

export async function buyEnergy(energyAmount: number, to: string) {
    let response = await fetch(TGApiUrl, {
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
    const minRentalDuration = orderOptions.rental_durations[0]
    const basePriceInSun = orderOptions.min_energy_price_in_sun
    const priceInSun = Math.ceil(basePriceInSun * minRentalDuration.multiplier)

    const minEnergy = Math.ceil(orderOptions.min_order_amount_in_sun / priceInSun)
    energyAmount = Math.max(minEnergy, energyAmount)
    const paymentAmountSun = energyAmount * priceInSun

    const trxPaymentTx = await tronWeb.transactionBuilder.sendTrx(orderOptions.order_fees_address, paymentAmountSun);
    const signedPaymentTx = await tronWeb.trx.sign(trxPaymentTx)

    response = await fetch(TGApiUrl, {
        method: 'POST',
        body: JSON.stringify({
            type: "order",
            action: "create",
            resourceid: 1, // 1 - energy, 0 - bandwidth
            order: {
                freezeto: to,
                amount: energyAmount,
                freezeperiod: 3, // legacy argument. Always 3.
                freezeperiodinblocks: minRentalDuration.blocks,
                priceinsun: priceInSun,
                priceinsunabsolute: basePriceInSun,
            },
            signedtxn: JSON.stringify(signedPaymentTx),
            api_key: TGApiKey,
        }),
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        }
    })
    const data = await response.json()
    console.log(data);
}
