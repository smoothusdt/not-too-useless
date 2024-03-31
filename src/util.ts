import { ADDRESS_PREFIX, getBase58CheckAddress, hexStr2byteArray, recoverAddress } from "tronweb/utils";
import { USDTAddressBase58, USDTContract, tronWeb } from "./constants";

export async function makeUnsignedTransaction(from: string, to: string, amountHuman: string) {
    const functionSelector = 'transfer(address,uint256)';
    const parameter = [{ type: 'address', value: to }, { type: 'uint256', value: 100 }]
    const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(USDTAddressBase58, functionSelector, {}, parameter);
    console.log('Transaction:', transaction)
    console.log('Serialized transaction:', JSON.stringify(transaction))

    const data = '0x' + transaction.raw_data.contract[0].parameter.value.data;
    // console.log('prepared data:', data)
    console.log('contract:', transaction.raw_data.contract[0].parameter.value)
}

export function hexToBase58Address(hexAddress: string) {
    return getBase58CheckAddress(hexStr2byteArray(hexAddress.replace(/^0x/, ADDRESS_PREFIX)));
}

export function recoverSigner() {
    const txID = '7649536d483e526264f84bf79216e9efc66e7a8345eb458911f35cbd6c0cf0b9'
    const signature = 'fc429a3469766ebc712c79273019dd4c8f3b3ef89a7f407b5558a0dc6f8b1d07219bb68e4046c01590d7e87f11f36000213df75538f0b429899986936f4dc1561c'
    const hexAddress = recoverAddress('0x' + txID, '0x' + signature);
    console.log('Recovered hex address:', hexAddress)
    const base58Address = hexToBase58Address(hexAddress)
    console.log('Recovered base58b address:', base58Address)
}
