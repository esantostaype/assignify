// src/lib/crypto.ts
// Cifrado simétrico (AES-256-GCM) para secretos en reposo — p. ej. el token de
// ClickUp por usuario (modo SaaS). SOLO servidor (usa node:crypto). La clave deriva
// de ENCRYPTION_KEY (o AUTH_SECRET como fallback) vía SHA-256 → 32 bytes.
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('ENCRYPTION_KEY (o AUTH_SECRET) no está configurado para cifrar secretos')
  }
  return crypto.createHash('sha256').update(secret).digest() // 32 bytes
}

/** Cifra texto plano → "iv.tag.ciphertext" (todo en base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

/** Revierte encryptSecret. Lanza si el payload fue manipulado (GCM auth tag). */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Payload cifrado inválido')
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8')
}
