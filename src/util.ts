import { ADDRESS_PREFIX, getBase58CheckAddress, hexStr2byteArray, recoverAddress } from "tronweb/utils";
import { USDTAddressBase58, USDTDecimals, tronWeb } from "./constants";
import { BigNumber } from "tronweb";

export function humanToUint(amountHuman: BigNumber, decimals: number): number {
    return amountHuman.multipliedBy(BigNumber(10).pow(decimals)).decimalPlaces(0).toNumber()
}

export async function makeUnsignedTransaction(from: string, to: string, amountHuman: BigNumber) {
    const functionSelector = 'transfer(address,uint256)';
    const amountUint = humanToUint(amountHuman, USDTDecimals)
    const parameter = [{ type: 'address', value: to }, { type: 'uint256', value: amountUint }]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(USDTAddressBase58, functionSelector, {}, parameter, from);
    return transaction
}

export function hexToBase58Address(hexAddress: string) {
    return getBase58CheckAddress(hexStr2byteArray(hexAddress.replace(/^0x/, ADDRESS_PREFIX)));
}

export function recoverSigner(txID: string, signature: string): {
    signerHexAddress: string,
    signerBase58Address: string
} {
    const signerHexAddress = recoverAddress('0x' + txID, '0x' + signature);
    const signerBase58Address = hexToBase58Address(signerHexAddress)

    return {
        signerHexAddress,
        signerBase58Address
    }
}
