import { BigNumber } from "tronweb"

interface NetworkConfigInterface {
    chainId: number
    chainName: string
    rpcUrl: string
    usdtAddressBase58: string
    justLendBase58: string
    routerBase58: string
    relayerMinEnergy: number
    delegateTrxForApproval: number
    paySunForApproval: number
    explorerUrl: string
    stakedSunPerEnergyUnit: BigNumber
}

const MainnetConfig: NetworkConfigInterface = {
    chainId: 728126428,
    chainName: 'mainnet',
    rpcUrl: 'https://api.trongrid.io',
    usdtAddressBase58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    justLendBase58: 'TU2MJ5Veik1LRAgjeSzEdvmDYx7mefJZvd',
    routerBase58: '', // TODO: deploy the updated version
    relayerMinEnergy: 150_000,
    delegateTrxForApproval: 8000_000000,
    paySunForApproval: 60_000000,
    explorerUrl: 'https://tronscan.org/#',
    stakedSunPerEnergyUnit: new BigNumber('79260')
}

const ShastaConfig: NetworkConfigInterface = {
    chainId: 2494104990,
    chainName: 'shasta',
    rpcUrl: 'https://api.shasta.trongrid.io',
    usdtAddressBase58: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
    justLendBase58: 'TJRrrftRMv5mF2iv7C6FtFuqgbHjvRxARd',
    routerBase58: 'TFAiKcphiJwyLNw2iQ9iJJauvz7PboisEH',
    relayerMinEnergy: 0,
    delegateTrxForApproval: 1000_000000,
    paySunForApproval: 10_000000,
    explorerUrl: 'https://shasta.tronscan.org/#',
    stakedSunPerEnergyUnit: new BigNumber('11294')
}

export let NetworkConfig: NetworkConfigInterface
const chain = process.env.CHAIN

if (chain === 'mainnet') {
    NetworkConfig = MainnetConfig
} else if (chain === 'shasta') {
    NetworkConfig = ShastaConfig
} else {
    throw new Error('CHAIN .env variable not set or wrong')
}
