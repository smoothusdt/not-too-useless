import { Logger } from "pino";
import { DelegateTrxForApproval, JustLendBase58, tronWeb } from "./constants";
import { broadcastTx } from "./network";

// Rents energy on JustLendDAO.
export async function rentEnergyForApproval(to: string, pino: Logger) {
    const functionSelector = 'rentResource(address,uint256,uint256)';
    const parameter = [
        { type: 'address', value: to },
        { type: 'uint256', value: DelegateTrxForApproval }, // requesting some TRX to get delegated (~100k energy)
        { type: 'uint256', value: '1' }, // resourceType - always 1 for energy
    ]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        JustLendBase58,
        functionSelector,
        { callValue: 60_000000 }, // transferring 60 trx for the rent + security deposit. Should be enough unless prices on JustLendDAO spike hugely.  
        parameter,
    );
    const signedTx = await tronWeb.trx.sign(transaction)
    pino.info({
        msg: "Computed & signed a rent-energy transaction",
        signedTx
    })
    await broadcastTx(signedTx, pino)
    pino.info({
        msg: "Rented energy!!!",
        to,
    })
}

export async function finishEnergyRentalForApproval(wasRentedTo: string, pino: Logger) {
    const functionSelector = 'returnResource(address,uint256,uint256)';
    const parameter = [
        { type: 'address', value: wasRentedTo },
        { type: 'uint256', value: DelegateTrxForApproval }, // return the delegated TRX
        { type: 'uint256', value: '1' }, // resourceType - always 1 for energy
    ]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        JustLendBase58,
        functionSelector,
        {},  
        parameter,
    );
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
}