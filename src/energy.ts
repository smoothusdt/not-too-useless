import { Logger } from "pino";
import { ActivationProxyBase58, DelegateSunForApproval, ExtendIfRemainsLessThan, JL_SCALE, JustLendBase58, JustLendContract, MinRelayerEnergy, PaySunForApproval, RelayerBase58Address, RelayerCheckLoopInterval, RentEnergyFor, StakedSunPerEnergyUint, TRXDecimals, tronWeb } from "./constants";
import { broadcastTx, makeBlockHeader } from "./network";
import { BigNumber } from "tronweb";
import { uintToHuman } from "./util";
import { produceError, sendTelegramNotification } from "./notifications";
import { Mutex } from "async-mutex";

export async function rentEnergy(
    to: string,
    sunToDelegate: number,
    sunToPay: number,
    contractToCall: string,
    pino: Logger,
): Promise<string> {
    pino.info({
        msg: 'Will execute a transaction to rent energy on JustLendDAO',
        to,
        sunToDelegate,
        sunToPay,
    })
    const functionSelector = 'rentResource(address,uint256,uint256)';
    const parameter = [
        { type: 'address', value: to },
        { type: 'uint256', value: sunToDelegate }, // requesting some TRX to get delegated (~100k energy)
        { type: 'uint256', value: '1' }, // resourceType - always 1 for energy
    ]
    const startTs = Date.now()
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        contractToCall,
        functionSelector,
        {
            callValue: sunToPay, // transferring 60 trx for the rent + security deposit.Should be enough unless prices on JustLendDAO spike hugely.
            blockHeader: await makeBlockHeader(pino),
            txLocal: true
        },
        parameter,
    );
    pino.info({
        msg: 'Time to build a rent energy tx',
        time: Date.now() - startTs
    })
    const signedTx = await tronWeb.trx.sign(transaction)
    pino.info({
        msg: "Computed & signed a rent-energy transaction",
    })
    await broadcastTx(signedTx, pino)
    pino.info({
        msg: "Rented energy!!!",
    })

    return signedTx.txID
}

// Rents energy on JustLendDAO to make an approval transaction
// from the user's wallet.
export async function rentEnergyForApproval(to: string, pino: Logger): Promise<string> {
    return await rentEnergy(
        to,
        DelegateSunForApproval,
        PaySunForApproval,
        ActivationProxyBase58,
        pino,
    )
}

export async function returnEnergy(
    wasRentedTo: string,
    returnSun: number,
    contractToCall: string,
    pino: Logger,
): Promise<string> {
    const functionSelector = 'returnResource(address,uint256,uint256)';
    const parameter = [
        { type: 'address', value: wasRentedTo },
        { type: 'uint256', value: returnSun }, // return the delegated TRX
        { type: 'uint256', value: '1' }, // resourceType - always 1 for energy
    ]
    const startTs = Date.now()
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        contractToCall,
        functionSelector,
        {
            blockHeader: await makeBlockHeader(pino),
            txLocal: true
        },
        parameter,
    );
    pino.info({
        msg: 'Time to build a finish rental tx',
        time: Date.now() - startTs
    })
    const signedTx = await tronWeb.trx.sign(transaction)
    pino.info({
        msg: "Computed & signed a return-energy transaction",
    })
    await broadcastTx(signedTx, pino)
    pino.info({
        msg: "Finished energy rental!!!",
        wasRentedTo
    })

    return signedTx.txID
}

export async function finishEnergyRentalForApproval(wasRentedTo: string, pino: Logger): Promise<string> {
    return await returnEnergy(
        wasRentedTo,
        DelegateSunForApproval,
        ActivationProxyBase58,
        pino
    )
}

// All units are uint (not human-readable)
export interface EnergyRentalStatus {
    securityDeposit: BigNumber
    rentedAmount: BigNumber
    rentalRate: BigNumber
    minFee: BigNumber
    feeRatio: BigNumber
    fee: BigNumber
    secondsUntilLiquidation: BigNumber
    dailySpentTrx: BigNumber
    sunPerDayPrice: BigNumber
}

// Queries JustLend's smart contract.
// Doesn't need to be fast since it always happens in the backdground
// and does not influence response speed.
export async function queryRelayerEnergyRentalStatus(pino: Logger): Promise<EnergyRentalStatus> {
    pino.info({
        msg: 'Querying relayer energy status on JustLendDAO'
    })

    const rentInfo = await JustLendContract.methods.getRentInfo(
        RelayerBase58Address, // who pays for the rent
        RelayerBase58Address, // who receives energy
        1, // resource type (1 = energy)
    ).call()
    // This is the latest security deposit estimate.
    // The amount that we paid for the past rental has already been subtracted.
    const securityDeposit = new BigNumber(rentInfo[0].toString())

    const rental = await JustLendContract.methods.rentals(
        RelayerBase58Address, // who pays for the rent
        RelayerBase58Address, // who receives energy
        1, // resource type (1 = energy)
    ).call()
    const rentedAmount = new BigNumber(rental.amount.toString()) // rented TRX (in Sun)

    if (rentedAmount.eq(0)) {
        throw new Error('Relayer delegated TRX is zero, which is extremely bad!')
    }

    const rentalRateRaw = await JustLendContract.methods._rentalRate(
        0, // extra mount - we don't care, we just want to se the current rate
        1, // resource type (1 = energy)
    ).call()
    const rentalRate = new BigNumber(rentalRateRaw.toString())

    const minFeeRaw = await JustLendContract.methods.minFee().call()
    const minFee = new BigNumber(minFeeRaw.toString()) // currently minFee is 40 TRX

    const feeRatioRaw = await JustLendContract.methods.feeRatio().call()
    const feeRatio = new BigNumber(feeRatioRaw.toString()) // currently feeRatio is 5e14

    pino.info({
        msg: 'Queried all the relevant relayer energy data',
        securityDeposit,
        rentedAmount,
        rentalRate,
        minFee,
        feeRatio,
    })

    // This is just a copy of the calculation that happens inside the JustLend contract
    const ratioFee = rentedAmount.multipliedBy(feeRatio).dividedBy(JL_SCALE)
    const fee = BigNumber.max(minFee, ratioFee)
    const secondsUntilLiquidation = securityDeposit
        .minus(fee) // reserved potential liquidation fee
        .dividedBy(rentedAmount.multipliedBy(rentalRate)) // How much we owe per second
        .multipliedBy(JL_SCALE) // 1e18
        .minus(86400) // 1 day - reserved for liquidation in addition to `fee`

    // How much SUN we need to pay to get 1 energy unit per day
    const sunPerDayPrice = StakedSunPerEnergyUint.multipliedBy(rentalRate).multipliedBy(86400).dividedBy(JL_SCALE)
    
    // How much TRX (human amount) we are currently spending every day on energy rental
    const dailySpentTrx = rentedAmount.multipliedBy(rentalRate).dividedBy(JL_SCALE).multipliedBy(86400).shiftedBy(-6)

    pino.info({
        msg: 'Calculated relayer energy rental related values',
        secondsUntilLiquidation,
        dailySpentTrx,
        sunPerDayPrice
    })

    return {
        securityDeposit,
        rentedAmount,
        rentalRate,
        minFee,
        feeRatio,
        fee,
        secondsUntilLiquidation,
        dailySpentTrx,
        sunPerDayPrice
    }
}

// Rents energy for the relayer on JsutLend.
// IMPORTANT! The relayer MUST already have energy rented.
// Check JustLend contract's rentResource function to have a better chance of
// understanding what the heck is going on here (no guarantees that you will understand though
// because it's so overcomplicated).
export async function rentEnergyForRelayer(
    energyToRent: BigNumber,
    durationSeconds: BigNumber,
    relayerStatus: EnergyRentalStatus,
    pino: Logger
): Promise<string> {
    pino.info({
        msg: 'Renting energy for relayer',
        energyToRent
    })
    const extraSunToDelegate = energyToRent.multipliedBy(StakedSunPerEnergyUint)

    // Total sun delegated after performing this additional deposit
    const sunDelegatedAfterDeposit = relayerStatus.rentedAmount.plus(extraSunToDelegate)

    // Sun needede to pay for all of the delegated energy for the given rent duration
    const sunToPayForRent = sunDelegatedAfterDeposit.multipliedBy(relayerStatus.rentalRate).multipliedBy(durationSeconds).dividedBy(JL_SCALE)

    let liquidationFeeDeposit = sunDelegatedAfterDeposit.multipliedBy(relayerStatus.feeRatio).dividedBy(JL_SCALE)
    liquidationFeeDeposit = BigNumber.max(liquidationFeeDeposit, relayerStatus.minFee)

    // Sun to deposit for the liquidation 1 day reserve
    const liquidationDayDeposit = sunDelegatedAfterDeposit.multipliedBy(relayerStatus.rentalRate).multipliedBy(86400).dividedBy(JL_SCALE)

    const totalSunForLiquidationDeposit = liquidationFeeDeposit.plus(liquidationDayDeposit)

    // How much sun needs to be deposited in JustLend after this transaction
    const totalSunToBeDeposited = sunToPayForRent.plus(totalSunForLiquidationDeposit)

    const sunToDepositNow = BigNumber.max(0, totalSunToBeDeposited.minus(relayerStatus.securityDeposit))

    pino.info({
        msg: 'Calculated amounts for additional energy rental',
        extraSunToDelegate,
        sunDelegatedAfterDeposit,
        sunToPayForRent,
        liquidationFeeDeposit,
        liquidationDayDeposit,
        totalSunForLiquidationDeposit,
        totalSunToBeDeposited,
        sunToDepositNow,
    })

    return await rentEnergy(
        RelayerBase58Address,
        extraSunToDelegate.decimalPlaces(0).toNumber(),
        sunToDepositNow.decimalPlaces(0).toNumber(),
        JustLendBase58,
        pino,
    )
}

export async function returnRelayerEnergy(
    energyToReturn: BigNumber,
    pino: Logger
): Promise<string> {
    pino.info({
        msg: 'Returning some of the relayer rented energy',
        energyToReturn
    })
    const sunToReturn = energyToReturn.multipliedBy(StakedSunPerEnergyUint)
    pino.info({
        msg: 'Calculated how much sun to return',
        sunToReturn
    })
    return await returnEnergy(
        RelayerBase58Address,
        sunToReturn.decimalPlaces(0).toNumber(),
        JustLendBase58,
        pino
    )
}

export async function queryDetailedRelayerState(pino: Logger) {
    pino.info({
        msg: 'Fetching & logging Smooth USDT Relayer state'
    })
    const relayerResources = await tronWeb.trx.getAccountResources(RelayerBase58Address)
    pino.info({
        msg: "Fetched relayer resources",
        relayerResources,
    })

    const relayerEenergyUsed: number = relayerResources.EnergyUsed || 0;
    const relayerEnergyLimit: number = relayerResources.EnergyLimit || 0;
    const relayerEnergyBalance = relayerEnergyLimit - relayerEenergyUsed
    const energyPercentageUsed = (relayerEenergyUsed / relayerEnergyLimit * 100).toFixed(2)

    const relayerTrxBalance = uintToHuman(await tronWeb.trx.getBalance(RelayerBase58Address), TRXDecimals).toFixed(0)

    const relayerStatus = await queryRelayerEnergyRentalStatus(pino)
    const liquidatesIn = (relayerStatus.secondsUntilLiquidation.toNumber() / 86400).toFixed(2)

    const willBuyMoreEnergy = relayerEnergyBalance < MinRelayerEnergy
    const willExtendRental = relayerStatus.secondsUntilLiquidation.lt(ExtendIfRemainsLessThan)

    const message = `Relayer energetical state.
Relayer's energy: ${relayerEenergyUsed} / ${relayerEnergyLimit} (${energyPercentageUsed}%) is used. ${relayerEnergyBalance} energy is available.
Relayer's balance: ${relayerTrxBalance} TRX.
Energy rental liquidates in: ${liquidatesIn} days.
Will buy more energy: ${willBuyMoreEnergy} (threshold: ${MinRelayerEnergy} energy).
Will extend energy rental: ${willExtendRental}.`
    await sendTelegramNotification(message, pino)

    return {
        willBuyMoreEnergy,
        willExtendRental,
        relayerStatus
    }
}

// Using a mutex so that we don't accidentally double-buy energy if 
// checkRelayerState is called 2 times simultaneously
const CheckRelayerMutex = new Mutex()

// A function that can be fired from anywhere at any time to log
// the current state of Smooth USDT into telegram.
// If needed, it buys more energy.
export async function checkRelayerState(pino: Logger) {
    const releaseMutex = await CheckRelayerMutex.acquire()
    try {
        const { willBuyMoreEnergy, willExtendRental, relayerStatus } = await queryDetailedRelayerState(pino) 
        if (willBuyMoreEnergy || willExtendRental) {
            // If no need to buy more energy then we simply extend the rental
            const energyToBuy = willBuyMoreEnergy ? new BigNumber(500000) : BigNumber(0)
            await rentEnergyForRelayer(
                energyToBuy,
                RentEnergyFor,
                relayerStatus,
                pino
            )
            await sendTelegramNotification('Rented more energy for the relayer!', pino)
            await queryDetailedRelayerState(pino) // send a notification to telegram with the updated relayer state
        }
    } finally {
        releaseMutex()
    }
}

export async function checkRelayerStateLoop(pino: Logger) {
    for (; ;) {
        try {
            await checkRelayerState(pino)
        } catch (error: any) {
            const message = `Could not check relayer status due to "${error.message}"!!!`
            pino.error({
                msg: message,
                error: error.message
            })
            await sendTelegramNotification(`Alert!!! ${message}`, pino)
        }
        await new Promise(resolve => setTimeout(resolve, RelayerCheckLoopInterval))
    }
}