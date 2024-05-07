import { BigNumber, TronWeb } from "tronweb";
import { USDTAbi } from "./usdtAbi";
import PinoConstrucor from "pino"

export const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": 'a40790e5-a3f3-4cbe-9362-055eaf5d594d' } as any,

    // MUST have TRX to buy energy. As well as energy to execute transfers. 
    privateKey: process.env.ENERGY_BUYER_PRIVATE_KEY
})
export const AdminBase58Address = tronWeb.address.fromPrivateKey(process.env.ENERGY_BUYER_PRIVATE_KEY) as string
console.log('Set up the api with admin (energy buyer) wallet:', AdminBase58Address)

export const USDTAddressBase58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
export const USDTHexAddress = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
export const USDTDecimals = 6
export const USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58)
export const TRXDecimals = 6
export const MinAdminEnergy = 150_000 // Admin must always have at least this amount of energy

// Need to fetch from chain bcs these may change when the load is high
export const UsdtToEmptyAccoutEnergy = 64895
export const UsdtToHolderEnergy = 31895

export const EmergencyTrxToEmptyAccount = BigNumber(27.2559)
export const EmergencyTrxToHolder = BigNumber(13.3959)

// Not critical, but need to update this via some pricing API
export const UsdtPerTrx = BigNumber(0.12)

// TRX needed for bandwidth of a single transaction
export const TrxSingleTxBandwidth = new BigNumber(0.345)

export const AnanasFeeUSDT = new BigNumber(0.2)
export const AnanasFeeCollector = 'TQyMmeSrADWyxZsV6YvVu6XDV8hdq72ykb'
export const SmoothRouterBase58 = 'TLhQFYzLC783A3cFAStUBNUufGy1xf1hrd' // Should be the latest router version, but maybe it's not hahaha :)

export const JustLendBase58 = 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd'

export const globalPino = PinoConstrucor({
    level: "debug"
})