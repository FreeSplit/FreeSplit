import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Index from './pages/_index';
import CreateGroup from './pages/CreateGroup';
import GroupDashboard from './pages/GroupDashboard';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import Members from './pages/Members';
import Debts from './pages/Debts';
import Groups from './pages/Groups';
import './styles/global.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/participants-form.css';
import './styles/split-breakdown.css';
import './styles/simplify-animation.css';

// Catch-all component for unmatched routes
const CatchAllRoute: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;
  
  // Check if the route starts with /group/ and has a slug
  const groupMatch = pathname.match(/^\/group\/([^\/]+)/);
  
  if (groupMatch) {
    // Extract the group slug and redirect to that group's dashboard
    const groupSlug = groupMatch[1];
    return <Navigate to={`/groups/${groupSlug}`} replace />;
  }
  
  // For all other unmatched routes, redirect to landing page
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/create-a-group/" element={<CreateGroup />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/group" element={<Navigate to="/groups" replace />} />
          <Route path="/groups/:urlSlug" element={<GroupDashboard />} />
          <Route path="/groups/:urlSlug/expenses/add" element={<AddExpense />} />
          <Route path="/groups/:urlSlug/expenses/:expenseId/edit" element={<EditExpense />} />
          <Route path="/groups/:urlSlug/members" element={<Members />} />
          <Route path="/groups/:urlSlug/debts" element={<Debts />} />
          <Route path="*" element={<CatchAllRoute />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
