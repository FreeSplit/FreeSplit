import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageService, UserGroup } from '../services/localStorage';
import { getUserGroupsSummary, getGroupParticipants, getGroup, UserGroupSummary, GroupParticipantsResponse } from '../services/api';
import NavBar from "../nav/nav-bar";
import Header from "../nav/header";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faPlus, faTimes, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

// Remove the local interfaces since we're using the API types now

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<UserGroupSummary[]>([]);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantsResponse['groups']>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Debug: Track render count
  const renderCount = useRef(0);
  renderCount.current += 1;

  // Load user groups from local storage
  const loadUserGroups = useCallback(async () => {
    try {
      const groups = await localStorageService.getUserGroups();
      setUserGroups(groups);
    } catch (error) {
      console.error('Error loading user groups:', error);
      toast.error('Failed to load your groups');
    }
  }, []);

  // Load group summaries and participants from backend
  const loadGroupData = useCallback(async () => {
    if (userGroups.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 [DEBUG] Loading group data for userGroups:', userGroups);
      
      // Prepare groups with participant info for summary API
      const groupsWithParticipants = userGroups
        .filter(group => group.userParticipantId > 0) // Only include groups where user has selected a participant
        .map(group => ({
          group_url_slug: group.groupUrlSlug,
          user_participant_id: group.userParticipantId,
          user_participant_name: group.userParticipantName
        }));

      console.log('🔍 [DEBUG] Groups with participants:', groupsWithParticipants);

      // Get group summaries (only for groups where user has selected a participant)
      let summaries: UserGroupSummary[] = [];
      if (groupsWithParticipants.length > 0) {
        console.log('🔍 [DEBUG] Requesting summaries for groups with participants...');
        console.log('🔍 [DEBUG] Data being sent to API:', groupsWithParticipants);
        try {
          const summaryResponse = await getUserGroupsSummary(groupsWithParticipants);
          console.log('🔍 [DEBUG] Summary response:', summaryResponse);
          summaries = summaryResponse.groups;
        } catch (error) {
          console.error('🔍 [DEBUG] Error getting summaries:', error);
          console.error('🔍 [DEBUG] Data that caused error:', groupsWithParticipants);
          // Don't fail the whole operation if summaries fail
        }
      } else {
        console.log('🔍 [DEBUG] No groups with participants selected, skipping summary request');
      }

      // Get participants for all groups
      const groupSlugs = userGroups.map(group => group.groupUrlSlug);
      console.log('🔍 [DEBUG] Requesting participants for group slugs:', groupSlugs);
      let participantsResponse: GroupParticipantsResponse = { groups: [] };
      if (groupSlugs.length > 0) {
        participantsResponse = await getGroupParticipants(groupSlugs);
        console.log('🔍 [DEBUG] Participants response:', participantsResponse);
      }

      // Get group names for all groups
      console.log('🔍 [DEBUG] Fetching group names...');
      const groupNamesMap: Record<string, string> = {};
      for (const groupSlug of groupSlugs) {
        try {
          const groupData = await getGroup(groupSlug);
          groupNamesMap[groupSlug] = groupData.group.name;
          console.log(`🔍 [DEBUG] Group ${groupSlug} name: ${groupData.group.name}`);
        } catch (error) {
          console.error(`🔍 [DEBUG] Error fetching group name for ${groupSlug}:`, error);
          groupNamesMap[groupSlug] = 'Unknown Group';
        }
      }
      
      console.log('🔍 [DEBUG] Setting summaries:', summaries);
      console.log('🔍 [DEBUG] Setting participants:', participantsResponse.groups);
      console.log('🔍 [DEBUG] Setting group names:', groupNamesMap);
      setGroupSummaries(summaries);
      setGroupParticipants(participantsResponse.groups);
      setGroupNames(groupNamesMap);
    } catch (error) {
      console.error('Error loading group data:', error);
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [userGroups]);

  useEffect(() => {
    loadUserGroups();
  }, [loadUserGroups]);

  useEffect(() => {
    if (userGroups.length > 0) {
      loadGroupData();
    }
  }, [userGroups, loadGroupData]);

  // Debug: Track re-renders
  useEffect(() => {
    console.log('🔍 [DEBUG] Component re-rendered. State:', {
      userGroupsLength: userGroups.length,
      groupSummariesLength: groupSummaries.length,
      groupParticipantsLength: groupParticipants.length,
      expandedGroupsSize: expandedGroups.size,
      loading
    });
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown or dropdown button
      if (!target.closest('.dropdown-container') && !target.closest('.dropdown-button')) {
        setExpandedGroups(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDeleteGroup = async (groupUrlSlug: string) => {
    try {
      await localStorageService.removeUserGroup(groupUrlSlug);
      await loadUserGroups();
      toast.success('Group removed from your list');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to remove group');
    }
  };

  const handleParticipantSelect = async (groupUrlSlug: string, participantId: number, participantName: string) => {
    try {
      await localStorageService.updateGroupParticipant(groupUrlSlug, participantId, participantName);
      await loadUserGroups();
      toast.success(`Selected ${participantName} for this group`);
    } catch (error) {
      console.error('Error updating participant:', error);
      toast.error('Failed to update participant selection');
    }
  };

  const toggleGroupExpansion = (groupUrlSlug: string) => {
    console.log('🔍 [DEBUG] Toggling dropdown for group:', groupUrlSlug);
    console.log('🔍 [DEBUG] Current expandedGroups:', Array.from(expandedGroups));
    
    if (expandedGroups.has(groupUrlSlug)) {
      // If this group is already open, close it
      console.log('🔍 [DEBUG] Collapsing group:', groupUrlSlug);
      setExpandedGroups(new Set());
    } else {
      // If this group is closed, close all others and open this one
      console.log('🔍 [DEBUG] Expanding group (closing all others):', groupUrlSlug);
      setExpandedGroups(new Set([groupUrlSlug]));
    }
  };

  const getGroupSummary = (groupUrlSlug: string): UserGroupSummary | undefined => {
    return groupSummaries.find(g => g.group_url_slug === groupUrlSlug);
  };

  const findGroupParticipants = (groupUrlSlug: string): GroupParticipantsResponse['groups'][0] | undefined => {
    return groupParticipants.find(g => g.group_url_slug === groupUrlSlug);
  };


  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your groups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="body">
        {/* Header */}
        <Header />

        <div className="content-section">
          <h1>Your Groups</h1>

          {/* Groups List */}
          {userGroups.length > 0 ? (
            <div className="expenses-container">
        {userGroups.map((group, index) => {
          const summary = getGroupSummary(group.groupUrlSlug);
          const participants = findGroupParticipants(group.groupUrlSlug);
          const isExpanded = expandedGroups.has(group.groupUrlSlug);
          
          // Debug: Only log when there's an issue
          if (!summary && group.userParticipantId > 0) {
            console.log(`🔍 [DEBUG] Group ${group.groupUrlSlug} has participant but no summary:`, {
              groupUrlSlug: group.groupUrlSlug,
              userParticipantId: group.userParticipantId,
              userParticipantName: group.userParticipantName,
              allSummaries: groupSummaries
            });
          }
                
                return (
                  <div key={group.groupUrlSlug}>
                    <div className="expense">
                    <div className="expense-details">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">
                            {groupNames[group.groupUrlSlug] || 'Loading...'}
                          </h3>
                          <p className="text-xs text-gray-500 mb-1">
                            {group.groupUrlSlug}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <div className="flex items-center">
                              <span>
                                Last visited: {new Date(group.lastVisited).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                }).replace(/\./g, '')}
                              </span>
                              {group.userParticipantName && (
                                <span className="text-xs text-gray-600 ml-6">
                                  Currently: <span className="font-medium text-blue-600">{group.userParticipantName}</span>
                                </span>
                              )}
                            </div>
                            <div className="mr-4">
                              {summary ? (
                                <span className={`font-medium ${getBalanceColor(summary.net_balance)}`}>
                                  {summary.net_balance >= 0 ? 'Owed' : 'Owing'} {summary.currency}${Math.abs(summary.net_balance).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  No balance data
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={() => toggleGroupExpansion(group.groupUrlSlug)}
                              className="btn btn-sm dropdown-button"
                            >
                              <FontAwesomeIcon
                                icon={faChevronDown}
                                className={`transform transition-transform ${isExpanded ? '' : 'rotate-180'}`}
                              />
                            </button>
                            {/* Dropdown - Name Selection */}
                            {isExpanded && participants && (
                              <div className="absolute top-full left-0 mt-1 rounded-lg p-2 shadow-lg dropdown-container z-50" style={{backgroundColor: 'var(--color-primary)'}}>
                                <div className="flex flex-col gap-1">
                                  {participants.participants.map((participant) => (
                                    <button
                                      key={participant.id}
                                      onClick={() => handleParticipantSelect(
                                        group.groupUrlSlug,
                                        participant.id,
                                        participant.name
                                      )}
                                      className={`px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap ${
                                        group.userParticipantId === participant.id
                                          ? 'text-white' 
                                          : 'text-white hover:opacity-80'
                                      }`}
                                      style={{
                                        backgroundColor: group.userParticipantId === participant.id ? 'var(--color-primary-dark)' : 'transparent'
                                      }}
                                    >
                                      {participant.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteGroup(group.groupUrlSlug)}
                            className="btn btn-sm text-red-600 hover:text-red-800"
                            title="Remove from your groups"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                          <button
                            onClick={() => navigate(`/group/${group.groupUrlSlug}`)}
                            className="btn btn-sm"
                            title="View Group"
                          >
                            <FontAwesomeIcon icon={faChevronRight} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && !participants && (
                      <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-red-600 text-sm">No participants data found for this group</p>
                        <p className="text-red-500 text-xs">Group slug: {group.groupUrlSlug}</p>
                      </div>
                    )}
                    </div>
                    {index < userGroups.length - 1 && (
                      <div className="border-b border-gray-300 my-2"></div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* No Groups */
            <div className="content-container">
              <FontAwesomeIcon icon={faUsers} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
              <h2>No groups yet</h2>
              <p>Visit a group to add it to your list, or create a new group.</p>
              <button
                onClick={() => navigate('/create-a-group/')}
                className="btn"
              >
                <span>Create a group</span>
                <FontAwesomeIcon icon={faPlus} className="icon" style={{ fontSize: 20 }} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <NavBar />
      </div>
    </div>
  );
};

export default Groups;
