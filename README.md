# PaperForge — Question Paper Generator System

**PaperForge** is a web-based Question Paper Generator System developed as a BCA academic project at Galgotias University. It provides a centralized workspace for managing academic questions, organizing them by course and subject, and generating question-bank documents.

The project combines a web-based user interface, a Node.js and Express.js backend, MongoDB database integration, and a locally configured Ollama AI integration for question generation.

## Table of Contents

- [Project Overview](#project-overview)
- [Objectives](#objectives)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [System Requirements](#system-requirements)
- [Installation and Setup](#installation-and-setup)
- [Running the Application](#running-the-application)
- [Database Configuration](#database-configuration)
- [AI Integration](#ai-integration)
- [Available Modules](#available-modules)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)
- [Academic Information](#academic-information)

## Project Overview

PaperForge is designed to simplify the organization and preparation of academic questions. It allows users to work with questions categorized by course, semester, subject, unit, question type, and difficulty level.

The system retrieves stored questions from a database and provides a workspace for searching, viewing, filtering, and generating question-bank documents. The application also includes question-paper workflows and an AI-assisted question-generation integration.

The main goal is to reduce repetitive manual work involved in organizing questions and preparing educational documents.

## Objectives

- Develop a web-based question management system.
- Organize academic questions by course, semester, subject, unit, and topic.
- Provide a searchable question bank.
- Support question generation through a configured AI integration.
- Generate question-bank documents from matching stored questions.
- Support printing and saving generated documents as PDF.
- Integrate the frontend, backend, and database into one application.

## Features

### 1. Question Bank Management

- Retrieve questions from the configured database.
- Search stored questions using relevant keywords.
- Filter questions by course, semester, subject, unit, type, and difficulty.
- View question details and available answers.
- Access editing and deletion controls.

### 2. Question Bank Document Generation

- Select course and academic filters.
- Generate a document using matching stored questions.
- Include available answers in the generated document.
- Preview the generated content.
- Print the document or save it as PDF using the browser's print dialog.

### 3. AI-Assisted Question Generation

- Integrate with Ollama for locally configured AI question generation.
- Generate questions according to the application's supported inputs.
- Use the configured backend and available question-generation logic.

AI generation depends on the local Ollama service, selected model, and application configuration.

### 4. Course and Subject Organization

- Organize questions by academic course and semester.
- Associate questions with subjects, units, and topics.
- Support course and subject filters in the relevant modules.

### 5. Question Paper Workflow

The application includes a separate question-paper module for working with question-paper generation and previous-paper functionality.

Available operations depend on the current implementation and the database configuration.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Web page structure |
| CSS3 | Layout and styling |
| JavaScript | Frontend interaction and application logic |
| Node.js | Backend JavaScript runtime |
| Express.js | Web server and API routes |
| MongoDB | Question and application data storage |
| Ollama | Local AI model integration |
| Git and GitHub | Version control and project hosting |

## Project Structure

The main project files include:

```text
Question-Paper-Generator/
├── public/
│   ├── dashboard.html
│   ├── generate-paper.html
│   ├── question-bank.html
│   ├── previous-papers.html
│   ├── create-question.html
│   └── ...
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
├── .env
└── README.md
```

**Note:** The exact file structure may vary depending on the current project version. The `.env` file is local configuration and should not be uploaded to a public repository.

## System Requirements

Before running PaperForge, make sure the following are available:

- Windows, Linux, or another supported operating system.
- Node.js installed.
- npm available with the Node.js installation.
- Project dependencies installed.
- A valid MongoDB connection and appropriate database permissions.
- Ollama and a compatible local model if using AI question generation.
- A modern web browser.

## Installation and Setup

### Step 1: Clone the Repository

If the project is hosted on GitHub:

```bash
git clone-https://github.com/CodeWithAnkit19/Question-paper-generated-system
```

Open the project directory:

```bash
cd Question-Paper-Generator
```

Alternatively, open your existing project folder directly in Visual Studio Code.

### Step 2: Install Dependencies

For a fresh clone, install the dependencies declared in `package.json`:

```bash
npm install
```

This command installs dependencies; it does **not** start the application.

If the dependencies are already installed in your existing project, you generally do not need to run this command again unless dependencies have changed or need to be restored.

### Step 3: Configure Environment Variables

Create or update your local `.env` file according to the configuration expected by `server.js`.

Add the required MongoDB connection settings and any other environment variables used by the backend.

Do not copy private credentials into this README or commit them to GitHub.

### Step 4: Configure MongoDB

Ensure the configured MongoDB database is accessible and that the database user has the required permissions.

The application must be able to connect to the database before database-dependent features can work.

### Step 5: Configure Ollama (Optional)

If using AI question generation, install and start Ollama, download a compatible model, and configure the application to use the model as required by its backend code.

AI features will not work correctly if the Ollama service or required model is unavailable.

## Running the Application

PaperForge is started using the Node.js server file.

### Start the Server

Open a terminal in the project directory:

```powershell
cd "C:\BCA PROJECT\Question-Paper-Generator"
```

Run:

```powershell
node server.js
```

Wait for the server startup message in the terminal.

**Important:** Use `node server.js` to start the application. Running `npm install` only installs dependencies.

### Open the Web Application

Once the server starts, open your browser and visit the local address configured by `server.js`.

For example, if the server listens on port `3000`, open:

```text
http://localhost:3000
```

Use the actual port and route configured in your project if they differ.

Keep the terminal running while using the application. To stop the server, press `Ctrl + C` in the terminal.

## Database Configuration

PaperForge uses MongoDB for storing and retrieving questions and other supported application data.

Database functionality depends on:

- A valid connection string.
- Correct database credentials.
- Network access to the database.
- Appropriate database permissions.
- The collection names and schema expected by the backend.

Do not publish database passwords, connection strings containing credentials, or other secrets.

## AI Integration

PaperForge includes an Ollama-based question-generation integration.

AI generation depends on:

- Ollama being installed and running.
- A compatible model being available locally.
- Correct backend configuration.
- The model being able to generate output compatible with the application.
- The application's question validation and duplicate-handling logic.

AI-generated questions should be reviewed for correctness, relevance, and academic suitability before being used.

## Available Modules

The project includes the following primary web modules:

- **Dashboard:** Main application workspace.
- **Generate Paper:** Question-paper generation interface.
- **Question Bank:** Stored question search, filtering, management, and document generation.
- **Previous Papers:** Previous-paper workflow.
- **Create Question:** Interface for creating questions.

The availability of individual features depends on the current backend routes and frontend implementation.

## Security

- Never commit `.env` files containing credentials.
- Never publish MongoDB passwords, API keys, session secrets, or recovery codes.
- Use authentication and authorization checks for protected operations.
- Review files before pushing them to a public GitHub repository.
- Keep dependencies updated and use trusted packages.
- Do not expose database access or administrative endpoints unnecessarily.

## Troubleshooting

### Application does not start

Run:

```bash
node server.js
```

Check the terminal for missing dependencies, syntax errors, port conflicts, or configuration errors.

### MongoDB connection fails

Verify the connection string, credentials, network access rules, and database permissions.

### AI question generation fails

Check that Ollama is running, the configured model is installed, and the backend is using the correct model configuration.

### Questions do not appear

Verify the database connection, stored data, API response, and browser console for errors.

### Local website does not open

Confirm that the server is running and that the browser URL uses the correct host and port.

## Future Enhancements

Possible future improvements include:

- Improved duplicate-question detection.
- More flexible course and subject management.
- Enhanced question-paper templates.
- Better question difficulty classification.
- Additional export formats.
- Improved validation of AI-generated questions.
- Expanded reporting and question-bank analytics.

## Academic Information

**Project Name:** PaperForge — Question Paper Generator System

**Project Type:** BCA Academic Project

**Institution:** Galgotias University

**Development Environment:** Visual Studio Code

**Primary Backend Command:** `node server.js`

---

PaperForge is an academic project intended to explore web application development, database integration, question-bank management, document generation, and AI-assisted educational workflows.
