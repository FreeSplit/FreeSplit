import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import CreateGroup from './pages/CreateGroup';
import GroupDashboard from './pages/GroupDashboard';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import Members from './pages/Members';
import Debts from './pages/Debts';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<CreateGroup />} />
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

