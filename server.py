from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_mistralai import MistralAIEmbeddings, ChatMistralAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import Optional
import shutil, os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

embedding_model = MistralAIEmbeddings()
llm = ChatMistralAI(model="mistral-small-2506")

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful AI assistant.
Use ONLY the provided context to answer the question.
If the answer is not present in the context, say: "I could not find the answer in the document." """),
    ("human", "Context:\n{context}\n\nQuestion:\n{question}")
])

# FIX: one vectorstore/retriever PER session instead of one global pair
sessions: dict[str, dict] = {}

def require_session_id(x_session_id: Optional[str] = Header(default=None, alias="X-Session-Id")):
    if not x_session_id:
        raise HTTPException(status_code=400, detail="Missing X-Session-Id header")
    return x_session_id

class Question(BaseModel):
    question: str

# ── API routes FIRST ──────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile = File(...), session_id: str = Depends(require_session_id)):
    existing = sessions.get(session_id)
    if existing:
        existing["vectorstore"].delete_collection()
        del sessions[session_id]
    path = f"/tmp/temp_{session_id}_{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    loader = PyPDFLoader(path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_documents(docs)

    # collection_name scopes the data to this session, so sessions never mix
    vectorstore = Chroma.from_documents(
        chunks,
        embedding_model,
        collection_name=f"session_{session_id}",
        persist_directory="/tmp/chroma_pdftesting_db"
    )
    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 4, "fetch_k": 10, "lambda_mult": 0.5}
    )

    sessions[session_id] = {"vectorstore": vectorstore, "retriever": retriever}

    os.remove(path)
    return {"message": "ok"}


@app.post("/ask")
async def ask(q: Question, session_id: str = Depends(require_session_id)):
    session = sessions.get(session_id)
    if not session:
        return {"answer": "Please upload a PDF first.", "sources": []}

    docs = session["retriever"].invoke(q.question)
    context = "\n\n".join(d.page_content for d in docs)
    final = prompt.invoke({"context": context, "question": q.question})
    response = llm.invoke(final)
    return {"answer": response.content, "sources": []}


@app.delete("/document")
async def delete_document(session_id: str = Depends(require_session_id)):
    session = sessions.get(session_id)
    if not session:
        return {"message": "No document loaded."}
    session["vectorstore"].delete_collection()
    del sessions[session_id]
    return {"message": "deleted"}


# ── FIX 1: Serve frontend LAST so API routes are not intercepted ──────────────
@app.get("/style.css")
async def serve_css():
    return FileResponse("frontend/style.css", media_type="text/css")

@app.get("/app.js")
async def serve_js():
    return FileResponse("frontend/app.js", media_type="application/javascript")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse("frontend/index.html")
