import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

export const digest = value => createHash('sha256').update(value).digest('hex')
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const supplied = scryptSync(password, salt, 64)
  const actual = Buffer.from(hash, 'hex')
  return actual.length === supplied.length && timingSafeEqual(actual, supplied)
}
export function openStore(directory) {
  const dataDir = resolve(directory)
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const uploadsDir = resolve(dataDir, 'uploads')
  mkdirSync(uploadsDir, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(resolve(dataDir, 'sgt.sqlite'))
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, company TEXT NOT NULL,
      name TEXT NOT NULL, password TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0,
      consent_version TEXT NOT NULL DEFAULT '2026-10-18-v1', consent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tenders (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, region TEXT NOT NULL,
      description TEXT NOT NULL, deadline TEXT NOT NULL, contact TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, company TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      inn TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '', filename TEXT NOT NULL,
      stored_path TEXT NOT NULL, consent_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sent_at TEXT
    );`)
  // Additive migration for development databases created by the first schema.
  const columns=new Set(db.prepare('PRAGMA table_info(users)').all().map(c=>c.name))
  if(!columns.has('consent_version'))db.exec("ALTER TABLE users ADD COLUMN consent_version TEXT NOT NULL DEFAULT '2026-10-18-v1'")
  if(!columns.has('consent_at'))db.exec("ALTER TABLE users ADD COLUMN consent_at TEXT NOT NULL DEFAULT ''")
  db.exec("UPDATE users SET consent_at=created_at WHERE consent_at=''")
  return { db, dataDir, uploadsDir }
}
