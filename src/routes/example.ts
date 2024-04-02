import { app } from '../app'

app.get('/example', {}, async function (request, reply) {
    reply.send('Have a cool day')
})