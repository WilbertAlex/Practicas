import { io } from 'https://cdn.socket.io/4.3.2/socket.io.esm.min.js'

const elements = {
  form: document.getElementById('form'),
  input: document.getElementById('input'),
  messages: document.getElementById('messages'),
  status: document.getElementById('status'),
  sendBtn: document.getElementById('send-btn'),
  usernameDisplay: document.getElementById('username-display')
}

async function getUsername() {
  let username = localStorage.getItem('username')
  
  if (username) {
    console.log('Usuario existente:', username)
    return username
  }

  try {
    const response = await fetch('https://random-data-api.com/api/users/random_user')
    const data = await response.json()
    username = data.username
  } catch (error) {
    console.error('Error obteniendo usuario:', error)
    username = 'user_' + Math.random().toString(36).substring(2, 11)
  }

  localStorage.setItem('username', username)
  console.log('Nuevo usuario:', username)
  return username
}

function updateConnectionStatus(isConnected) {
  if (isConnected) {
    elements.status.textContent = 'Conectado'
    elements.status.className = 'connected'
    elements.sendBtn.disabled = false
  } else {
    elements.status.textContent = 'Desconectado'
    elements.status.className = 'disconnected'
    elements.sendBtn.disabled = true
  }
}

function createMessageElement(content, username) {
  const li = document.createElement('li')
  
  const p = document.createElement('p')
  p.textContent = content
  
  const small = document.createElement('small')
  small.textContent = username
  
  li.appendChild(p)
  li.appendChild(small)
  
  return li
}

function displayMessage(content, username) {
  const messageElement = createMessageElement(content, username)
  elements.messages.appendChild(messageElement)
  elements.messages.scrollTop = elements.messages.scrollHeight
}

function clearInput() {
  elements.input.value = ''
  elements.input.focus()
}

function setupSocketListeners(socket) {
  socket.on('connect', () => {
    console.log('Conectado al servidor')
    updateConnectionStatus(true)
  })

  socket.on('disconnect', () => {
    console.log('Desconectado del servidor')
    updateConnectionStatus(false)
  })

  socket.on('chat message', (msg, serverOffset, username) => {
    console.log('Mensaje recibido:', msg, 'de', username)
    displayMessage(msg, username)
    socket.auth.serverOffset = serverOffset
  })

  socket.on('chat error', (error) => {
    console.error('Error del chat:', error)
    alert('Error: ' + error)
  })
}

function setupFormHandler(socket) {
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault()
    
    const message = elements.input.value.trim()
    
    if (!message) {
      return
    }
    
    console.log('Enviando mensaje:', message)
    socket.emit('chat message', message)
    clearInput()
  })
}

async function initializeChat() {
  const username = await getUsername()
  elements.usernameDisplay.textContent = `Usuario: ${username}`

  const socket = io({
    auth: {
      username: username,
      serverOffset: 0
    }
  })

  setupSocketListeners(socket)
  setupFormHandler(socket)
}

initializeChat()