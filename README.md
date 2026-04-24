# 💊 MedAssist AI — Health Prescription Assistant

**[🔴 Live Demo: Click here to open the website directly](https://DhanrajRathod18.github.io/medassist-ai/)**

MedAssist AI is a modern, web-based intelligent health assistant that helps patients easily understand and manage their medical prescriptions. It parses raw prescription text and transforms it into structured, easy-to-follow daily schedules and tracks adherence.

## ✨ Features

- **📝 Smart Prescription Parsing**: Extracts medicines, dosages, durations, and specific instructions from standard prescription text formats.
- **📊 Result Dashboard**: Generates a clear, color-coded daily medication schedule (Morning, Afternoon, Night).
- **💬 Interactive AI Chat**: A built-in AI assistant to answer health questions, provide general medical advice, and clarify prescription doubts.
- **✅ Medication Tracker**: Track your daily medication adherence with progress bars and "taken/missed" logs.
- **🔔 Notification System**: Manage a profile to set up simulated SMS and email reminders.
- **🎨 Modern UI/UX**: A dark-themed, glassmorphism design built for optimal user experience and readability.

## 🛠️ Technologies Used

- **HTML5**: Semantic structure and layout.
- **CSS3**: Custom dark-mode styling, responsive design, animations, and Uiverse-inspired elements (no external libraries like Tailwind).
- **Vanilla JavaScript**: All logic, prescription parsing, routing, and state management built without heavy frontend frameworks.

## 🚀 How to Run Locally

Since this project does not require a build step, it is extremely easy to run locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/DhanrajRathod18/medassist-ai.git
   cd medassist-ai
   ```

2. **Start a local web server** (to avoid CORS issues with modules, though it's plain JS):
   - If using **Python**: `python -m http.server 8000`
   - If using **Node.js**: `npx serve -p 8000`
   - Or simply use the **Live Server** extension in VS Code.

3. **View the App:** Open your browser and navigate to `http://localhost:8000`.

## ⚠️ Disclaimer

This application is built as an AI assistant to *help* patients understand their prescriptions. It is **not** a replacement for a professional doctor or pharmacist. Always consult a physician for official medical advice.
