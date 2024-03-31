import { BigNumber, TronWeb } from "tronweb";
import { USDTAbi } from "./usdtAbi";

export const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    headers: { "TRON-PRO-API-KEY": 'a40790e5-a3f3-4cbe-9362-055eaf5d594d' } as any,
    privateKey: '01' // doesn't matter
})

export const USDTAddressBase58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
export const USDTHexAddress = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
export const USDTDecimals = 6
export const USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58); 

export const MinEnergyOnTG = new BigNumber(56000)

// TRX needed for bandwidth of a single transaction
export const TrxSingleTxBandwidth = new BigNumber(0.4)

export const AnanasFeeUSDT = new BigNumber(0.2)
export const AnanasFeeCollector = 'TQyMmeSrADWyxZsV6YvVu6XDV8hdq72ykb'

