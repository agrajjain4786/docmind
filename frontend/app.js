/* ============================================================
   DocMind — app.js
   Connects the UI to the Python RAG backend via fetch().
   Change API_BASE to match your FastAPI / Flask server URL.
   ============================================================ */

const API_BASE = "http://localhost:8000"; // ← update to your backend URL

/* ── DOM refs ─────────────────────────────────────────── */
const chatWindow    = document.getElementById("chatWindow");
const welcomeScreen = document.getElementById("welcomeScreen");
const queryInput    = document.getElementById("queryInput");
const sendBtn       = document.getElementById("sendBtn");
const clearBtn      = document.getElementById("clearBtn");
const fileInput     = document.getElementById("fileInput");
const uploadZone    = document.getElementById("uploadZone");
const activeDoc     = document.getElementById("activeDoc");
const historyList   = document.getElementById("historyList");
const contextChips  = document.getElementById("contextChips");
const topbarStatus  = document.getElementById("topbarStatus");
const statusDot     = topbarStatus.querySelector(".status-dot");
const statusText    = topbarStatus.querySelector(".status-text");
const sidebar       = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const menuBtn       = document.getElementById("menuBtn");

/* ── State ────────────────────────────────────────────── */
let chatHistory  = [];
let loadedDoc    = null;
let isProcessing = false;

/* ── Status helper ────────────────────────────────────── */
function setStatus(state, label) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = label;
}

/* ── Toast ────────────────────────────────────────────── */
function showToast(msg, type = "info") {
  const icons = { success: "✓", error: "✕", info: "⬡" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || "⬡"}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = "toastOut .3s ease forwards";
    setTimeout(() => t.remove(), 350);
  }, 3000);
}

/* ── Sidebar toggle ───────────────────────────────────── */
sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  sidebar.classList.toggle("open"); // mobile
});
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

/* ── Auto-resize textarea ─────────────────────────────── */
queryInput.addEventListener("input", () => {
  queryInput.style.height = "auto";
  queryInput.style.height = Math.min(queryInput.scrollHeight, 140) + "px";
});

/* ── Enter to send ────────────────────────────────────── */
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});
sendBtn.addEventListener("click", handleSend);

/* ── File upload (drag-and-drop + click) ──────────────── */
uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") handleUpload(file);
  else showToast("Please drop a PDF file.", "error");
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleUpload(fileInput.files[0]);
});

async function handleUpload(file) {
  loadedDoc = null;
  updateDocCard(null);
  setStatus("loading", "Uploading…");
  sendBtn.disabled = true;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }

    const data = await res.json();
    loadedDoc = file.name;
    updateDocCard(file.name);
    setStatus("done", "Ready");
    sendBtn.disabled = false;
    showToast(`"${file.name}" loaded successfully!`, "success");
    addContextChip(file.name);

  } catch (err) {
    setStatus("error", "Error");
    showToast(err.message, "error");
    sendBtn.disabled = false;
  }
}

function updateDocCard(name) {
  const docName = activeDoc.querySelector(".doc-name");
  const docMeta = activeDoc.querySelector(".doc-meta");
  if (name) {
    docName.textContent = name.length > 26 ? name.slice(0, 24) + "…" : name;
    docMeta.textContent = "Active document";
    activeDoc.classList.add("active");
  } else {
    docName.textContent = "No document loaded";
    docMeta.textContent = "Upload a PDF to begin";
    activeDoc.classList.remove("active");
  }
}

function addContextChip(name) {
  contextChips.innerHTML = "";
  const chip = document.createElement("span");
  chip.className = "ctx-chip";
  chip.textContent = `📄 ${name.length > 22 ? name.slice(0, 20) + "…" : name}`;
  contextChips.appendChild(chip);
}

/* ── Send message ─────────────────────────────────────── */
async function handleSend() {
  const query = queryInput.value.trim();
  if (!query || isProcessing) return;

  // Hide welcome screen on first message
  if (welcomeScreen) welcomeScreen.style.display = "none";

  // Append user bubble
  appendMessage("user", query);
  addToHistory(query);

  // Clear input
  queryInput.value = "";
  queryInput.style.height = "auto";
  isProcessing = true;
  sendBtn.disabled = true;
  setStatus("loading", "Thinking…");

  // Typing indicator
  const typingEl = appendTyping();

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: query }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Server error" }));
      throw new Error(err.detail || "Server error");
    }

    const data = await res.json();
    typingEl.remove();

    appendMessage("ai", data.answer, data.sources || []);
    setStatus("done", "Done");

  } catch (err) {
    typingEl.remove();
    appendMessage("ai", `⚠ ${err.message}`, [], true);
    setStatus("error", "Error");
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    queryInput.focus();
  }
}

/* ── Append message bubble ────────────────────────────── */
function appendMessage(role, text, sources = [], isError = false) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "U" : "⬡";

  const bubble = document.createElement("div");
  bubble.className = "bubble" + (isError ? " error-bubble" : "");

  // Simple markdown-ish: bold, inline code
  bubble.innerHTML = formatText(text);

  // Source chips
  if (sources.length > 0) {
    const sc = document.createElement("div");
    sc.className = "source-chips";
    sources.forEach(s => {
      const chip = document.createElement("span");
      chip.className = "source-chip";
      chip.textContent = `📎 ${s}`;
      sc.appendChild(chip);
    });
    bubble.appendChild(sc);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  scrollBottom();

  chatHistory.push({ role, content: text });
  return wrap;
}

function formatText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(245,166,35,.12);padding:1px 5px;border-radius:4px;font-size:12px'>$1</code>")
    .replace(/\n/g, "<br>");
}

/* ── Typing indicator ─────────────────────────────────── */
function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "message ai";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "⬡";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  scrollBottom();
  return wrap;
}

/* ── Scroll to bottom ─────────────────────────────────── */
function scrollBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: "smooth" });
}

/* ── History ──────────────────────────────────────────── */
function addToHistory(query) {
  const el = historyList.querySelector(".empty-history");
  if (el) el.remove();

  const item = document.createElement("div");
  item.className = "history-item";
  item.textContent = query.length > 32 ? query.slice(0, 30) + "…" : query;
  item.title = query;
  historyList.prepend(item);
}

/* ── Clear chat ───────────────────────────────────────── */
clearBtn.addEventListener("click", () => {
  chatWindow.innerHTML = "";
  chatWindow.appendChild(welcomeScreen);
  welcomeScreen.style.display = "";
  chatHistory = [];
  historyList.innerHTML = `<p class="empty-history">No conversations yet.</p>`;
  contextChips.innerHTML = "";
  setStatus("idle", "Idle");
  showToast("Chat cleared.", "info");
});
const deleteDocBtn = document.getElementById("deleteDocBtn");

deleteDocBtn.addEventListener("click", async () => {
  if (!loadedDoc) return;
  if (!confirm(`Remove "${loadedDoc}" and clear all its data?`)) return;

  try {
    const res = await fetch(`${API_BASE}/document`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");

    loadedDoc = null;
    updateDocCard(null);
    contextChips.innerHTML = "";
    deleteDocBtn.style.display = "none";
    setStatus("idle", "Idle");
    showToast("Document removed successfully.", "success");
    deleteDocBtn.style.display = "block";

  } catch (err) {
    showToast(err.message, "error");
  }
});
/* ── Init ─────────────────────────────────────────────── */
setStatus("idle", "Idle");
queryInput.focus();

/*
  ─────────────────────────────────────────────────────────
  BACKEND INTEGRATION GUIDE
  ─────────────────────────────────────────────────────────

  This UI expects two REST endpoints on your Python server:

  1. POST /upload
     Body: multipart/form-data  { file: <PDF> }
     Response: { "message": "ok" }

  2. POST /ask
     Body: application/json  { "question": "..." }
     Response: {
       "answer": "...",
       "sources": ["chunk title or page ref", ...]   // optional
     }

  Minimal FastAPI wrapper example:

  from fastapi import FastAPI, UploadFile, File
  from fastapi.middleware.cors import CORSMiddleware
  from pydantic import BaseModel

  app = FastAPI()
  app.add_middleware(CORSMiddleware, allow_origins=["*"],
      allow_methods=["*"], allow_headers=["*"])

  class Question(BaseModel):
      question: str

  @app.post("/upload")
  async def upload(file: UploadFile = File(...)):
      # save, chunk, embed into Chroma here
      return {"message": "ok"}

  @app.post("/ask")
  async def ask(q: Question):
      docs = retriever.invoke(q.question)
      context = "\n\n".join(d.page_content for d in docs)
      final = prompt.invoke({"context": context, "question": q.question})
      response = llm.invoke(final)
      return {"answer": response.content, "sources": []}
  ─────────────────────────────────────────────────────────
*/
