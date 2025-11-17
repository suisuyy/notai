// worker.js

/**
 * Cloudflare Worker for Note Application with Folder Support
 * 
 * This worker serves both the API endpoints and the simple HTML client.
 * 
 * API Base URL: https://notai.suisuy.workers.dev/
 * 
 * Routes:
 * - GET /           : Serve the HTML client
 * - POST /users     : Register a new user
 * - POST /folders   : Create a new folder
 * - GET /folders    : Get all folders for the authenticated user
 * - DELETE /folders/:id : Delete a folder (and its contents)
 * - GET /notes      : Get all notes
 * - GET /notes/:id  : Get a single note
 * - POST /notes     : Create or update a note
 * - GET /search     : Search notes and folders by keyword
 * - GET /users/config : Get user config
 * - POST /users/config : Update user config
 */

const default_parent_folder = '1733485657799jj0.5911120915160637'


export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    }
};

// Inline HTML Client
const HTML_CONTENT = `<!--index.html-->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Simple Notes Client</title>
<style>
body {
  font-family: sans-serif;
  margin: 20px;
}
section {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid #ddd;
}
input, button, textarea, select {
  display: block;
  margin: 5px 0;
  width: 100%;
  max-width: 400px;
}
#response {
  white-space: pre-wrap;
  border: 1px solid #ddd;
  padding: 10px;
  margin-top: 10px;
  max-height: 300px;
  overflow: auto;
  background: #f9f9f9;
}
</style>
</head>
<body>
<h1>Simple Notes Client</h1>

<section>
  <h2>Register</h2>
  <label>User ID: <input type="text" id="register_user_id"></label>
  <label>Password Hash: <input type="text" id="register_password_hash"></label>
  <label>Email: <input type="email" id="register_email"></label>
  <button onclick="registerUser()">Register</button>
</section>

<section>
  <h2>Login</h2>
  <label>User ID: <input type="text" id="login_user_id"></label>
  <label>Password Hash: <input type="text" id="login_password_hash"></label>
  <button onclick="loginUser()">Login</button>
</section>

<section>
  <h2>Your Folders</h2>
  <ul id="folders_list"></ul>
  <label>New Folder Name: <input type="text" id="new_folder_name"></label>
  <label>Parent Folder ID (optional): <input type="text" id="new_folder_parent_id"></label>
  <button onclick="createFolder()">Create Folder</button>
</section>

<section>
  <h2>Your Notes</h2>
  <ul id="notes_list"></ul>
</section>

<section>
  <h2>View Note</h2>
  <pre id="note_view">(Select a note from the list above)</pre>
</section>

<section>
  <h2>Create/Update Note</h2>
  <label>Note Name: <input type="text" id="new_note_name"></label>
  <label>Folder:
    <select id="new_note_folder">
      <option value="">None</option>
    </select>
  </label>
  <label>Note Content:<br><textarea id="new_note_content" rows="5" cols="50"></textarea></label>
  <button onclick="createNote()">Create/Update Note</button>
</section>

<section>
  <h2>Search Notes</h2>
  <label>Search Query: <input type="text" id="search_query"></label>
  <button onclick="searchNotes()">Search Notes</button>
</section>

<section>
  <h2>User Config</h2>
  <button onclick="getUserConfig()">Get User Config</button>
  <label>Config JSON: <textarea id="user_config" rows="5" cols="50"></textarea></label>
  <button onclick="updateUserConfig()">Update User Config</button>
</section>

<h2>Response</h2>
<pre id="response"></pre>

<script>
const API_BASE = "/";

let currentUserId = "";
let currentPasswordHash = "";

function setResponse(data) {
  document.getElementById('response').textContent = JSON.stringify(data, null, 2);
}

// Helper functions to interact with the API
async function apiRequest(method, endpoint, body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (currentUserId && currentPasswordHash) {
    const credentials = currentUserId + ':' + currentPasswordHash;
    headers['Authorization'] = \`Basic \${credentials}\`;
  }

  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  return response.json();
}

// Register a new user
async function registerUser() {
  const user_id = document.getElementById('register_user_id').value.trim();
  const password_hash = document.getElementById('register_password_hash').value.trim();
  const email = document.getElementById('register_email').value.trim();

  if (!user_id || !password_hash) {
    alert('User ID and Password Hash are required.');
    return;
  }

  const result = await apiRequest('POST', 'users', { user_id, password_hash, email });
  if (result.success) {
    alert('User registered successfully.');
  } else {
    alert('Registration failed: ' + (result.error || 'Unknown error'));
  }
}

// Login user
async function loginUser() {
  const user_id = document.getElementById('login_user_id').value.trim();
  const password_hash = document.getElementById('login_password_hash').value.trim();

  if (!user_id || !password_hash) {
    alert('User ID and Password Hash are required for login.');
    return;
  }

  // Store credentials locally
  currentUserId = user_id;
  currentPasswordHash = password_hash;

  // Attempt to fetch notes to verify credentials
  const notes = await apiRequest('GET', 'notes');
  if (!notes.error) {
    alert('Login successful!');
    loadFolders();
    loadNotes();
  } else {
    alert('Login failed: ' + notes.error);
  }
}

// Create a new folder
async function createFolder() {
  const name = document.getElementById('new_folder_name').value.trim();
  const parent_id = document.getElementById('new_folder_parent_id').value.trim();

  if (!name) {
    alert('Folder name is required.');
    return;
  }

  const body = { name };
  if (parent_id) {
    body.parent_id = parseInt(parent_id);
  }

  const result = await apiRequest('POST', 'folders', body);
  if (result.success) {
    alert('Folder created successfully.');
    loadFolders();
  } else {
    alert('Failed to create folder: ' + (result.error || 'Unknown error'));
  }
}

// Load all folders
async function loadFolders() {
  const foldersList = document.getElementById('folders_list');
  const folderSelect = document.getElementById('new_note_folder');
  foldersList.innerHTML = '';
  folderSelect.innerHTML = '<option value="">None</option>';

  const folders = await apiRequest('GET', 'folders');
  if (Array.isArray(folders)) {
    folders.forEach(folder => {
      // Populate folder list
      const li = document.createElement('li');
      li.textContent = \`\${folder.name} (ID: \${folder.folder_id})\`;
      foldersList.appendChild(li);

      // Populate folder select dropdown
      const option = document.createElement('option');
      option.value = folder.folder_id;
      option.textContent = folder.name;
      folderSelect.appendChild(option);
    });
  }
}

// Load all notes
async function loadNotes() {
  const notesList = document.getElementById('notes_list');
  notesList.innerHTML = '';

  const notes = await apiRequest('GET', 'notes');
  if (Array.isArray(notes)) {
    notes.forEach(note => {
      const li = document.createElement('li');
      li.textContent = \`\${note.title} (ID: \${note.note_id})\`;
      li.addEventListener('click', () => showNote(note.note_id));
      notesList.appendChild(li);
    });
  }
}

// Show a single note
async function showNote(note_id) {
  const noteView = document.getElementById('note_view');
  noteView.textContent = 'Loading...';

  const note = await apiRequest('GET', \`notes/\${note_id}\`);
  if (note.error) {
    noteView.textContent = 'Error: ' + note.error;
  } else {
    noteView.textContent = \`Title: \${note.title}\nLast Modified: \${note.last_updated}\nContent:\n\${note.content}\`;
  }
}

// Create or update a note
async function createNote() {
  const title = document.getElementById('new_note_name').value.trim();
  const content = document.getElementById('new_note_content').value;
  const folder_id = document.getElementById('new_note_folder').value;

  if (!title || !content) {
    alert('Note Name and Content are required.');
    return;
  }

  const body = { title, content };
  if (folder_id) {
    body.folder_id = parseInt(folder_id);
  }

  const result = await apiRequest('POST', 'notes', body);
  if (result.success) {
    alert('Note created/updated successfully.');
    loadNotes();
  } else {
    alert('Error: ' + (result.error || 'Unknown error'));
  }
}

// Search notes
async function searchNotes() {
  const query = document.getElementById('search_query').value.trim();
  if (!query) {
    alert('Search query is required.');
    return;
  }

  const results = await apiRequest('GET', \`search?term=\${encodeURIComponent(query)}\`);
  if (!results.error) {
    const notesList = document.getElementById('notes_list');
    notesList.innerHTML = '';
    (results.notes || []).forEach(note => {
      const li = document.createElement('li');
      li.textContent = \`\${note.title} (ID: \${note.note_id})\`;
      li.addEventListener('click', () => showNote(note.note_id));
      notesList.appendChild(li);
    });

    setResponse({
      message: \`Found \${(results.notes || []).length} notes and \${(results.folders || []).length} folders matching "\${query}".\`,
      matches: results
    });
  } else {
    alert('Search failed: ' + (results.error || 'Unknown error'));
  }
}

// Get user config
async function getUserConfig() {
  const config = await apiRequest('GET', 'users/config');
  if (config.config) {
    document.getElementById('user_config').value = config.config;
  } else {
    document.getElementById('user_config').value = '';
  }
}

// Update user config
async function updateUserConfig() {
  const config = document.getElementById('user_config').value.trim();
  if (!config) {
    alert('Config JSON is required.');
    return;
  }

  try {
    JSON.parse(config);
  } catch (e) {
    alert('Invalid JSON format.');
    return;
  }

  const result = await apiRequest('POST', 'users/config', { config });
  if (result.success) {
    alert('User config updated successfully.');
  } else {
    alert('Failed to update config: ' + (result.error || 'Unknown error'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (currentUserId && currentPasswordHash) {
    loadFolders();
    loadNotes();
  }
});
</script>
</body>
</html>`;

// Client-side JavaScript is embedded inline within the HTML_CONTENT above.

async function handleRequest(request, env) {

    try {


        const url = new URL(request.url);
        const { pathname, searchParams } = url;
        const method = request.method.toUpperCase();

        // Handle CORS preflight
        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders() });
        }

        // Serve the HTML client at GET /
        if (method === "GET" && pathname === "/") {
            return new Response(HTML_CONTENT, {
                headers: {
                    "Content-Type": "text/html",
                    ...corsHeaders()
                }
            });
        }

        // Serve the client.js at GET /client.js (optional if using inline scripts)
        if (method === "GET" && pathname === "/client.js") {
            // If you have a separate client.js file, you can serve it here
            // Currently, client.js is embedded inline, so we'll return 404
            return jsonResponse({ error: "Not found" }, 404);
        }

        // Helper function to return JSON responses with CORS headers
        function jsonResponse(data, status = 200) {
            return new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders()
                }
            });
        }

        // Authenticate the user
        async function authenticate(request) {
            const authHeader = request.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Basic ")) {
                return null;
            }

            // The client provides `userid:base64password` directly, no decoding needed.
            const credentials = authHeader.slice("Basic ".length);
            const [user_id, providedHash] = credentials.split(":");

            if (!user_id || !providedHash) {
                return null;
            }

            try {
                const userRow = await env.DB.prepare(
                    `SELECT password_hash FROM users WHERE user_id = ?`
                ).bind(user_id).first();

                if (!userRow) return null;
                if (userRow.password_hash !== providedHash) return null;
                return user_id;
            } catch (error) {
                console.error("Authentication Error:", error);
                return null;
            }
        }

        // Route Definitions

        // POST /users - Register a new user
        if (method === "POST" && pathname === "/users") {
            const body = await request.json().catch(() => ({}));
            const { user_id, password_hash, email } = body;

            if (!user_id || !password_hash) {
                return jsonResponse({ error: "Missing user_id or password_hash" }, 400);
            }

            try {
                // Insert new user. Username is same as user_id.
                await env.DB.prepare(`
        INSERT INTO users (user_id, username, password_hash, email, created_at, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(user_id, user_id, password_hash, email || null).run();

                // Insert default user config
                await env.DB.prepare(`
        INSERT INTO user_config (user_id, config, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(user_id, JSON.stringify({})).run();

                return jsonResponse({ success: true, message: "User registered successfully." });
            } catch (e) {
                if (e.message.includes("UNIQUE constraint failed")) {
                    return jsonResponse({ error: "User already exists." }, 400);
                }
                console.error("User Registration Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // POST /folders - Create a new folder
        if (method === "POST" && pathname === "/folders") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const body = await request.json().catch(() => ({}));
            const { name, parent_id } = body;

            if (!name) {
                return jsonResponse({ error: "Folder name is required." }, 400);
            }

            try {
                // If parent_id is provided, verify it exists and belongs to the user
                if (parent_id) {
                    const parentFolder = await env.DB.prepare(
                        `SELECT folder_id FROM folders WHERE folder_id = ? AND user_id = ?`
                    ).bind(parent_id, user_id).first();
                    if (!parentFolder) {
                        return jsonResponse({ error: "Parent folder not found." }, 400);
                    }
                }

                // Insert the new folder
                await env.DB.prepare(`
        INSERT INTO folders (folder_id,user_id, parent_folder_id, folder_name, created_at, updated_at) 
        VALUES (?, ?, ?,?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(Date.now() + name + Math.random(), user_id, parent_id || null, name).run();

                return jsonResponse({ success: true, message: "Folder created successfully." });
            } catch (e) {
                console.error("Create Folder Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /folders - Retrieve all folders for the authenticated user
        if (method === "GET" && pathname === "/folders") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            try {
                const folders = await env.DB.prepare(`
      SELECT folder_id, parent_folder_id, folder_name, created_at, updated_at 
      FROM folders 
        WHERE user_id = ?
        ORDER BY folder_name ASC
      `).bind(user_id).all();

                return jsonResponse(folders.results || []);
            } catch (e) {
                console.error("Get Folders Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        const deleteFolderMatch = pathname.match(/^\/folders\/([^/]+)$/);
        if (method === "DELETE" && deleteFolderMatch) {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const folder_id = decodeURIComponent(deleteFolderMatch[1]);
            if (!folder_id) {
                return jsonResponse({ error: "Folder id is required." }, 400);
            }

            if (folder_id === default_parent_folder) {
                return jsonResponse({ error: "Cannot delete the default folder." }, 400);
            }

            try {
                const ownsFolder = await env.DB.prepare(`
        SELECT folder_id FROM folders WHERE folder_id = ? AND user_id = ?
      `).bind(folder_id, user_id).first();

                if (!ownsFolder) {
                    return jsonResponse({ error: "Folder not found." }, 404);
                }

                const subtree = await env.DB.prepare(`
        WITH RECURSIVE folder_tree AS (
          SELECT folder_id FROM folders WHERE folder_id = ? AND user_id = ?
          UNION ALL
          SELECT f.folder_id
          FROM folders f
          INNER JOIN folder_tree ft ON f.parent_folder_id = ft.folder_id
          WHERE f.user_id = ?
        )
        SELECT folder_id FROM folder_tree
      `).bind(folder_id, user_id, user_id).all();

                const folderIds = (subtree.results || []).map((row) => row.folder_id).filter(Boolean);
                if (!folderIds.length) {
                    return jsonResponse({ success: true, deleted_folders: 0, deleted_notes: 0 });
                }

                const placeholders = folderIds.map(() => "?").join(", ");
                const noteBindings = [user_id, ...folderIds];
                let deletedNotes = 0;

                if (placeholders) {
                    const noteCountRow = await env.DB.prepare(
                        `SELECT COUNT(*) AS count FROM notes WHERE user_id = ? AND folder_id IN (${placeholders})`
                    ).bind(...noteBindings).first();
                    deletedNotes = Number(noteCountRow?.count || 0);

                    await env.DB.prepare(
                        `DELETE FROM notes WHERE user_id = ? AND folder_id IN (${placeholders})`
                    ).bind(...noteBindings).run();

                    await env.DB.prepare(
                        `DELETE FROM folders WHERE user_id = ? AND folder_id IN (${placeholders})`
                    ).bind(user_id, ...folderIds).run();
                }

                return jsonResponse({
                    success: true,
                    deleted_folders: folderIds.length,
                    deleted_notes: deletedNotes
                });
            } catch (e) {
                console.error("Delete Folder Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /folders/:id/contents - Get folder contents
        const folderContentsMatch = pathname.match(/^\/folders\/(.+)\/contents$/);
        if (method === "GET" && folderContentsMatch) {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const folder_id = (folderContentsMatch[1]);
            try {
                const subFolders = await env.DB.prepare(`
        SELECT folder_id, parent_folder_id, folder_name, created_at, updated_at
        FROM folders 
        WHERE  parent_folder_id = ?
        ORDER BY folder_name ASC
      `).bind(folder_id).all();

                return jsonResponse(subFolders.results || { folder_id });
            } catch (e) {
                console.error("Get Folder Contents Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /folders/:id/notes - Get notes in folder
        const folderNotesMatch = pathname.match(/^\/folders\/(.+)\/notes$/);
        if (method === "GET" && folderNotesMatch) {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const folder_id = (folderNotesMatch[1]);
            try {
                const notes = await env.DB.prepare(`
        SELECT note_id, title, folder_id,user_id, last_updated
        FROM notes 
        WHERE  folder_id = ? AND user_id = ?
        ORDER BY title ASc
      `).bind(folder_id, user_id).all();

                return jsonResponse(notes.results || { folder_id });
            } catch (e) {
                console.error("Get Folder Notes Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /notes - Get all notes
        if (method === "GET" && pathname === "/notes") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            try {
                const notes = await env.DB.prepare(`
        SELECT note_id, title, folder_id, last_updated 
        FROM notes 
        WHERE user_id = ?
        ORDER BY last_updated DESC
      `).bind(user_id).all();

                return jsonResponse(notes.results || []);
            } catch (e) {
                console.error("Get Notes Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /notes/:id - Get a single note
        const noteIdMatch = pathname.match(/^\/notes\/(.+)$/);
        if (method === "GET" && noteIdMatch) {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const note_id = (noteIdMatch[1]);
            try {
                const note = await env.DB.prepare(`
        SELECT note_id, title, folder_id, last_updated, content 
        FROM notes 
        WHERE note_id = ? AND user_id = ?
      `).bind(note_id, user_id).first();

                if (!note) {
                    return jsonResponse({ error: "Note not found." }, 404);
                }

                return jsonResponse(note);
            } catch (e) {
                console.error("Get Single Note Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // POST /notes - Create or Update a note
        if (method === "POST" && pathname === "/notes") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const body = await request.json().catch(() => ({}));
            let { title, content, note_id, folder_id } = body;

            if (!title || !content) {
                return jsonResponse({ error: "Missing title or content." }, 400);
            }

            try {


                // Check if the note exists
                const existingNote = await env.DB.prepare(`
        SELECT note_id FROM notes WHERE note_id = ?
      `).bind(note_id).first();

                if (existingNote) {
                    // Update the note content and timestamp
                    await env.DB.prepare(`
            UPDATE notes 
            SET  title=?, content=?,last_updated=CURRENT_TIMESTAMP 
            WHERE note_id =?
          `).bind(title, content, note_id).run();



                    return jsonResponse({ success: true, message: "Note updated successfully.", note_id: note_id, content: content });
                } else {
                    // Insert new note
                    const insertNote = await env.DB.prepare(`
          INSERT INTO notes (note_id,user_id, folder_id, title,content, last_updated, created_at) 
          VALUES (?,?, ?, ?, ?,CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(note_id, user_id, folder_id || "1733485657799jj0.5911120915160637", title, content).run();


                    return jsonResponse({ success: true, message: "Note created successfully." });
                }
            } catch (e) {
                console.error("Create/Update Note Error:", e);
                return jsonResponse({ error: e.toString() }, 500);
            }
        }

        // GET /search?term=... - Search notes and folders by keyword
        if (method === "GET" && pathname === "/search") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const term = (searchParams.get("term") || "").trim();
            if (!term) {
                return jsonResponse({ error: "Search term is required." }, 400);
            }

            try {
                const likeTerm = `%${term}%`;
                const lowerTerm = term.toLowerCase();

                const noteRows = await env.DB.prepare(`
        SELECT n.note_id, n.title, n.folder_id, n.last_updated, n.content, f.folder_name
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.folder_id
        WHERE n.user_id = ? AND (n.title LIKE ? OR n.content LIKE ?)
        ORDER BY n.last_updated DESC
        LIMIT 50
      `).bind(user_id, likeTerm, likeTerm).all();

                const folderRows = await env.DB.prepare(`
        SELECT folder_id, parent_folder_id, folder_name
        FROM folders
        WHERE user_id = ? AND folder_name LIKE ?
        ORDER BY folder_name ASC
        LIMIT 20
      `).bind(user_id, likeTerm).all();

                const notes = (noteRows.results || []).map((row) => {
                    const title = row.title || "Untitled";
                    const content = row.content || "";
                    const contentMatch = content.toLowerCase().includes(lowerTerm);
                    const match_field = contentMatch ? "content" : "title";
                    const snippetSource = contentMatch ? content : title;
                    return {
                        type: "note",
                        note_id: row.note_id,
                        title,
                        folder_id: row.folder_id,
                        folder_name: row.folder_name || null,
                        last_updated: row.last_updated,
                        match_field,
                        snippet: buildSnippet(snippetSource, term)
                    };
                });

                const folders = (folderRows.results || []).map((row) => ({
                    type: "folder",
                    folder_id: row.folder_id,
                    parent_folder_id: row.parent_folder_id,
                    folder_name: row.folder_name
                }));

                return jsonResponse({ term, notes, folders });
            } catch (e) {
                console.error("Search Notes Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // GET /users/config - Get user config
        if (method === "GET" && pathname === "/users/config") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            try {
                const configRow = await env.DB.prepare(`
        SELECT config FROM user_config WHERE user_id = ?
      `).bind(user_id).first();

                if (!configRow) {
                    return jsonResponse({ config: "{}" });
                }

                return jsonResponse({ config: configRow.config });
            } catch (e) {
                console.error("Get User Config Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // POST /users/config - Update user config
        if (method === "POST" && pathname === "/users/config") {
            const user_id = await authenticate(request);
            if (!user_id) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }

            const body = await request.json().catch(() => ({}));
            const { config } = body;

            if (typeof config !== "string") {
                return jsonResponse({ error: "Config must be a JSON string." }, 400);
            }

            try {
                const existing = await env.DB.prepare(`
        SELECT user_id FROM user_config WHERE user_id = ?
      `).bind(user_id).first();

                if (existing) {
                    // Update existing config
                    await env.DB.prepare(`
          UPDATE user_config 
          SET config = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ?
        `).bind(config, user_id).run();
                } else {
                    // Insert new config
                    await env.DB.prepare(`
          INSERT INTO user_config (user_id, config, updated_at) 
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(user_id, config).run();
                }

                return jsonResponse({ success: true, message: "User config updated successfully." });
            } catch (e) {
                console.error("Update User Config Error:", e);
                return jsonResponse({ error: "Internal Server Error" }, 500);
            }
        }

        // If no route matches, return 404
        return jsonResponse({ error: "Not found" }, 404);

    } catch (error) {
        return jsonResponse({ error: error }, 300)
    }
}

/**
 * CORS Headers
 */
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
}

/**
 * JSON Response Helper
 */
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders()
        }
    });
}

function buildSnippet(text = "", term = "", context = 80) {
    const sanitized = stripHTML(text);
    if (!sanitized) return "";
    const normalizedText = sanitized.replace(/\s+/g, " ").trim();
    if (!term) {
        return normalizedText.length > context
            ? `${normalizedText.slice(0, context)}...`
            : normalizedText;
    }

    const lowerText = normalizedText.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);

    if (index === -1) {
        return normalizedText.length > context
            ? `${normalizedText.slice(0, context)}...`
            : normalizedText;
    }

    const halfContext = Math.floor(context / 2);
    const start = Math.max(0, index - halfContext);
    const end = Math.min(normalizedText.length, index + lowerTerm.length + halfContext);
    let snippet = normalizedText.slice(start, end);
    if (start > 0) {
        snippet = `...${snippet}`;
    }
    if (end < normalizedText.length) {
        snippet = `${snippet}...`;
    }
    return snippet;
}

function stripHTML(input = "") {
    if (!input) return "";
    return input
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}
