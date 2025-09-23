import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroup, deleteParticipant } from '../services/api';
import { Group, Participant } from '../services/api';
import toast from 'react-hot-toast';
import NavBar from '../nav/nav-bar';
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faPlus, faUserXmark } from '@fortawesome/free-solid-svg-icons';
import AddMemberModal from '../modals/add-member';
import EditMemberModal from '../modals/edit-member';

const Members: React.FC = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [isEditMemberOpen, setEditMemberOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

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

  const handleDeleteMember = async (participantId: number) => {
    if (!window.confirm('Are you sure you want to delete this member? This will also delete all their expenses and splits.')) {
      return;
    }

    try {
      await deleteParticipant(participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
      toast.success('Member deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete member');
      console.error('Error deleting member:', error);
    }
  };

  const handleMemberAdded = (participant: Participant) => {
    setParticipants((prev) => [...prev, participant]);
  };

  const handleMemberUpdated = (participant: Participant) => {
    setParticipants((prev) =>
      prev.map((existing) => (existing.id === participant.id ? participant : existing))
    );
  };

  const handleMemberDeleted = (participantId: number) => {
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
  };

  useEffect(() => {
    if (!loading && !group && urlSlug) {
      navigate(`/group/${urlSlug}`);
    }
  }, [loading, group, urlSlug, navigate]);

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
    return null;
  }

  const openEditModal = (participant: Participant) => {
    setSelectedParticipant(participant);
    setEditMemberOpen(true);
  };

  return (
    <div className="page">
      <div className="body">
        <Header />

        <div className="content-section">
          <h1>Members ({participants.length})</h1>
          <div className="list">
            {participants.length === 0 ? (
              <div className="content-container">
                <FontAwesomeIcon icon={faUserXmark} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
                <h2>No members</h2>
                <p>I'm not sure how you've done this. Try add some people.</p>
                <button onClick={() => setAddMemberOpen(true)} className="btn">
                  <span>Add a member</span>
                  <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                </button>
              </div>
            ) : (
              participants.map((participant) => (
                <div key={participant.id} className="list">
                  <button 
                    className="list-item"
                    onClick={() => openEditModal(participant)}
                  >
                    <p>{participant.name}</p>
                    <FontAwesomeIcon icon={faChevronRight} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {isAddMemberOpen && (
          <AddMemberModal
            group={group}
            onClose={() => setAddMemberOpen(false)}
            onMemberAdded={handleMemberAdded}
          />
        )}

        {isEditMemberOpen && selectedParticipant && (
          <EditMemberModal
            participant={selectedParticipant}
            onClose={() => {
              setEditMemberOpen(false);
              setSelectedParticipant(null);
            }}
            onMemberUpdated={handleMemberUpdated}
            onMemberDeleted={(id) => {
              handleMemberDeleted(id);
              setEditMemberOpen(false);
              setSelectedParticipant(null);
            }}
          />
        )}

        <div className="v-flex">
            <div className="floating-cta-container">
              <button 
                className="btn"
                onClick={() => setAddMemberOpen(true)}
              >
                <span>Add a new member</span>
                <FontAwesomeIcon icon={faPlus} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </div>
            < NavBar />
          </div>
      </div>
    </div>
  );
};

export default Members;
