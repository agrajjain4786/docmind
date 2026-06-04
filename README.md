# ⬡ DocMind — RAG PDF Intelligence Bot

A local Retrieval-Augmented Generation (RAG) chatbot that lets you upload any PDF and ask questions about it. Answers are grounded entirely in your document — no hallucinations from outside knowledge.

Built with **Mistral AI**, **LangChain**, **ChromaDB**, and a custom dark-themed frontend.

---

## ✨ Features

- 📄 Upload any PDF through the browser UI
- 🔍 MMR-based semantic retrieval (ChromaDB + Mistral Embeddings)
- 🧠 Answers generated strictly from document context
- 🗑 Delete uploaded document and clear vector store from the UI
- 💬 Chat history sidebar
- ⚡ FastAPI backend with static frontend serving

---

## 🗂 Project Structure

```
docmind/
├── server.py                 # FastAPI backend + RAG logic
├── .env                      # API keys (never commit this!)
├── requirements.txt
├── chroma_pdftesting_db/     # Auto-created vector store (git-ignored)
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/docmind.git
cd docmind
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up your environment variables

Create a `.env` file in the root directory:

```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

Get your free API key at [console.mistral.ai](https://console.mistral.ai)

### 5. Run the server

```bash
uvicorn server:app --reload
```

### 6. Open the app

Visit **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🧪 How to Use

1. Click **"Drop PDF here"** in the sidebar to upload a document
2. Wait for the *"loaded successfully"* toast notification
3. Type your question in the input box and press **Enter**
4. To remove the document and clear all embeddings, click **"🗑 Remove document"**

---

## 📦 Requirements

```
fastapi
uvicorn
python-multipart
pypdf
python-dotenv
langchain
langchain-mistralai
langchain-chroma
langchain-community
chromadb
```

Install all at once:

```bash
pip install fastapi uvicorn python-multipart pypdf python-dotenv langchain langchain-mistralai langchain-chroma langchain-community chromadb
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload a PDF, chunk and embed it |
| `POST` | `/ask` | Ask a question, get a grounded answer |
| `DELETE` | `/document` | Remove document and clear vector store |

---

## ⚙️ Configuration

You can tweak the retrieval settings in `server.py`:

```python
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 4,          # number of chunks returned
        "fetch_k": 10,   # candidates before MMR re-ranking
        "lambda_mult": 0.5  # diversity vs relevance (0=diverse, 1=relevant)
    }
)
```

And the chunking settings:

```python
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100
)
```

---

## 🔒 .gitignore

Make sure your `.gitignore` includes:

```
.env
venv/
chroma_pdftesting_db/
__pycache__/
*.pyc
temp_*.pdf
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| LLM | Mistral AI (`mistral-small-2506`) |
| Embeddings | Mistral AI Embeddings |
| Retrieval | ChromaDB + MMR |
| Backend | FastAPI + Uvicorn |
| PDF Parsing | LangChain PyPDFLoader |
| Frontend | Vanilla HTML / CSS / JS |

---

## 📄 License

MIT — feel free to use, modify, and share.
