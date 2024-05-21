import { BigNumber, TronWeb } from "tronweb";
import { USDTAbi } from "../usdtAbi";
import PinoConstrucor from "pino"
import { NetworkConfig } from "./networkConfig";
import { JustLendAbi } from "../justLendAbi";

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
export const EnvironmentName = process.env.ENVIRONMENT_NAME // 'alexey-mac', 'dillon-mac', 'hosted-render', etc.
if (!EnvironmentName) {
    throw new Error('ENVIRONMENT_NAME .env variable is not set')
}
export const TRXPrice = new BigNumber('0.12') // USD per TRX

// chain constants
export const ChainID = NetworkConfig.chainId
export const ChainName = NetworkConfig.chainName
export const ExplorerUrl = NetworkConfig.explorerUrl


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
export const DelegateTrxForApproval = NetworkConfig.delegateTrxForApproval
export const PaySunForApproval = NetworkConfig.paySunForApproval
export const JustLendBase58 = NetworkConfig.justLendBase58
export const JustLendContract = tronWeb.contract(JustLendAbi, JustLendBase58)
export const StakedSunPerEnergyUint = NetworkConfig.stakedSunPerEnergyUnit // how much sun (1 sun = 1e-6 trx) we need to stake to get 1 energy unit per day
export const JL_SCALE = new BigNumber(10).pow(18) // JL = JustLend.
export const RentEnergyFor = new BigNumber(86400 * 7) // always have 1 week of rental reserved
export const ExtendIfRemainsLessThan = new BigNumber(86400 * 2) // extend energy rental if there are less than 2 days until liquidation
export const RelayerCheckLoopInterval = 3600 * 10 * 1000 // 10 hours in milliseconds. Must be less than ExtendIfRemainsLessThan so that we have some time to extend rent.
export const MinRelayerEnergy = 180_000 // buy more energy if we run lower than this number

export const globalPino = PinoConstrucor({
    level: "debug"
})