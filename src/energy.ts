import { Logger } from "pino";
import { DelegateTrxForApproval, JustLendBase58, JustLendContract, LiquidationReserveSeconds, PaySunForApproval, RelayerBase58Address, StakedSunPerEnergyUint, tronWeb } from "./constants";
import { broadcastTx, makeBlockHeader } from "./network";
import { BigNumber } from "tronweb";

// JL = JustLend
const JLScale = new BigNumber(10).pow(18)

export async function rentEnergy(to: string, sunToDelegate: number, sunToPay: number, pino: Logger): Promise<string> {
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
        JustLendBase58,
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
        signedTx
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
        DelegateTrxForApproval,
        PaySunForApproval,
        pino,
    )
}

export async function finishEnergyRentalForApproval(wasRentedTo: string, pino: Logger): Promise<string> {
    const functionSelector = 'returnResource(address,uint256,uint256)';
    const parameter = [
        { type: 'address', value: wasRentedTo },
        { type: 'uint256', value: DelegateTrxForApproval }, // return the delegated TRX
        { type: 'uint256', value: '1' }, // resourceType - always 1 for energy
    ]
    const startTs = Date.now()
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        JustLendBase58,
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
        signedTx
    })
    await broadcastTx(signedTx, pino)
    pino.info({
        msg: "Finished energy rental!!!",
        wasRentedTo
    })

    return signedTx.txID
}

// All units are uint (not human-readable)
export interface RelayerEnergyStatus {
    securityDeposit: BigNumber
    rentedAmount: BigNumber
    rentalRate: BigNumber
    minFee: BigNumber
    feeRatio: BigNumber
    fee: BigNumber
    secondsUntilLiquidation: BigNumber
}

// Queries JustLend's smart contract.
// Doesn't need to be fast since it always happens in the backdground
// and does not influence response speed.
export async function queryRelayerEnergyStatus(pino: Logger): Promise<RelayerEnergyStatus> {
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
        throw new Error('Relayer rented amount for energy is zero, which is extremely bad!') 
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
        feeRatio
    })

    // This is just a copy of the calculation that happens inside the JustLend contract
    const ratioFee = rentedAmount.multipliedBy(feeRatio).dividedBy(JLScale)
    const fee = BigNumber.max(minFee, ratioFee)
    const secondsUntilLiquidation = securityDeposit
        .minus(fee) // reserved potential liquidation fee
        .dividedBy(rentedAmount.multipliedBy(rentalRate)) // How much we owe per second
        .multipliedBy(JLScale) // 1e18
        .minus(LiquidationReserveSeconds) // reserved in addition to `fee`

    pino.info({
        msg: 'Seconds until relayer energy rental liquidation',
        secondsUntilLiquidation
    })

    return {
        securityDeposit,
        rentedAmount,
        rentalRate,
        minFee,
        feeRatio,
        fee,
        secondsUntilLiquidation
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
    relayerStatus: RelayerEnergyStatus,
    pino: Logger
): Promise<string> {
    pino.info({
        msg: 'Renting energy for relayer',
        energyToRent
    })
    const sunToDelegate = energyToRent.multipliedBy(StakedSunPerEnergyUint)

    // How much sun we need to pay for the given rent duration
    const sunForRent = sunToDelegate.multipliedBy(relayerStatus.rentalRate).multipliedBy(durationSeconds).dividedBy(JLScale)

    // Sun to deposit for the liquidation fee reserve
    const liquidationFeeReserve = sunToDelegate.multipliedBy(relayerStatus.feeRatio).dividedBy(JLScale)

    // Sun to deposit for the liquidation 1 day reserve
    const liquidationDayReserve = sunToDelegate.multipliedBy(relayerStatus.rentalRate).multipliedBy(LiquidationReserveSeconds).dividedBy(JLScale)

    const totalSunForLiquidationReserve = liquidationFeeReserve.plus(liquidationDayReserve)

    const sunToPay = sunForRent.plus(totalSunForLiquidationReserve)

    pino.info({
        msg: 'Calculated amounts for additional energy rental',
        energyToRent,
        durationSeconds,
        relayerStatus,
        sunToDelegate,
        sunForRent,
        liquidationFeeReserve,
        liquidationDayReserve,
        totalSunForLiquidationReserve,
        sunToPay
    })

    return await rentEnergy(
        RelayerBase58Address,
        sunToDelegate.decimalPlaces(0).toNumber(),
        sunToPay.decimalPlaces(0).toNumber(),
        pino,
    )
}