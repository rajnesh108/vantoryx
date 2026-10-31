# Vantoryx — AI Systems & Inference Platform

Vantoryx is an AI engineering platform for building and running intelligent applications using Retrieval-Augmented Generation (RAG), vector search, local Large Language Models (LLMs), and embedding services.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Services](#project-services)
- [1. Start PostgreSQL and pgAdmin](#1-start-postgresql-and-pgadmin)
- [2. Start Ollama](#2-start-ollama)
- [3. Start the Embedding Server](#3-start-the-embedding-server)
- [4. Start the Backend Server](#4-start-the-backend-server)
- [5. Start the Frontend Server](#5-start-the-frontend-server)
- [Access URLs](#access-urls)
- [Troubleshooting](#troubleshooting)
- [Shutdown](#shutdown)

## Prerequisites

Ensure the following tools are installed and configured on your machine.

| Tool | Purpose |
|---|---|
| Python | Run JupyterLab and the embedding service |
| Node.js and npm | Run the frontend and backend applications |
| Docker Desktop | Run PostgreSQL and pgAdmin containers |
| Ollama | Run local LLMs |
| PostgreSQL with pgvector | Store vector embeddings and support similarity search |
| JupyterLab | Development environment for Python and AI experiments |

## Project Services

Vantoryx consists of the following services:

| Service | Description | Default URL |
|---|---|---|
| Frontend Server | User interface for interacting with Vantoryx | http://localhost:5173 |
| Backend Server | API and application logic | Configured by the backend |
| Embedding Server | Generates vector embeddings | http://127.0.0.1:8000 |
| Ollama | Runs local LLM models | http://127.0.0.1:11434 |
| llama.cpp | Local GGUF chat server | http://127.0.0.1:8081/v1 |
| PostgreSQL | Database with pgvector support | localhost:5432 |
| pgAdmin | Web-based PostgreSQL administration | http://localhost:8080/browser/ |
| JupyterLab | Python development environment | http://localhost:8888 (default) |

## 1. Start PostgreSQL and pgAdmin

Docker allows applications to run inside lightweight, isolated environments called containers.

### Services

The `docker-compose.yml` file defines two containers:

1. **postgresDb** — Runs PostgreSQL using the `pgvector/pgvector` Docker image to support vector storage and similarity search.
2. **pgadmin** — Provides a web-based interface for managing the PostgreSQL database.

### Start the containers

Open a terminal and navigate to the directory containing your `docker-compose.yml` file.

```powershell
docker compose up -d
```

### Check container status

```powershell
docker compose ps
```

### Open pgAdmin

Navigate to:

http://localhost:8080/browser/

Use the credentials configured in your Docker Compose environment.

To connect pgAdmin to PostgreSQL when both services are in the same Docker Compose network, use the following connection settings:

| Setting | Value |
|---|---|
| Host name/address | `postgresDb` |
| Port | `5432` |
| Maintenance database | `healthcare` |
| Username | `postgres` |
| Password | Your configured PostgreSQL password |

> **Note:** The database name, username, and hostname above match the current project configuration. Update them if your Docker Compose settings change.

## 2. Start Ollama

Ollama allows you to run Large Language Models locally without requiring a cloud-based LLM API.

### Installation

1. Download the Windows Ollama package (`ollama-windows-amd64.zip`) if using the standalone distribution.
2. Extract the package according to the installation instructions.
3. Ensure the Ollama executable is available in your terminal or use its full path.

If Ollama is installed normally and added to your system PATH, you can run it directly from PowerShell.

### Start the Ollama server

Open **Terminal 1** and execute:

```powershell
ollama serve
```

Keep this terminal open while using the local LLM.

### Download a model

Open **Terminal 2** and execute:

```powershell
ollama pull llama3.1
```

This downloads the Llama 3.1 model to your local machine.

### Run the model

```powershell
ollama run llama3.1
```

### Verify the Ollama API

Ollama's default local API endpoint is:

http://127.0.0.1:11434

Check the installed models:

```powershell
ollama list
```

## 3. Start the Embedding Server

The embedding server generates vector representations of text for semantic search and RAG retrieval.

### Navigate to the embedding server

Replace the path below with your actual project directory.

```powershell
cd C:\path\to\AI\vantoryx\embedding-server
```

### Start the service

If the Python virtual environment and dependencies are already configured, execute:

```powershell
.\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000
```

The embedding service will listen on:

http://127.0.0.1:8000

Keep the terminal running while the backend uses the embedding service.

> **Note:** If the virtual environment has not been created, create it and install the dependencies specified in the embedding server's `requirements.txt` or project setup instructions before starting the service.

## 4. Start the Backend Server

The backend handles application logic, API requests, database operations, and communication with the embedding service and LLM provider.

### Navigate to the backend directory

```powershell
cd C:\Users\Rajnesh.Thakur\AI\vantoryx\backend-server
```

### Install dependencies

```powershell
npm install
```

### Start the development server

```powershell
npm run dev
```

The backend will start on the port configured in its environment variables or application configuration.

Keep the terminal running while using the application.

## 5. Start the Frontend Server

The frontend provides the user interface for interacting with the Vantoryx platform.

### Navigate to the frontend directory

```powershell
cd C:\Users\Rajnesh.Thakur\AI\vantoryx\frontend-server
```

### Install dependencies

```powershell
npm install
```

### Start the development server

```powershell
npm run dev
```

Open the application in your browser:

http://localhost:5173

## Access URLs

| Component | URL |
|---|---|
| Vantoryx Frontend | http://localhost:5173 |
| pgAdmin | http://localhost:8080/browser/ |
| Embedding Server | http://127.0.0.1:8000 |
| Ollama API | http://127.0.0.1:11434 |
| JupyterLab | http://localhost:8888 (default) |

The backend URL depends on the port configured in the backend application.

## Troubleshooting

### Docker containers are not running

Check their status:

```powershell
docker compose ps
```

Review the container logs:

```powershell
docker compose logs -f
```

### PostgreSQL connection issues

Verify that the database container is healthy:

```powershell
docker exec postgresDb pg_isready -U postgres -d healthcare
```

When connecting from pgAdmin running in Docker, use `postgresDb` as the hostname rather than `localhost`.

### Ollama connection issues

Verify that the Ollama server is running:

```powershell
ollama list
```

Check that the local API is accessible:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

If the command cannot connect, start the Ollama server:

```powershell
ollama serve
```

### Node.js dependency issues

From the affected frontend or backend directory, reinstall dependencies if necessary:

```powershell
npm install
npm run dev
```

### Embedding server startup issues

Ensure the Python virtual environment exists and that the required dependencies are installed. Confirm that port `8000` is not already being used by another process.

## Shutdown

### Stop the frontend and backend

Press `Ctrl + C` in each terminal running a development server.

### Stop the embedding server

Press `Ctrl + C` in the embedding server terminal.

### Stop Ollama

If you started Ollama manually using `ollama serve`, press `Ctrl + C` in its terminal after stopping dependent applications.

### Stop Docker containers

Navigate to the directory containing your `docker-compose.yml` file and execute:

```powershell
docker compose down
```

This stops and removes the containers but preserves named volumes, including database data, unless those volumes are explicitly removed.

## JupyterLab

JupyterLab provides an interactive development environment for Python code, notebooks, and AI experimentation.

Start JupyterLab from your terminal:

```powershell
python -m pip install jupyterlab
python -m jupyterlab
```

By default, JupyterLab opens in your browser at a local URL, usually:

http://localhost:8888

## Development Workflow

For local development, start the services in this order:

1. PostgreSQL and pgAdmin using Docker Compose.
2. Ollama and the required local LLM.
3. The embedding server.
4. The backend server.
5. The frontend server.

Once all required services are running, open http://localhost:5173 to use Vantoryx.

---

**Vantoryx — AI Systems & Inference Platform**

Building production-oriented AI applications with retrieval, embeddings, local inference, and scalable software architecture.
