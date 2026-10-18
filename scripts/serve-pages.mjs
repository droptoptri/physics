import express from 'express'
import { resolve } from 'node:path'

const app = express()
app.use('/physics', express.static(resolve('dist-pages')))
app.use((_req, res) => res.status(404).end())
app.listen(3102, '127.0.0.1', () => console.log('Static Pages test server on port 3102'))
