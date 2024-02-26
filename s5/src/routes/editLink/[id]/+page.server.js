import { error, fail, redirect } from '@sveltejs/kit';
import { getEntry, createEntryDB, updateEntryDB,
  createTagDB, getTagsDB, insertEntryToTagDB } from '$lib/server/db.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, params }) {

  // console.log('locals', locals);
  // console.log('params', params);

  if (!locals.user) throw error(401, 'Unauthorized');

  if (params.id === 'new') {
    return { entry: null };
  }

  const entryId = parseInt(params.id) ?? 0;
  const r = getEntry(locals.user.id, entryId, true);
  if (!r) throw error(404, 'Not found');

  return { entry: r };
}

/** @type {import('./$types').Actions} */
export const actions = {
  async createEntry({ locals, request }) {
    if (!locals.user) throw error(401, 'Unauthorized');

    const data = await request.formData();
    
    const title = String(data.get('title'));
    // if (!title) return fail(400, { title, missing: true });
    const content = String(data.get('url'));
    // validate content (url)
    // ...
    
    const isPrivate = data.get('isPrivate') ? 1 : 0;

    const r = createEntryDB({
      userId: locals.user.id,
      type: 'link',
      title,
      content,
      comment: String(data.get('comment')) ?? '',
      private: isPrivate,
      pinned: 0,
      manualDate: '',
      tags: [],
    });

    if (r.changes === 0) throw error(400, 'Error creating entry');

    const tags = data.getAll('tags') ?? [];
    // console.log('tags', tags);
    
    // create tags
    for (const tag of tags) {
      createTagDB(locals.user.id, tag);
    }

    const tagsFromDB = getTagsDB(locals.user.id);

    // link entry to tags
    for (const tag of tags) {
      const tagId = tagsFromDB.find(t => t.name === tag)?.id;
      insertEntryToTagDB(r.lastInsertRowid, tagId);
    }

    console.log('r', r);
    redirect(303, '/links')
  },
  async updateEntry({ locals, request, params }) {
    if (!locals.user) throw error(401, 'Unauthorized');

    const data = await request.formData();
    
    const title = String(data.get('title'));
    // if (!title) return fail(400, { title, missing: true });
    const content = String(data.get('content'));
    const isPrivate = data.get('isPrivate') ? 1 : 0;

    const r = updateEntryDB({
      entryId: parseInt(params.id) ?? 0,
      userId: locals.user.id,
      type: 'link',
      title,
      content,
      comment: String(data.get('comment')) ?? '',
      private: isPrivate,
      pinned: 0,
      manualDate: '',
      tags: [],
    });

    // return { success: true }
    console.log('r', r);
    if (r.changes === 0) throw error(400, 'Error updating entry');
    redirect(303, `/links`)
  }
}
