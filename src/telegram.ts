import { Logger } from "pino"
import { ChainName, EnvironmentName } from "./constants"

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN
if (!TG_BOT_TOKEN) {
    throw new Error('TG_BOT_TOKEN .env variable is not set')
}

export const BotUrl = 'https://api.telegram.org/bot' + TG_BOT_TOKEN
const NotificationsChatId = -4249996549

export async function sendTgNotification(message: string, pino: Logger) {
    message = `On ${ChainName}, ${EnvironmentName}\\.\n` + message
    pino.info({
        msg: 'Sending a telegram notification',
        message
    })
    const url = `${BotUrl}/sendMessage`
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            chat_id: NotificationsChatId,
            text: message,
            parse_mode: 'MarkdownV2',
            link_preview_options: {
                is_disabled: true
            }
        }),
        headers: {
            'Content-Type': 'application/json',
        }
    })
    const data = await response.json() as any
    if (data.ok === true) {
        pino.info({
            msg: 'Successfully sent a telegram notification',
            message
        })
    } else {
        pino.error({
            msg: 'Failed to send a telegram notification!!!',
            tgResponse: data,
        })
        throw new Error('Failed to send a telegram notification!')
    }
}
