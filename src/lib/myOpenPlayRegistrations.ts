const KEY = 'pkl_my_open_play_registrations'

/** Session id -> this device's own registration id for it. Purely a local
 *  "is this me?" marker for highlighting "— YOU" in the public player list
 *  — never sent anywhere, never used to authorize anything (removing a
 *  registration is still admin-only). Not sensitive: a registration id is
 *  just a random uuid the client already receives back at join time. */
function read(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function write(map: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // Storage unavailable — "— YOU" just won't highlight; nothing else depends on this.
  }
}

export function saveMyOpenPlayRegistration(sessionId: string, registrationId: string) {
  const map = read()
  map[sessionId] = registrationId
  write(map)
}

export function getMyOpenPlayRegistrationId(sessionId: string): string | null {
  return read()[sessionId] ?? null
}
