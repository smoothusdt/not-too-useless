import { BigNumber, TronWeb } from "tronweb";
import { USDTAbi } from "../usdtAbi";
import PinoConstrucor from "pino"
import { NetworkConfig } from "./networkConfig";
import { JustLendAbi } from "../justLendAbi";

export const globalPino = PinoConstrucor({
    level: "debug"
})

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
globalPino.info({ msg: `Set up the api with relayer wallet ${RelayerBase58Address} on chain ${NetworkConfig.chainName}` })

// misc constants
export const EnvironmentName = process.env.ENVIRONMENT_NAME // 'alexey-mac', 'dillon-mac', 'hosted-render', etc.
if (!EnvironmentName) {
    throw new Error('ENVIRONMENT_NAME .env variable is not set')
}
export const TRXPrice = new BigNumber('0.12') // USD per TRX
export const NotificationsChatId = NetworkConfig.notificationsChatId
export const MaxPinAttempts = 3
export const DatabaseName = NetworkConfig.databaseName

// chain constants
export const ChainID = NetworkConfig.chainId
export const ChainName = NetworkConfig.chainName
export const ExplorerUrl = NetworkConfig.explorerUrl

// tokens constants
export const USDTAddressBase58 = NetworkConfig.usdtAddressBase58
export const USDTDecimals = 6
export const USDTContract = tronWeb.contract(USDTAbi, USDTAddressBase58)
export const TRXDecimals = 6

// smooth onchain constants
export const SmoothTransferFee = new BigNumber('1.5') // How much USDT users pay for each transfer
export const SmoothFeeCollector = 'TPvSv9BofZrXP4NtkuSmY6X4qFt41yEF6x'
export const SmoothRouterBase58 = NetworkConfig.routerBase58

// energy constants
export const DelegateSunForApproval = NetworkConfig.delegateSunForApproval
export const PaySunForApproval = NetworkConfig.paySunForApproval
export const JustLendBase58 = NetworkConfig.justLendBase58
export const JustLendCreator = NetworkConfig.justLendCreator
export const JustLendContract = tronWeb.contract(JustLendAbi, JustLendBase58)
export const StakedSunPerEnergyUint = NetworkConfig.stakedSunPerEnergyUnit // how much sun (1 sun = 1e-6 trx) we need to stake to get 1 energy unit per day
export const JL_SCALE = new BigNumber(10).pow(18) // JL = JustLend.
export const RentEnergyFor = new BigNumber(86400 * 7) // extend energy rental for 7 days every time
export const ExtendIfRemainsLessThan = new BigNumber(86400 * 2) // extend energy rental if there are less than 2 days until liquidation
export const RelayerCheckLoopInterval = 3600 * 10 * 1000 // 10 hours in milliseconds. Must be less than ExtendIfRemainsLessThan so that we have some time to extend rent.
export const MinRelayerEnergy = NetworkConfig.minRelayerEnergy // buy more energy if we run lower than this number
export const EnergyTopUp = NetworkConfig.energyTopUp // how much energy to buy if the balance is lower than MinRelayerEnergy
