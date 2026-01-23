<div align="center">
<img width="1200" height="475" alt="DBF Nexus Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DBF Nexus Professional

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

The ultimate browser-based power tool for dBase tables. Securely view and edit DBF files with virtualized scroll, multi-format exports, and professional metadata analysis. No server uploads required - everything stays in your browser.

## ✨ Features

- **🚀 Virtualized Table**: Smooth scrolling with large datasets (millions of records)
- **🔍 Advanced Search**: Full-text search across all fields with instant results
- **📊 Query Builder**: Add complex filter conditions with logical operators
- **🔄 Find & Replace**: Bulk replace text across fields with confirmation dialogs
- **📑 Multi-Tab Support**: Open multiple DBF files simultaneously
- **📈 Data Statistics**: Dynamic statistics for numeric fields (sum, avg, min, max)
- **📋 Column Management**: Show/hide columns and adjust widths
- **📥 Export Options**: Export to DBF, CSV, or JSON formats
- **🌙 Dark Mode**: Toggle between light and dark themes
- **🔄 Live Updates**: Detect background file changes and highlight updates
- **📱 PWA Ready**: Install as a desktop app with offline capabilities
- **🎯 Data Inspector**: Detailed field analysis with type-aware rendering
- **📊 Schema Browser**: Professional metadata analysis and table architecture view

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Modern web browser with File System Access API support

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/dbf-nexus.git
   cd dbf-nexus
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## 📖 Usage

1. **Load DBF Files**: Click "SELECT DBF FILE" or drag and drop DBF files anywhere on the page
2. **Navigate Data**: Use virtualized scrolling for large datasets
3. **Search & Filter**: Use the search bar or query builder for targeted data views
4. **Edit Data**: Double-click cells to edit, right-click for context menu actions
5. **Export Data**: Choose from DBF, CSV, or JSON export formats
6. **Analyze Schema**: Use the sidebar to inspect metadata and statistics

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Font Awesome
- **PWA**: Service Worker with offline capabilities
- **File Parsing**: Custom DBF parser with support for dBase III+, FoxPro, Visual FoxPro

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies for maximum compatibility
- Inspired by the need for powerful, browser-based database tools
- Special thanks to the dBase and FoxPro communities
