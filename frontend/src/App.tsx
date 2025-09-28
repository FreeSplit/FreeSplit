import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Index from './pages/_index';
import CreateGroup from './pages/CreateGroup';
import GroupDashboard from './pages/GroupDashboard';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import Members from './pages/Members';
import Debts from './pages/Debts';
import './styles/global.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/participants-form.css';
import './styles/split-breakdown.css';
import './styles/simplify-animation.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/create-a-group/" element={<CreateGroup />} />
          <Route path="/group/:urlSlug" element={<GroupDashboard />} />
          <Route path="/group/:urlSlug/expenses/add" element={<AddExpense />} />
          <Route path="/group/:urlSlug/expenses/:expenseId/edit" element={<EditExpense />} />
          <Route path="/group/:urlSlug/members" element={<Members />} />
          <Route path="/group/:urlSlug/debts" element={<Debts />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
