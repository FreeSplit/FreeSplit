import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, DollarSign } from 'lucide-react';
import { createGroup } from '../services/grpc-api';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create a Group</h1>
            <p className="text-gray-600">Start splitting expenses with your friends and family</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  id="groupName"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Weekend Trip, House Expenses"
                  required
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participants
                </label>
                <div className="space-y-3">
                  {formData.participants.map((participant, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={participant}
                        onChange={(e) => handleParticipantChange(index, e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Create Group
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroup;

