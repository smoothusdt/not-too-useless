import pg from 'pg'
import { Logger } from 'pino'
import { MaxPinAttempts } from './constants'
import { TooManyAttemptsError, UnknownDeviceIdError, WrongPinError } from './errors'

export interface IDBParams {
    user: string
    password: string
    host: string
    port: number
    database: string
    ssl?: boolean
}

export let client: pg.Client

export async function connectToDB(dbParams: IDBParams, pino: Logger) {
    client = new pg.Client(dbParams)
    await client.connect()

    pino.info({ msg: 'Connected to the database' })
}

export async function setSencryptionKey(deviceId: string, encryptionKey: string, pin: string) {
    const query = 'INSERT INTO pin_code(device_id, encryption_key, pin) VALUES ($1, $2, $3)'
    await client.query(query, [deviceId, encryptionKey, pin])
}

export async function getEncryptionKey(deviceId: string, enteredPin: string): Promise<string> {
    const query = 'SELECT pin, encryption_key, incorrect_attempts FROM pin_code WHERE device_id=$1'
    const rows = (await client.query(query, [deviceId])).rows

    if (rows.length === 0) throw new UnknownDeviceIdError()

    const storedPin: string = rows[0].pin
    const encryptionKey: string = rows[0].encryption_key
    const incorrectAttempts: number = rows[0].incorrect_attempts

    if (incorrectAttempts >= MaxPinAttempts) throw new TooManyAttemptsError()

    if (enteredPin === storedPin) { // all good
        // Reset incorrectAttempts
        await client.query('UPDATE pin_code SET incorrect_attempts=0 WHERE device_id=$2', [deviceId])
        return encryptionKey // and return the key
    }

    // implicit else. Wrong pin. Increase number of incorrect attempts
    const updateQuery = 'UPDATE pin_code SET incorrect_attempts=$1 WHERE device_id=$2'
    await client.query(updateQuery, [incorrectAttempts + 1, deviceId])
    throw new WrongPinError(MaxPinAttempts - incorrectAttempts - 1)
}