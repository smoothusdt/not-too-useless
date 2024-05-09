import { BigNumber, TronWeb } from "tronweb";
import { USDTAbi } from "../usdtAbi";
import PinoConstrucor from "pino"
import { NetworkConfig } from "./networkConfig";

export const tronWeb = new TronWeb({
    fullHost: NetworkConfig.rpcUrl,
    headers: { "TRON-PRO-API-KEY": 'a40790e5-a3f3-4cbe-9362-055eaf5d594d' } as any,

    // MUST have TRX to buy energy. As well as energy to execute transfers. 
    privateKey: process.env.RELAYER_PRIVATE_KEY
})
export const RelayerBase58Address = tronWeb.address.fromPrivateKey(process.env.RELAYER_PRIVATE_KEY) as string
if (!RelayerBase58Address) {
    throw new Error('RELAYER_PRIVATE_KEY .env variable is not set or wrong')
}
console.log(`Set up the api with relayer wallet ${RelayerBase58Address} on chain ${NetworkConfig.chainName}`)

// misc constants
export const ChainID = NetworkConfig.chainId
export const ChainName = NetworkConfig.chainName

// tokens constants
export const USDTAddressBase58 = NetworkConfig.usdtAddressBase58
export const USDTDecimals = 6
export const USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58)
export const TRXDecimals = 6

// smooth constants
export const SmoothTransferFee = new BigNumber('1.5') // How much USDT users pay for each transfer
export const SmoothFeeCollector = 'TQyMmeSrADWyxZsV6YvVu6XDV8hdq72ykb'
export const SmoothRouterBase58 = NetworkConfig.routerBase58

// energy constants
export const MinAdminEnergy = NetworkConfig.relayerMinEnergy // Relayer must always have at least this amount of energy
export const DelegateTrxForApproval = NetworkConfig.delegateTrxForApproval
export const JustLendBase58 = NetworkConfig.justLendBase58

export const globalPino = PinoConstrucor({
    level: "debug"
})