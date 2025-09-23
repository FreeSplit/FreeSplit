import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup } from '../services/api';
import toast from 'react-hot-toast';
import ParticipantsInput from "../forms/create-a-group";

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<{ name: string; currency: string; participants: string[] }>({
    name: '',
    currency: 'USD',
    participants: [] // Managed by chips input
  });
  // Derived form completeness state
  const currentValidParticipants = formData.participants.filter(name => name.trim() !== '');
  const isFormComplete = formData.name.trim() !== '' && currentValidParticipants.length >= 2;

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    <div className="page">
      <div className="body">
        <div className="header">
          <a href="/">Cancel</a>
          <p className="is-bold">Create a group</p>
          <button 
            className="a"
            type="submit"
            form="create-group-form"
            disabled={!isFormComplete}>
              Done
          </button>
        </div>
        <div className="content-section">
          <form onSubmit={handleSubmit} className="form" id="create-group-form">
            <div className="form-item">
              <label htmlFor="groupName" className="form-label">
                Group Name
              </label>
              <div className="form-input-container">
                <input
                  type="text"
                  id="groupName"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`form-input${formData.name.trim() ? ' is-complete' : ''}`}
                  placeholder="Weekend Trip"
                  required
                />
              </div>
            </div>

            <div className="form-item">
              <label htmlFor="currency" className="form-label">
                Currency
              </label>
              <div className="form-input-container">
                <input
                  type="text"
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  className={`form-input${formData.currency.trim() ? ' is-complete' : ''}`}
                  maxLength={3}
                  pattern="[$€£¥]|[A-Za-z]{2,3}"
                  placeholder="e.g. $, kr, or USD"
                  required
                />
              </div>
            </div>

            <ParticipantsInput
              initial={formData.participants}
              onChange={(list: string[]) => handleInputChange('participants', list)}
            />
  
          </form>
        </div>
        <footer>
          <button
            type="submit"
            className="btn has-full-width"
            form="create-group-form"
            disabled={!isFormComplete}
          >
            Create Group
          </button>
        </footer>
      </div>
    </div>   
  );
};

export default CreateGroup;
