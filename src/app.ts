import fastify from 'fastify'
import cors from '@fastify/cors'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import 'dotenv/config'
import { globalPino } from "./constants"

export const app = fastify().withTypeProvider<TypeBoxTypeProvider>()

app.register(cors, {
    // put your options here
    origin: true,
})

// Basic route to help monitor the state of the api server
app.get('/', function (request, reply) {
    reply.send('ha-ha!')
})

app.setErrorHandler(function (error, request, reply) {
    globalPino.error({ msg: "Got an error!", errorName: error.name, errorMessage: error.message, errorStack: error.stack })
    return reply.code(500).send({ success: false, error: error.message })
})

// 404 handler
app.setNotFoundHandler((request, reply) => {
    const message = `Route ${request.method}:${request.url} not found`
    reply.code(404).send({
        message: message,
        error: 'Not Found',
        statusCode: 404,
    })
})
