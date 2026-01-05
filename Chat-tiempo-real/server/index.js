import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()
const PORT = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: '*'
  }
})

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mensajeriainst',
  port: process.env.DB_PORT || 3306
}

let connection

try {
  connection = await mysql.createConnection(dbConfig)
  console.log('Conectado a la base de datos')
  
  await connection.query('SELECT 1 FROM messages LIMIT 1')
  console.log('Tabla messages verificada')
} catch (error) {
  console.error('Error conectando a la base de datos:', error)
  process.exit(1)
}

app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

io.on('connection', async (socket) => {
  const username = socket.handshake.auth.username ?? 'anonymous'
  console.log('Usuario conectado:', socket.id, 'Username:', username)
  
  try {
    const serverOffset = socket.handshake.auth.serverOffset ?? 0
    const [results] = await connection.query(
      'SELECT id, content, user FROM messages WHERE id > ? ORDER BY id ASC LIMIT 50',
      [serverOffset]
    )
    
    results.forEach(row => {
      socket.emit('chat message', row.content, row.id.toString(), row.user)
    })
    
    console.log(`Mensajes anteriores enviados: ${results.length}`)
  } catch (error) {
    console.error('Error cargando mensajes:', error)
  }

  socket.on('chat message', async (msg) => {
    console.log('Mensaje recibido de', username, ':', msg)
    
    try {
      const [result] = await connection.query(
        'INSERT INTO messages (content, user) VALUES (?, ?)',
        [msg, username]
      )
      
      console.log('Mensaje guardado con ID:', result.insertId)
      
      io.emit('chat message', msg, result.insertId.toString(), username)
      console.log('Mensaje enviado a todos los clientes')
    } catch (error) {
      console.error('Error guardando mensaje:', error)
      socket.emit('chat error', 'Error al enviar mensaje')
    }
  })

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
  console.log('Abre multiples pestanas del navegador en esa URL para probar')
})

process.on('SIGINT', async () => {
  console.log('Cerrando servidor...')
  await connection.end()
  server.close()
  process.exit(0)
})