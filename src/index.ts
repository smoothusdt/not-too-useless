// load .env variables. Has to be at the very very beginning.
import dotenv from "dotenv"
dotenv.config()

import { app } from './app'
import './routes'
import { globalPino } from "./constants"
import { updateLatestConfirmedBlockLoop } from "./network"
import { checkRelayerStateLoop } from "./energy"
import { sendTelegramNotification } from "./notifications"

const port = Number(process.env.PORT ?? '3000')
const host = process.env.HOST ?? '0.0.0.0'

updateLatestConfirmedBlockLoop(globalPino)
checkRelayerStateLoop(globalPino)
sendTelegramNotification('API started', globalPino)

// Run the server!
app.listen({ port, host }, function (err) {
    if (err) {
        console.error(err)
        process.exit(1)
    } else {
        console.log(`Server is now listening on port ${port}`)
    }
})
