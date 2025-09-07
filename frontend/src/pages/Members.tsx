import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import { getGroup, addParticipant, updateParticipant, deleteParticipant } from '../services/api';
import { Group, Participant } from '../services/api';
import toast from 'react-hot-toast';

const Members: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [editName, setEditName] = useState('');

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getGroup(urlSlug!);
      setGroup(response.group);
      setParticipants(response.participants);
    } catch (error) {
      toast.error('Failed to load group data');
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  }, [urlSlug]);

  useEffect(() => {
    if (urlSlug) {
      loadGroupData();
    }
  }, [urlSlug, loadGroupData]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      const response = await addParticipant({
        name: newMemberName.trim(),
        group_id: group!.id
      });
      
      setParticipants(prev => [...prev, response]);
      setNewMemberName('');
      setShowAddForm(false);
      toast.success('Member added successfully!');
    } catch (error) {
      toast.error('Failed to add member');
      console.error('Error adding member:', error);
    }
  };

  const handleEditMember = async (participantId: number) => {
    if (!editName.trim()) return;

    try {
      const response = await updateParticipant({
        name: editName.trim(),
        participant_id: participantId
      });
      
      setParticipants(prev => 
        prev.map(p => p.id === participantId ? response : p)
      );
      setEditingId(null);
      setEditName('');
      toast.success('Member updated successfully!');
    } catch (error) {
      toast.error('Failed to update member');
      console.error('Error updating member:', error);
    }
  };

  const handleDeleteMember = async (participantId: number) => {
    if (!window.confirm('Are you sure you want to delete this member? This will also delete all their expenses and splits.')) {
      return;
    }

    try {
      await deleteParticipant(participantId);
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      toast.success('Member deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete member');
      console.error('Error deleting member:', error);
    }
  };

  const startEditing = (participant: Participant) => {
    setEditingId(participant.id);
    setEditName(participant.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading group data...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Group not found</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create New Group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <button
              onClick={() => navigate(`/group/${urlSlug}`)}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Members</h1>
              <p className="text-gray-600">{group.name}</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add Member</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Member Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add New Member</h2>
            <form onSubmit={handleAddMember} className="flex space-x-4">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter member name"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Members List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Members ({participants.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {participants.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <p>No members yet. Add your first member to get started!</p>
              </div>
            ) : (
              participants.map((participant) => (
                <div key={participant.id} className="px-6 py-4">
                  {editingId === participant.id ? (
                    <div className="flex items-center space-x-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditMember(participant.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{participant.name}</h3>
                        <p className="text-sm text-gray-500">Member since creation</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(participant)}
                          className="p-2 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(participant.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Members;

