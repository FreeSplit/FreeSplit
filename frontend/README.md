# FreeSplit Frontend

React Progressive Web App (PWA) frontend for the FreeSplit expense splitting application, built with TypeScript and Tailwind CSS.

## Overview

The frontend is a modern, responsive web application that provides an intuitive interface for managing expense splitting. It's built as a Progressive Web App, making it installable on mobile devices and providing offline capabilities.

## Project Structure

```
src/
├── App.tsx                 # Main application component
├── App.css                 # Global styles
├── index.tsx              # Application entry point
├── index.css              # Global CSS imports
├── pages/                 # Page components
│   ├── AddExpense.tsx     # Add new expense page
│   ├── CreateGroup.tsx    # Create new group page
│   ├── Debts.tsx          # View and manage debts page
│   ├── EditExpense.tsx    # Edit existing expense page
│   ├── GroupDashboard.tsx # Main group dashboard
│   └── Members.tsx        # Manage group members page
├── services/              # API and utility services
│   └── api.ts            # REST API client
└── serviceWorkerRegistration.ts # PWA service worker
```

## Key Features

### Responsive Design
- Mobile-first design approach
- Optimized for both desktop and mobile devices
- Touch-friendly interface elements
- Responsive grid layouts

### Progressive Web App (PWA)
- Installable on mobile devices
- Offline capabilities with service worker
- App-like experience on mobile
- Push notifications support (future enhancement)

### Split Types Support
The application supports four different split types:

1. **Equal Split** - Divides expense equally among all participants
2. **Amount Split** - Custom amounts for each participant
3. **Share Split** - Integer shares (e.g., 2 shares vs 1 share = 2/3 vs 1/3)
4. **Percentage Split** - Percentage-based splitting with 2 decimal precision

### Real-time Calculations
- Automatic debt calculation and simplification
- Live split amount updates as you type
- Seamless switching between split types
- Proper rounding with remainder distribution

## Technologies Used

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library
- **PWA** - Progressive Web App capabilities

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The development server will start on http://localhost:3000

### Available Scripts

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Eject from Create React App (not recommended)
npm run eject
```

### Building for Production

```bash
# Create production build
npm run build

# The build folder contains the production build
# Serve the build folder with any static file server
```

## Component Architecture

### Page Components

Each page component follows a consistent pattern:

- **State Management** - Uses React hooks for local state
- **API Integration** - Calls backend API through the service layer
- **Error Handling** - Displays user-friendly error messages
- **Loading States** - Shows loading indicators during API calls
- **Form Validation** - Client-side validation with user feedback

### API Service Layer

The `api.ts` file provides a clean interface to the backend:

```typescript
// Example API calls
const group = await getGroup(urlSlug);
const expenses = await getExpensesByGroup(groupId);
const result = await createExpense(expenseData);
```

### State Management

The application uses React's built-in state management:

- **useState** - Local component state
- **useEffect** - Side effects and API calls
- **useCallback** - Memoized functions for performance
- **useParams** - URL parameter extraction
- **useNavigate** - Programmatic navigation

## Styling

### Tailwind CSS

The application uses Tailwind CSS for styling:

- **Utility Classes** - Rapid development with utility classes
- **Responsive Design** - Mobile-first responsive breakpoints
- **Custom Components** - Reusable component patterns
- **Dark Mode Ready** - Prepared for future dark mode implementation

### Design System

Consistent design patterns throughout the application:

- **Color Palette** - Blue primary, gray neutrals
- **Typography** - System font stack with proper hierarchy
- **Spacing** - Consistent spacing scale
- **Components** - Reusable button, input, and card components

## User Experience

### Navigation
- Intuitive breadcrumb navigation
- Clear page titles and back buttons
- Consistent navigation patterns

### Forms
- Real-time validation feedback
- Clear error messages
- Intuitive input types and patterns
- Auto-focus and tab navigation

### Feedback
- Toast notifications for actions
- Loading states for async operations
- Confirmation dialogs for destructive actions
- Success/error states for forms

## Performance

### Optimization Techniques
- **Code Splitting** - Automatic code splitting with React Router
- **Memoization** - useCallback for expensive functions
- **Lazy Loading** - Future enhancement for route-based code splitting
- **Image Optimization** - Optimized for web delivery

### Bundle Analysis
```bash
# Analyze bundle size
npm run build
npx serve -s build
```

## Browser Support

- **Modern Browsers** - Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Browsers** - iOS Safari, Chrome Mobile
- **PWA Support** - Chrome, Edge, Safari (iOS 11.3+)

## Accessibility

- **Keyboard Navigation** - Full keyboard accessibility
- **Screen Reader Support** - Proper ARIA labels and roles
- **Color Contrast** - WCAG AA compliant color contrast
- **Focus Management** - Proper focus indicators and management

## Future Enhancements

### Planned Features
- **Dark Mode** - Theme switching capability
- **Offline Support** - Enhanced offline functionality
- **Push Notifications** - Real-time updates
- **Advanced Filtering** - Expense filtering and search
- **Data Export** - CSV/PDF export functionality
- **Multi-language** - Internationalization support

### Technical Improvements
- **State Management** - Redux or Zustand for complex state
- **Testing** - Comprehensive unit and integration tests
- **Performance** - Further optimization and monitoring
- **Analytics** - User behavior tracking and analytics

## Deployment

### Static Hosting
The frontend can be deployed to any static hosting service:

- **Netlify** - Automatic deployments from Git
- **Vercel** - Zero-config deployments
- **GitHub Pages** - Free hosting for public repositories
- **AWS S3** - Scalable static hosting

### Environment Variables
```bash
# .env.local
REACT_APP_API_URL=http://localhost:8080
```

### Build Configuration
The application is configured for production builds with:
- Optimized bundle size
- Minified CSS and JavaScript
- Service worker for PWA functionality
- Proper caching headers

## Contributing

### Code Style
- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write meaningful component and function names

### Component Guidelines
- Keep components focused and single-purpose
- Use TypeScript interfaces for props
- Implement proper loading and error states
- Follow consistent naming conventions

### Testing
- Write unit tests for utility functions
- Test component behavior with user interactions
- Mock API calls in tests
- Maintain good test coverage
