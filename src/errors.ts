export abstract class SmoothError extends Error {
    // Should always be overriden.
    // There is  no way to enforce a static property to be overridden in typescript :(
    static code: string

    toJson(): any {
        return {
            code: (this.constructor as any).code
        }
    }
}

export abstract class PinError extends SmoothError { }

export class UnknownDeviceIdError extends PinError {
    static code = "unknown-device-id";
}

export class TooManyAttemptsError extends PinError {
    static code = "too-many-attempts"
}

export class WrongPinError extends PinError {
    static code = "wrong-pin"
    remainingAttempts: number

    constructor(remainingAttempts: number) {
        super()
        this.remainingAttempts = remainingAttempts
    }

    toJson(): any {
        return {
            code: (this.constructor as any).code,
            remainingAttempts: this.remainingAttempts
        }
    }
}

const AllErrors = [
    UnknownDeviceIdError,
    TooManyAttemptsError,
    WrongPinError,
]

export const CodeToError = {}
AllErrors.forEach((errType) => {
    // CodeToError[errType.]
})