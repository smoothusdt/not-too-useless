import fastify from 'fastify'
import cors from '@fastify/cors'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import 'dotenv/config'

export const app = fastify().withTypeProvider<TypeBoxTypeProvider>()

app.register(cors, {
    // put your options here
    origin: true,
})

// Basic route to help monitor the state of the api server
app.get('/', function (request, reply) {
    reply.send('ha-ha!')
})

// 404 handler
app.setNotFoundHandler((request, reply) => {
    const message = `Route ${request.method}:${request.url} not found`
    console.log(message)
    reply.code(404).send({
        message: message,
        error: 'Not Found',
        statusCode: 404,
    })
})
