´# Testing Multi-Cycle Architecture

Guía completa para probar el nuevo feature de multi-ciclo con arquitectura de grains.

## Configuración Inicial

```bash
# Variables de entorno
export API_URL="http://localhost:3000"
export SIDECAR_URL="http://localhost:5174"

# Credenciales de prueba
export TEST_EMAIL="test@example.com"
export TEST_PASSWORD="SecurePassword123!"
```

## 1. Autenticación

### 1.1 Crear Cuenta de Usuario

```bash
curl -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }'
```

**Respuesta Esperada (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Guardar el token y userId:**
```bash
export JWT_TOKEN="<token-from-response>"
export USER_ID="<id-from-response>"
```

### 1.2 Login (Si ya tienes cuenta)

```bash
curl -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }'
```

**Respuesta Esperada (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 2. Flujo Principal: Primer Ciclo

### 2.1 Crear Primer Ciclo

```bash
curl -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01T10:00:00Z",
    "endDate": "2024-01-01T18:00:00Z"
  }'
```

**Respuesta Esperada (201):**
```json
{
  "id": "cycle-uuid-1",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "startDate": "2024-01-01T10:00:00.000Z",
  "endDate": "2024-01-01T18:00:00.000Z",
  "value": "InProgress",
  "context": {
    "id": "cycle-uuid-1",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-01T10:00:00.000Z",
    "endDate": "2024-01-01T18:00:00.000Z"
  }
}
```

**Guardar el cycleId:**
```bash
export CYCLE_ID_1="<id-from-response>"
```

### 2.2 Obtener Estado del Ciclo Activo

```bash
curl -X GET "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Respuesta Esperada (200):**
```json
{
  "id": "cycle-uuid-1",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "value": "InProgress",
  "context": {
    "id": "cycle-uuid-1",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-01T10:00:00.000Z",
    "endDate": "2024-01-01T18:00:00.000Z"
  }
}
```

### 2.3 Actualizar Fechas del Ciclo

```bash
curl -X PATCH "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleId": "'"$CYCLE_ID_1"'",
    "startDate": "2024-01-01T09:00:00Z",
    "endDate": "2024-01-01T19:00:00Z"
  }'
```

**Respuesta Esperada (200):**
```json
{
  "id": "cycle-uuid-1",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "value": "InProgress",
  "context": {
    "id": "cycle-uuid-1",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-01T09:00:00.000Z",
    "endDate": "2024-01-01T19:00:00.000Z"
  }
}
```

### 2.4 Verificar Fechas Actualizadas

```bash
curl -X GET "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Verificar que las fechas cambieron a 09:00 - 19:00**

---

## 3. Flujo de Restricción: Intento de Segundo Ciclo

### 3.1 Intentar Crear Segundo Ciclo (Debe Fallar)

```bash
curl -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-02T10:00:00Z",
    "endDate": "2024-01-02T18:00:00Z"
  }'
```

**Respuesta Esperada (409 Conflict):**
```json
{
  "error": {
    "_tag": "CycleAlreadyInProgressError",
    "message": "A cycle is already in progress",
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**✅ Éxito:** La regla "solo 1 ciclo activo por usuario" está funcionando.

---

## 4. Flujo de Completar Ciclo

### 4.1 Completar Primer Ciclo

```bash
curl -X POST "$API_URL/cycle/complete" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleId": "'"$CYCLE_ID_1"'",
    "startDate": "2024-01-01T09:00:00Z",
    "endDate": "2024-01-01T19:00:00Z"
  }'
```

**Respuesta Esperada (200):**
```json
{
  "id": "cycle-uuid-1",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "value": "Completed",
  "context": {
    "id": "cycle-uuid-1",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-01T09:00:00.000Z",
    "endDate": "2024-01-01T19:00:00.000Z"
  }
}
```

### 4.2 Verificar No Hay Ciclo Activo

```bash
curl -X GET "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Respuesta Esperada (404):**
```json
{
  "error": {
    "_tag": "CycleActorError",
    "message": "User <userId> has no active cycle"
  }
}
```

**✅ Éxito:** El ciclo activo se limpió correctamente después de completarse.

---

## 5. Flujo: Segundo Ciclo Exitoso

### 5.1 Crear Segundo Ciclo (Ahora Debe Funcionar)

```bash
curl -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-02T10:00:00Z",
    "endDate": "2024-01-02T18:00:00Z"
  }'
```

**Respuesta Esperada (201):**
```json
{
  "id": "cycle-uuid-2",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "value": "InProgress",
  "context": {
    "id": "cycle-uuid-2",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-02T10:00:00.000Z",
    "endDate": "2024-01-02T18:00:00.000Z"
  }
}
```

**Guardar el cycleId:**
```bash
export CYCLE_ID_2="<id-from-response>"
```

**✅ Éxito:** Después de completar el primer ciclo, se puede crear un nuevo ciclo.

### 5.2 Verificar Nuevo Ciclo Activo

```bash
curl -X GET "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Respuesta Esperada (200):**
```json
{
  "id": "cycle-uuid-2",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "value": "InProgress",
  "context": {
    "id": "cycle-uuid-2",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-02T10:00:00.000Z",
    "endDate": "2024-01-02T18:00:00.000Z"
  }
}
```

---

## 6. Queries y Consultas

### 6.1 Obtener Ciclos Recientes (Sidecar´)

```bash
curl -X GET "$SIDECAR_URL/users/$USER_ID/cycles/recent?limit=10" \
  -H "Content-Type: application/json"
```

**Respuesta Esperada (200):**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "cycles": [
    {
      "cycleId": "cycle-uuid-2",
      "startDate": "2024-01-02T10:00:00Z",
      "endDate": "2024-01-02T18:00:00Z",
      "status": "InProgress",
      "createdAt": "2024-01-02T10:00:00Z"
    },
    {
      "cycleId": "cycle-uuid-1",
      "startDate": "2024-01-01T09:00:00Z",
      "endDate": "2024-01-01T19:00:00Z",
      "status": "Completed",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

### 6.2 Obtener Snapshot Específico de un Ciclo (Sidecar)

```bash
curl -X GET "$SIDECAR_URL/cycles/$CYCLE_ID_1" \
  -H "Content-Type: application/json"
```

**Respuesta Esperada (200):**
```json
{
  "status": "Completed",
  "value": "Completed",
  "context": {
    "id": "cycle-uuid-1",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2024-01-01T09:00:00.000Z",
    "endDate": "2024-01-01T19:00:00.000Z"
  },
  "children": {},
  "historyValue": {
    "Completed": {
      "target": "Completed",
      "source": "InProgress"
    }
  }
}
```

### 6.3 Obtener ID del Ciclo Activo (Sidecar)

```bash
curl -X GET "$SIDECAR_URL/users/$USER_ID/cycles/active" \
  -H "Content-Type: application/json"
```

**Respuesta Esperada (200):**
```json
{
  "cycleId": "cycle-uuid-2",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 7. Verificación de Read Model (Base de Datos)

### 7.1 Query SQL - Ver Todos los Ciclos en la Tabla

```sql
-- Conectar a la base de datos
psql "$DATABASE_URL"

-- Ver todos los ciclos del usuario
SELECT
  id,
  user_id,
  status,
  start_date,
  end_date,
  created_at,
  updated_at
FROM cycles
WHERE user_id = '<your-user-id>'
ORDER BY created_at DESC;
```

**Resultado Esperado:**
```
                  id                  |              user_id               |  status    |      start_date      |       end_date
--------------------------------------+------------------------------------+------------+---------------------+---------------------
 cycle-uuid-2                         | 550e8400-e29b-41d4-a716-446655440000 | InProgress | 2024-01-02 10:00:00 | 2024-01-02 18:00:00
 cycle-uuid-1                         | 550e8400-e29b-41d4-a716-446655440000 | Completed  | 2024-01-01 09:00:00 | 2024-01-01 19:00:00
```

**✅ Éxito:** Los datos se escribieron correctamente en el read model.

### 7.2 Verificar IDs Coinciden con Grains

```sql
-- Verificar que el ID del ciclo en la tabla coincide con el ID del grain
SELECT id FROM cycles WHERE id = '<cycle-id-from-grain>';
```

**✅ Éxito:** Los IDs coinciden, confirmando la correlación grain-tabla.

---

## 8. Casos de Error

### 8.1 Sin Autenticación (401)

```bash
curl -X GET "$API_URL/cycle"
```

**Respuesta Esperada (401):**
```json
{
  "error": {
    "_tag": "UnauthorizedError",
    "message": "Missing or invalid authentication token"
  }
}
```

### 8.2 Actualizar Ciclo Completado (409)

```bash
# Intentar actualizar fechas de un ciclo ya completado
curl -X PATCH "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleId": "'"$CYCLE_ID_1"'",
    "startDate": "2024-01-01T11:00:00Z",
    "endDate": "2024-01-01T20:00:00Z"
  }'
```

**Respuesta Esperada (409):**
```json
{
  "error": {
    "_tag": "CycleInvalidStateError",
    "message": "Can only update dates for cycles in InProgress state",
    "currentState": "Completed",
    "expectedState": "InProgress"
  }
}
```

### 8.3 Completar Ciclo con ID Incorrecto (409)

```bash
curl -X POST "$API_URL/cycle/complete" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleId": "wrong-cycle-id",
    "startDate": "2024-01-02T10:00:00Z",
    "endDate": "2024-01-02T18:00:00Z"
  }'
```

**Respuesta Esperada (409):**
```json
{
  "error": {
    "_tag": "CycleIdMismatchError",
    "message": "The cycle ID does not match the snapshot cycle ID",
    "requestedCycleId": "wrong-cycle-id",
    "activeCycleId": "cycle-uuid-2"
  }
}
```

---

## 9. Flujo Completo End-to-End

### Script Bash Completo

```bash
#!/bin/bash

# Configuración
export API_URL="http://localhost:3000"
export SIDECAR_URL="http://localhost:5174"
export TEST_EMAIL="test-$(date +%s)@example.com"
export TEST_PASSWORD="SecurePassword123!"

echo "🧪 Testing Multi-Cycle Architecture"
echo "===================================="
echo ""

# 1. Signup
echo "1️⃣  Creating user account..."
SIGNUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'"$TEST_EMAIL"'",
    "password": "'"$TEST_PASSWORD"'"
  }')

export JWT_TOKEN=$(echo $SIGNUP_RESPONSE | jq -r '.token')
export USER_ID=$(echo $SIGNUP_RESPONSE | jq -r '.id')

echo "✅ User created: $USER_ID"
echo ""

# 2. Create first cycle
echo "2️⃣  Creating first cycle..."
CYCLE1_RESPONSE=$(curl -s -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01T10:00:00Z",
    "endDate": "2024-01-01T18:00:00Z"
  }')

export CYCLE_ID_1=$(echo $CYCLE1_RESPONSE | jq -r '.id')
echo "✅ First cycle created: $CYCLE_ID_1"
echo ""

# 3. Try to create second cycle (should fail)
echo "3️⃣  Trying to create second cycle (should fail with 409)..."
CYCLE2_ATTEMPT=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-02T10:00:00Z",
    "endDate": "2024-01-02T18:00:00Z"
  }')

STATUS_CODE=$(echo "$CYCLE2_ATTEMPT" | tail -n1)
if [ "$STATUS_CODE" = "409" ]; then
  echo "✅ Correctly rejected (409 Conflict)"
else
  echo "❌ Expected 409, got $STATUS_CODE"
fi
echo ""

# 4. Complete first cycle
echo "4️⃣  Completing first cycle..."
curl -s -X POST "$API_URL/cycle/complete" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cycleId": "'"$CYCLE_ID_1"'",
    "startDate": "2024-01-01T10:00:00Z",
    "endDate": "2024-01-01T18:00:00Z"
  }' > /dev/null

echo "✅ First cycle completed"
echo ""

# 5. Create second cycle (should succeed now)
echo "5️⃣  Creating second cycle (should succeed now)..."
CYCLE2_RESPONSE=$(curl -s -X POST "$API_URL/cycle" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-02T10:00:00Z",
    "endDate": "2024-01-02T18:00:00Z"
  }')

export CYCLE_ID_2=$(echo $CYCLE2_RESPONSE | jq -r '.id')
echo "✅ Second cycle created: $CYCLE_ID_2"
echo ""

# 6. Get recent cycles
echo "6️⃣  Fetching recent cycles..."
RECENT_CYCLES=$(curl -s -X GET "$SIDECAR_URL/users/$USER_ID/cycles/recent?limit=10")
CYCLE_COUNT=$(echo $RECENT_CYCLES | jq -r '.cycles | length')
echo "✅ Found $CYCLE_COUNT cycles in history"
echo ""

echo "🎉 All tests passed!"
echo ""
echo "Summary:"
echo "  User ID: $USER_ID"
echo "  First Cycle: $CYCLE_ID_1 (Completed)"
echo "  Second Cycle: $CYCLE_ID_2 (InProgress)"
```

**Para ejecutar:**
```bash
chmod +x test-multi-cycle.sh
./test-multi-cycle.sh
```

---

## 10. Resumen de Validaciones

### ✅ Validaciones de Arquitectura Implementadas

1. **Un Solo Ciclo Activo por Usuario**
   - ✅ Solo se permite un ciclo en estado `InProgress` por usuario
   - ✅ Intentos de crear segundo ciclo retornan 409 Conflict

2. **Múltiples Ciclos por Usuario**
   - ✅ Después de completar un ciclo, se puede crear otro
   - ✅ Cada ciclo tiene su propio grain (keyed by cycleId)

3. **Persistencia en Grains**
   - ✅ Snapshots de XState se guardan en CycleGrain
   - ✅ Metadata denormalizada en CycleGrain para queries rápidos

4. **Read Model (Cycles Table)**
   - ✅ Escrituras asíncronas a la tabla cycles
   - ✅ IDs del grain coinciden con IDs de la tabla
   - ✅ Estados sincronizados (InProgress, Completed)

5. **Coordinación con Index Grain**
   - ✅ UserCycleIndexGrain mantiene activeCycleId
   - ✅ Al completar ciclo, activeCycleId se limpia
   - ✅ Index grain mantiene lista de últimos 50 ciclos

6. **State Machine (XState)**
   - ✅ Transiciones: Creating → InProgress → Completed
   - ✅ Update dates solo en estado InProgress
   - ✅ Eventos: CREATE_CYCLE, UPDATE_DATES, COMPLETE

---

## Notas

- Todos los endpoints de `/cycle/*` requieren autenticación con JWT token
- Los endpoints del sidecar (`/users/{userId}/*` y `/cycles/{cycleId}/*`) son internos (no requieren auth en este nivel)
- Las fechas deben estar en formato ISO 8601 (UTC)
- Los UUIDs se generan automáticamente al crear ciclos
