import Database from 'better-sqlite3';
import dayjs from 'dayjs';

import { DBPATH } from '$env/static/private'; 

export const db = new Database(DBPATH);

const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
  * @typedef {Object} SessionData
  * @property {number} id
  * @property {string} uuid
  * @property {number} user_id
  * @property {string} user_agent
  * @property {string} ip
  * @property {string} created_at
  */

/**
  * @typedef {Object} SessionUserData
  * @property {string} username
  * @property {number} user_id
  */

/**
  * @param {string} sessionId
  * @returns {SessionUserData | undefined}
  */
export function getSessionUser(sessionId) {
  const stmt = db.prepare(`SELECT users.username AS username, sessions.user_id AS user_id FROM sessions
    JOIN users ON sessions.user_id = users.id
    WHERE sessions.uuid = ?`);
  const r = /** @type {SessionUserData | undefined} */ (stmt.get(sessionId));
  return r;
}

/**
  * @typedef {Object} UserData
  * @property {number} id
  * @property {string} username
  * @property {string} pwhash
  * @property {string} created_at
  * @property {string} updated_at
  */

/**
  * @param {string} username
  * @returns {UserData | undefined}
  */
export function getUser(username) {
  const stmt = db.prepare(`SELECT * FROM users WHERE username = ?`);
  const r = /** @type {UserData | undefined} */ (stmt.get(username));
  return r;
}

/**
  * @typedef {Object} SessionCreateData
  * @property {string} uuid
  * @property {number} userId
  * @property {string} userAgent
  * @property {string} host
  */

/**
  * @param {SessionCreateData} data
  * @returns {Database.RunResult}
  */
export function createSession(data) {
  // console.log('createSession', data);
  const stmt = db.prepare(`INSERT INTO sessions (uuid, user_id, user_agent, ip, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))`);
  const r = stmt.run(data.uuid, data.userId, data.userAgent, data.host);
  // console.log('createSession r', r);
  return r;
}

/**
  * @param {string} sessionId
  * @returns {Database.RunResult}
  */
export function destroySession(sessionId) {
  const stmt = db.prepare(`DELETE FROM sessions WHERE uuid = ?`);
  const r = stmt.run(sessionId);
  return r;
}

/**
  * @typedef {Object} CreateImageData
  * @property {string} path
  * @property {string} comment
  * @property {string} previewData
  * @property {string} exifData
  */

/**
  * @param {CreateImageData[]} images
  * @param {number|bigint} entryId
  * @param {number|bigint} userId
  * @returns {boolean} success
  */
export function insertImagesDB(images, entryId, userId) {
  let success = true;
  for (const i of images) {
    const stmt = db.prepare(`INSERT INTO images (entry_id, user_id, path, comment, preview_data, exif_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);
    const r = stmt.run(entryId, userId, i.path, i.comment, i.previewData, i.exifData);
    if (!r) {
      success = false;
      break;
    }
  }
  return success;
}

/** @typedef {'event'|'note'|'task'|'link'} EntryType */

/**
  * @typedef {Object} CreateEntryData
  * @property {number} userId
  * @property {EntryType} type
  * @property {string} title
  * @property {string} content
  * @property {string} comment
  * @property {number} private
  * @property {number} pinned
  * @property {Date|undefined} manualDate
  */

/**
  * @param {CreateEntryData} data
  * @returns {Database.RunResult}
  */
export function createEntryDB(data) {
  const manualDate = data.manualDate ? dayjs(data.manualDate).format(DATE_FORMAT) : undefined;

  const stmt = db.prepare(`INSERT INTO entries (user_id, type, title, content, comment, private, pinned,
    created_at, manual_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`);
  const r = stmt.run(data.userId, data.type, data.title, data.content, data.comment, data.private,
    data.pinned, manualDate);

  // for (const t of data.tags) {
  //   const stmt2 = db.prepare(`INSERT INTO tags (user_id, entry_id, name, created_at)
  //     VALUES (?, ?, ?, datetime('now'))`);
  //   const r2 = stmt2.run(data.userId, r.lastInsertRowid, t);
  // }
  return r;
}

/**
  * @typedef {Object} Tag
  * @property {number} id
  * @property {number} user_id
  * @property {string} name
*/

/**
  * @typedef {Object} ImageData
  * @property {number} id
  * @property {number} entry_id
  * @property {number} user_id
  * @property {string} path
  * @property {string} comment
  * @property {string} preview_data
  */

/**
  * @typedef {Object} EntryData
  * @property {number} id
  * @property {number} user_id
  * @property {EntryType} type
  * @property {string} title
  * @property {string} content
  * @property {string} comment
  * @property {string} private
  * @property {string} pinned
  * @property {string} created_at
  * @property {string} updated_at
  * @property {string} manual_date
  * @property {Tag[]} tags
  * @property {ImageData[]} images
  */

/**
  * @param {number} userId
  * @param {number} entryId
  * @param {boolean} loggedIn
  * @returns {EntryData | undefined}
  */
export function getEntry(userId, entryId, loggedIn = false) {
  let stmt;
  const privateWhere = loggedIn ? '' : 'AND private = 0';
  stmt = db.prepare(`SELECT * FROM entries WHERE user_id = ? AND id = ? ${privateWhere}`);
  const r = /** @type {EntryData | undefined} */ (stmt.get(userId, entryId));
  // get tags
  if (r) {
    const stmt2 = db.prepare(`SELECT tags.id, tags.name FROM tags
      JOIN entry_to_tag ON tags.id = entry_to_tag.tag_id
      WHERE entry_to_tag.entry_id = ?`);
    const tags = /** @type {Tag[]} */ (stmt2.all(r['id']));
    r.tags = tags;
  }
  // get images
  if (r) {
    const stmt2 = db.prepare(`SELECT * FROM images WHERE entry_id = ?`);
    const images = /** @type {ImageData[]} */ (stmt2.all(r['id']));
    r.images = images;
  }
  return r;
}

/**
  * @param {number} userId
  * @param {EntryType|''} type
  * @param {boolean} loggedIn
  * @param {number} limit
  * @param {number} offset
  * @returns {EntryData[]}
  */
export function getEntries(userId, type = '', loggedIn = false, limit = 99999, offset = 0, orderBy = 'created_at') {
  let stmt;
  const privateWhere = loggedIn ? '' : 'AND private = 0';
  stmt = db.prepare(`SELECT * FROM entries WHERE user_id = ? AND type = ? ${privateWhere}
    ORDER BY ? DESC LIMIT ? OFFSET ?`);
  const r = /** @type {EntryData[]} */ (stmt.all(userId, type, orderBy, limit, offset));
  for (const e of r) {
    // get tags
    const stmt2 = db.prepare(`SELECT tags.id, tags.name FROM tags
      JOIN entry_to_tag ON tags.id = entry_to_tag.tag_id
      WHERE entry_to_tag.entry_id = ?`);
    const tags = /** @type {Tag[]} */ (stmt2.all(e['id']));
    e.tags = tags;
    // get images
    const stmt3 = db.prepare(`SELECT * FROM images WHERE entry_id = ?`);
    const images = /** @type {ImageData[]} */ (stmt3.all(e['id']));
    e.images = images;
  }
  return r;
}

/**
  * @typedef {Object} UpdateEntryData
  * @property {number} userId
  * @property {number} entryId
  * @property {EntryType} type
  * @property {string} title
  * @property {string} content
  * @property {string} comment
  * @property {number} private
  * @property {number} pinned
  * @property {Date|undefined} manualDate
  * @property {number[]} tags
  */

/**
  * @param {UpdateEntryData} data
  * @returns {Database.RunResult}
  */
export function updateEntryDB(data) {
  const manualDate = data.manualDate ? dayjs(data.manualDate).format(DATE_FORMAT) : undefined;

  const stmt = db.prepare(`UPDATE entries SET title = ?, content = ?, comment = ?, private = ?, pinned = ?,
    modified_at = datetime('now'), manual_date = ?
    WHERE user_id = ? AND id = ?`);
  const r = stmt.run(data.title, data.content, data.comment, data.private, data.pinned,
    manualDate, data.userId, data.entryId);
  return r;
}

/**
  * @param {number} entryId
  * @param {number} userId
  * @returns {Database.RunResult}
  */
export function deleteEntryDB(entryId, userId) {
  const stmt = db.prepare(`DELETE FROM entries WHERE user_id = ? AND id = ?`);
  const r = stmt.run(userId, entryId);
  return r;
}

/**
  * @param {number} imageId
  * @param {number} userId
  * @returns {ImageData | undefined}
  */
export function getImageDB(imageId, userId) {
  const stmt = db.prepare(`SELECT * FROM images WHERE user_id = ? AND id = ?`);
  const r = /** @type {ImageData | undefined} */ (stmt.get(userId, imageId));
  return r;
}

/**
  * @param {number} imageId
  * @param {number} userId
  * @returns {Database.RunResult}
  */
export function deleteImageDB(imageId, userId) {
  const stmt = db.prepare(`DELETE FROM images WHERE user_id = ? AND id = ?`);
  const r = stmt.run(userId, imageId);
  return r;
}

/**
  * @param {number} imageId
  * @param {number} userId
  * @param {string} comment
  * @returns {Database.RunResult}
  */
export function updateImageCommentDB(imageId, userId, comment) {
  const stmt = db.prepare(`UPDATE images SET comment = ? WHERE user_id = ? AND id = ?`);
  const r = stmt.run(comment, userId, imageId);
  return r;
}

// add to function to create a tag

/**
  * @typedef {Object} TagData
  * @property {number} user_id
  * @property {string} name
  * @property {string} created_at
  */

/**
  * @param {number} userId
  * @param {string} name
  * @returns {Database.RunResult}
  */
export function createTagDB(userId, name) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO tags (user_id, name) VALUES (?, ?)`);
  const r = stmt.run(userId, name);
  return r;
}

// function to insert into entry_to_tag table

/**
  * @param {number} entryId
  * @param {number} tagId
  * @returns {Database.RunResult}
  */
export function insertEntryToTagDB(entryId, tagId) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO entry_to_tag (entry_id, tag_id) VALUES (?, ?)`);
  const r = stmt.run(entryId, tagId);
  return r;
}

// get all tags for a user

/**
  * @param {number} userId
  * @returns {TagData[]} tags
  */
export function getTagsDB(userId) {
  const stmt = db.prepare(`SELECT * FROM tags WHERE user_id = ?`);
  const r = /** @type {TagData[]} */ (stmt.all(userId));
  return r;
}
