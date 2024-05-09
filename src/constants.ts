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
export const MinAdminEnergy = 130_000 // Admin must always have at least this amount of energy

export const SmoothTransferFee = new BigNumber('1.5') // How much USDT users pay for each transfer
export const SmoothFeeCollector = 'TQyMmeSrADWyxZsV6YvVu6XDV8hdq72ykb'
export const SmoothRouterBase58 = 'TLhQFYzLC783A3cFAStUBNUufGy1xf1hrd'

export const JustLendBase58 = 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd'

export const globalPino = PinoConstrucor({
    level: "debug"
})