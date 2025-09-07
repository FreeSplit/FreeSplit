import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, DollarSign } from 'lucide-react';
import { createGroup } from '../services/api';
import toast from 'react-hot-toast';

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    currency: 'USD',
    participants: ['', '', ''] // Start with 3 empty participant fields
  });

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParticipantChange = (index: number, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = value;
    setFormData(prev => ({
      ...prev,
      participants: newParticipants
    }));
  };

  const addParticipant = () => {
    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, '']
    }));
  };

  const removeParticipant = (index: number) => {
    if (formData.participants.length > 2) {
      const newParticipants = formData.participants.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        participants: newParticipants
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validParticipants = formData.participants.filter(name => name.trim() !== '');
    
    if (validParticipants.length < 2) {
      toast.error('Please add at least 2 participants');
      return;
    }

    try {
      const response = await createGroup({
        name: formData.name,
        currency: formData.currency,
        participant_names: validParticipants
      });

      toast.success('Group created successfully!');
      navigate(`/group/${response.url_slug}`);
    } catch (error) {
      toast.error('Failed to create group');
      console.error('Error creating group:', error);
    }
  };

  return (
  <div className="root">
    <div className="body">
      <div className="header">
        <a>Cancel</a>
        <p>Create a group</p>
        <a>Done</a>
      </div>
      <div className="section">
        <form onSubmit={handleSubmit} className="form">
          <div className="form-item">
            <label htmlFor="groupName" className="form-label">
              Group Name
            </label>
            <input
              type="text"
              id="groupName"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="form-input"
              placeholder="e.g., Weekend Trip, House Expenses"
              required
            />
          </div>

          <div className="form-item">
            <label htmlFor="currency" className="form-label">
              Currency
            </label>
            <select
              id="currency"
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
              className="form-input"
            >
              <option className="form-input" value="USD">USD ($)</option>
              <option className="form-input" value="EUR">EUR (€)</option>
              <option className="form-input" value="GBP">GBP (£)</option>
              <option className="form-input" value="CAD">CAD (C$)</option>
              <option className="form-input" value="AUD">AUD (A$)</option>
            </select>
          </div>

          <div className="form-item">
            <label className="form-label">
              Participants
            </label>
            <div className="space-y-3">
              {formData.participants.map((participant, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={participant}
                    onChange={(e) => handleParticipantChange(index, e.target.value)}
                    className="form-input"
                    placeholder={`Participant ${index + 1}`}
                    required
                  />
                  {formData.participants.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(index)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    >
                      <Users className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addParticipant}
              className="mt-3 flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Add Participant</span>
            </button>
          </div>

          <button
            type="submit"
            className="btn"
          >
            Create Group
          </button>
            
        </form>
      </div>
    </div>
  </div>    
  );
};

export default CreateGroup;

