# FreeSplit

A simple, self-hosted expense splitting application that makes it easy to track and split expenses among friends, family, or any group. Built with Go (REST API backend) and React (PWA frontend), designed to be easily deployed and self-hosted.

## What is FreeSplit?

FreeSplit is a modern expense splitting application that eliminates the hassle of manually calculating who owes what. Whether you're splitting a dinner bill, managing shared household expenses, or organizing group trips, FreeSplit provides an intuitive interface to track expenses, calculate splits, and simplify debts.

The application generates unique shareable links for each group, allowing multiple people to add expenses and view balances without requiring accounts or logins. All data is stored locally, giving you complete control over your financial information.

## ✨ Features

### Group Management
- **Create Groups** - Create expense groups with auto-generated unique shareable links
- **Multi-Currency Support** - Set currency per group (USD, EUR, GBP, etc.)
- **Group Dashboard** - View group summary, total spending, and member balances at a glance
- **Member Management** - Add, edit, or remove group members anytime
- **My Groups** - Track and access all your groups from a centralized page

### Expense Tracking
- **Add Expenses** - Record expenses with custom names, amounts, and emoji icons
- **Edit & Delete** - Modify or remove expenses with full history tracking
- **Expense Payer** - Designate who paid for each expense
- **Expense List** - View all expenses chronologically with visual indicators

### Advanced Split Types
FreeSplit supports four flexible ways to split expenses:

1. **Equal Split** - Automatically divides expenses equally among selected participants
2. **Amount Split** - Set custom dollar amounts for each person with automatic remainder distribution
3. **Share Split** - Assign integer shares (e.g., 2 shares vs 1 share = 66.67% vs 33.33%)
4. **Percentage Split** - Define precise percentage splits with automatic validation

**Additional Split Features:**
- **Selective Participants** - Include/exclude specific members from any expense
- **Lock Values** - Lock individual amounts or percentages while others adjust automatically
- **Real-time Calculations** - See split amounts update instantly as you type
- **Smart Rounding** - Proper penny distribution ensures totals always match exactly
- **Seamless Switching** - Switch between split types while preserving your custom values

### Debt Management
- **Balance Calculation** - Automatically calculates who owes whom based on all expenses
- **Debt Simplification** - Minimizes the number of transactions needed to settle up
- **Visual Debt Display** - Clear visualization of debts with "lends" and "borrows" sections
- **Spending Summary** - See total spent and net balance per member

### User Experience
- **Progressive Web App (PWA)** - Install on mobile devices for an app-like experience
- **No Login Required** - Access groups via shareable links, no accounts needed
- **Responsive Design** - Optimized for mobile phones, tablets, and desktops
- **Offline Capable** - View cached data even without internet connection
- **Touch-Friendly** - Large buttons and intuitive gestures for mobile use
- **Toast Notifications** - Clear feedback for all actions
- **Clean Interface** - Modern, minimal design focusing on usability

### Technical Features
- **Self-Hosted** - Complete control over your data, no third-party services
- **PostgreSQL Database** - Robust, reliable data persistence
- **RESTful API** - Clean API architecture for potential integrations
- **Docker Support** - Easy deployment with Docker Compose
- **Unlimited Usage** - No user limits, expense limits, or group limits
- **Completely Ad-Free** - No advertisements, tracking, or monetization

## 🚀 Quick Start

FreeSplit can be run in two ways:

### Option 1: Using Docker (Recommended)

The easiest way to get started:

```bash
# Clone the repository
git clone https://github.com/tmfrsyth/freesplit.git
cd freesplit

# Start with Docker
./start-docker.sh
```

Access the application at:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080

### Option 2: Local Development

For development or if you prefer not to use Docker:

```bash
# Clone the repository
git clone https://github.com/tmfrsyth/freesplit.git
cd freesplit

# Run setup script
./setup.sh

# Start the application
./start.sh
```

Access the application at:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8080

## 📖 Usage

1. **Create a Group** - Start by creating a new expense group and adding members
2. **Share the Link** - Send the group link to others so they can add expenses too
3. **Add Expenses** - Record expenses and choose how to split them
4. **View Balances** - Check the Debts page to see who owes what
5. **Settle Up** - Use the simplified debt list to settle balances efficiently

## 🛠️ Technologies

- **Backend**: Go 1.21+ with clean REST API architecture
- **Frontend**: React 18 with TypeScript
- **Database**: PostgreSQL for data persistence
- **Styling**: Tailwind CSS for responsive design
- **Icons**: FontAwesome and Lucide React
- **Notifications**: React Hot Toast
- **PWA**: Service Worker for offline functionality
- **Deployment**: Docker & Docker Compose

## 📚 Documentation

For developers and those interested in contributing:

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development setup, architecture, and contribution guidelines
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment instructions
- **[Backend README](backend/README.md)** - Backend API documentation
- **[Frontend README](frontend/README.md)** - Frontend architecture details

## 🌟 Future Enhancements

Ideas for future features:

- Categorize expenses with custom categories
- Receipt photo uploads and storage
- Payment requests and reminders
- Currency converter for international groups
- Export/import to CSV/Excel
- Recurring transactions for subscriptions
- Multi-language support
- Enhanced offline functionality
- Dark mode theme

## 👥 Authors

- **Thomas Forsyth** - *Team Captain: Initial work and architecture* - [tmfrsyth](https://github.com/tmfrsyth)
- **Kris Sousa** - *Code Monkey: Development and implementation* - [KMFSousa](https://github.com/KMFSousa)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 tmfrsyth

## 💬 Support

For issues, questions, or feature requests, please create an issue in the [GitHub repository](https://github.com/tmfrsyth/freesplit/issues).

## 🙏 Acknowledgments

FreeSplit was built to provide a simple, privacy-focused alternative to commercial expense-splitting apps. We believe in keeping your financial data under your control.

---

**Made with ❤️ for people who split expenses together**
