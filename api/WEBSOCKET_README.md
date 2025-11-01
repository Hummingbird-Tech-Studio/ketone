# WebSocket Real-time Synchronization

Esta implementación agrega sincronización en tiempo real para ciclos usando WebSockets.

## Arquitectura

```
┌─────────────┐                    ┌──────────────────────────┐
│  Cliente 1  │◄───WebSocket──────►│                          │
│  (Window 1) │    (Port 3001)     │   WebSocket Server       │
└─────────────┘                    │   (Bun Native)           │
                                   │                          │
┌─────────────┐                    │  ┌────────────────────┐  │
│  Cliente 2  │◄───WebSocket──────►│  │ Connection Manager │  │
│  (Window 2) │                    │  │ (por userId)       │  │
└─────────────┘                    │  └────────────────────┘  │
                                   │           ↓               │
                                   │  ┌────────────────────┐  │
                                   │  │ Event Broadcaster  │  │
                                   │  └────────────────────┘  │
                                   └──────────┬───────────────┘
                                              │
┌──────────────────────────┐                 │
│   API HTTP Server        │◄────────────────┘
│   (Effect + Bun)         │
│   (Port 3000)            │
│                          │
│  ┌────────────────────┐  │
│  │ Cycle Orleans      │  │
│  │ Service (XState)   │  │
│  └────────────────────┘  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│   Orleans Sidecar        │
│   (Port 5174)            │
└──────────────────────────┘
```

## Componentes

### 1. WebSocket Server
- **Puerto**: 3001
- **Ubicación**: `api/src/index.ts`
- **Autenticación**: JWT via query param `?token=<JWT>`
- **Protocolo**: WebSocket nativo de Bun

### 2. Connection Manager
- **Ubicación**: `api/src/infrastructure/websocket/connection-manager.ts`
- **Función**: Gestiona conexiones WebSocket organizadas por `userId`
- **Características**:
  - Permite múltiples conexiones por usuario (múltiples ventanas)
  - Broadcast a todas las conexiones del mismo usuario
  - Manejo de desconexiones automáticas

### 3. Event Broadcaster
- **Ubicación**: `api/src/infrastructure/websocket/event-broadcaster.ts`
- **Función**: Servicio Effect para emitir eventos de ciclo
- **Características**:
  - Integrado con el sistema Effect
  - Broadcasting condicional (solo si hay conexiones activas)

### 4. Integración con Cycle Orleans Service
- **Ubicación**: `api/src/features/cycle/services/cycle-orleans.service.ts`
- **Modificación**: Emite eventos broadcast cuando hay cambios en el estado del ciclo
- **Eventos**:
  - `cycle:created` - Cuando se crea un nuevo ciclo
  - `cycle:updated` - Cuando se actualizan las fechas del ciclo
  - `cycle:completed` - Cuando se completa un ciclo

## Flujo de Eventos

### 1. Conexión Inicial
```
Cliente → ws://localhost:3001?token=JWT
           ↓
       Validación JWT
           ↓
       Registro en ConnectionManager
           ↓
       Mensaje "connected"
```

### 2. Cambio en Ciclo (ej: Completar ciclo)
```
Cliente A → POST /cycle/complete
               ↓
           API Handler
               ↓
           Cycle Orleans Service
               ↓
           XState Machine emite PERSIST_STATE
               ↓
           1. Persiste en Orleans
           2. Llama a EventBroadcaster
               ↓
           Connection Manager broadcast
               ↓
Cliente A recibe evento    Cliente B recibe evento
```

## Protocolo de Mensajes

### Cliente → Servidor

```json
{
  "type": "ping"
}
```

### Servidor → Cliente

#### 1. Conexión Establecida
```json
{
  "type": "connected",
  "payload": {
    "userId": "uuid",
    "message": "WebSocket connection established"
  },
  "timestamp": "2025-10-31T12:00:00.000Z"
}
```

#### 2. Pong
```json
{
  "type": "pong",
  "timestamp": "2025-10-31T12:00:00.000Z"
}
```

#### 3. Ciclo Creado
```json
{
  "type": "cycle:created",
  "payload": {
    "userId": "uuid",
    "state": "InProgress",
    "cycle": {
      "id": "cycle-uuid",
      "startDate": "2025-10-31T00:00:00.000Z",
      "endDate": "2025-11-30T23:59:59.000Z",
      "status": "InProgress",
      "createdAt": "2025-10-31T12:00:00.000Z",
      "completedAt": null
    }
  },
  "timestamp": "2025-10-31T12:00:00.000Z"
}
```

#### 4. Ciclo Actualizado
```json
{
  "type": "cycle:updated",
  "payload": {
    "userId": "uuid",
    "state": "InProgress",
    "cycle": {
      "id": "cycle-uuid",
      "startDate": "2025-11-01T00:00:00.000Z",
      "endDate": "2025-11-29T23:59:59.000Z",
      "status": "InProgress",
      "createdAt": "2025-10-31T12:00:00.000Z",
      "completedAt": null
    }
  },
  "timestamp": "2025-10-31T12:05:00.000Z"
}
```

#### 5. Ciclo Completado
```json
{
  "type": "cycle:completed",
  "payload": {
    "userId": "uuid",
    "state": "Completed",
    "cycle": {
      "id": "cycle-uuid",
      "startDate": "2025-10-31T00:00:00.000Z",
      "endDate": "2025-11-30T23:59:59.000Z",
      "status": "Completed",
      "createdAt": "2025-10-31T12:00:00.000Z",
      "completedAt": "2025-11-30T23:59:59.000Z"
    }
  },
  "timestamp": "2025-11-30T23:59:59.000Z"
}
```

## Cómo Probar

### 1. Iniciar los servidores

```bash
# Terminal 1: Iniciar Orleans Sidecar
cd sidecar
dotnet run

# Terminal 2: Iniciar API con WebSocket
cd api
bun run dev
```

Verás:
```
✅ WebSocket server running on ws://localhost:3001
   Connect with: ws://localhost:3001?token=<JWT>
🚀 Starting Effect HTTP Server...
✅ Server running on http://localhost:3000
```

### 2. Obtener JWT Token

```bash
# Registrar usuario
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Login para obtener token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Respuesta:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Probar WebSocket

#### Opción A: Usar el Test HTML

1. Abre `api/test-websocket.html` en tu navegador
2. Pega el JWT token
3. Haz click en "Connect WebSocket"
4. Abre la misma página en otra ventana/pestaña
5. Desde cualquier ventana, crea o completa un ciclo usando la API
6. Observa cómo ambas ventanas reciben los eventos

#### Opción B: Usar la consola del navegador

```javascript
const token = 'tu-jwt-token-aquí';
const ws = new WebSocket(`ws://localhost:3001?token=${token}`);

ws.onopen = () => console.log('Conectado');
ws.onmessage = (event) => console.log('Mensaje:', JSON.parse(event.data));
ws.onerror = (error) => console.error('Error:', error);
ws.onclose = () => console.log('Desconectado');

// Enviar ping
ws.send(JSON.stringify({ type: 'ping' }));
```

### 4. Crear/Completar Ciclo

```bash
# Crear ciclo
curl -X POST http://localhost:3000/cycle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "startDate": "2025-10-31T00:00:00.000Z",
    "endDate": "2025-11-30T23:59:59.000Z"
  }'

# Todas las ventanas conectadas recibirán:
# { type: "cycle:created", payload: {...}, timestamp: "..." }

# Completar ciclo
curl -X POST http://localhost:3000/cycle/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "cycleId": "cycle-uuid",
    "startDate": "2025-10-31T00:00:00.000Z",
    "endDate": "2025-11-30T23:59:59.000Z"
  }'

# Todas las ventanas conectadas recibirán:
# { type: "cycle:completed", payload: {...}, timestamp: "..." }
```

## Características de la Implementación

### ✅ Autenticación
- JWT token validado en el handshake
- Mismo sistema de auth que HTTP API
- Validación contra Orleans (password change invalidation)

### ✅ Multi-ventana
- Mismo usuario puede tener múltiples conexiones
- Broadcast a todas las conexiones del usuario
- Cada ventana recibe todos los eventos

### ✅ Reconexión
- Heartbeat cada 30 segundos
- Auto-reconexión con exponential backoff
- Máximo 5 intentos de reconexión

### ✅ Manejo de Errores
- Desconexión automática en caso de error
- Logging detallado en consola
- Mensajes de error informativos

### ✅ Performance
- Solo envía eventos si hay conexiones activas
- Sin polling - eventos en tiempo real
- Bun WebSocket nativo (alto rendimiento)

## Próximos Pasos

### Frontend (Vue)

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const ws = ref(null);
const events = ref([]);
const isConnected = ref(false);

function connect(token) {
  ws.value = new WebSocket(`ws://localhost:3001?token=${token}`);

  ws.value.onopen = () => {
    isConnected.value = true;
  };

  ws.value.onmessage = (event) => {
    const message = JSON.parse(event.data);
    events.value.unshift(message);

    // Handle different event types
    if (message.type === 'cycle:created') {
      // Update UI
    } else if (message.type === 'cycle:completed') {
      // Update UI
    }
  };

  ws.value.onclose = () => {
    isConnected.value = false;
  };
}

onMounted(() => {
  const token = localStorage.getItem('jwtToken');
  if (token) connect(token);
});

onUnmounted(() => {
  if (ws.value) ws.value.close();
});
</script>
```

### Mejoras Futuras

1. **Compresión**: Agregar compresión de mensajes para reducir bandwidth
2. **Presencia**: Indicador de usuarios online
3. **Typing indicators**: Mostrar cuando alguien está editando
4. **Optimistic UI**: Actualizar UI antes de recibir confirmación
5. **Offline queue**: Guardar cambios cuando está offline y sincronizar al reconectar
6. **Binary messages**: Para datos grandes (imágenes, archivos)
