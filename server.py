from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_mistralai import MistralAIEmbeddings, ChatMistralAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import shutil, os

load_dotenv()
app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

embedding_model = MistralAIEmbeddings()
llm = ChatMistralAI(model="mistral-small-2506")

prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful AI assistant.
Use ONLY the provided context to answer the question.
If the answer is not present in the context, say: "I could not find the answer in the document." """),
    ("human", "Context:\n{context}\n\nQuestion:\n{question}")
])

vectorstore = None
retriever = None

class Question(BaseModel):
    question: str

@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    global vectorstore, retriever

    # Save uploaded PDF temporarily
    path = f"temp_{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Load & chunk
    loader = PyPDFLoader(path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_documents(docs)

    # Embed into Chroma
    vectorstore = Chroma.from_documents(chunks, embedding_model, persist_directory="chroma_pdftesting_db")
    retriever = vectorstore.as_retriever(search_type="mmr", search_kwargs={"k": 4, "fetch_k": 10, "lambda_mult": 0.5})

    os.remove(path)
    return {"message": "ok"}

@app.post("/ask")
async def ask(q: Question):
    if retriever is None:
        return {"answer": "Please upload a PDF first.", "sources": []}

    docs = retriever.invoke(q.question)
    context = "\n\n".join(d.page_content for d in docs)
    final = prompt.invoke({"context": context, "question": q.question})
    response = llm.invoke(final)
    return {"answer": response.content, "sources": []}

# Serve the frontend HTML/CSS/JS files
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

@app.delete("/document")
async def delete_document():
    global vectorstore, retriever

    if vectorstore is None:
        return {"message": "No document loaded."}

    # Clear all data from Chroma
    vectorstore.delete_collection()
    vectorstore = None
    retriever = None

    return {"message": "deleted"}