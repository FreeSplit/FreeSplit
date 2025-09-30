import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { localStorageService, UserGroup } from '../services/localStorage';
import { getUserGroupsSummary, getGroupParticipants, getGroup, UserGroupSummary, GroupParticipantsResponse } from '../services/api';
import FreesplitLogo from '../images/FreeSplit.svg';
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
      
      // Get participants for all groups first
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

      // Preload summaries for ALL participants in ALL groups
      console.log('🔍 [DEBUG] Preloading summaries for all participants...');
      const allSummaries: UserGroupSummary[] = [];
      
      for (const group of participantsResponse.groups) {
        for (const participant of group.participants) {
          try {
            const summaryResponse = await getUserGroupsSummary([{
              group_url_slug: group.group_url_slug,
              user_participant_id: participant.id,
              user_participant_name: participant.name
            }]);
            // Add participant info to each summary
            const summariesWithParticipant = summaryResponse.groups.map(s => ({
              ...s,
              participant_id: participant.id,
              participant_name: participant.name
            }));
            allSummaries.push(...summariesWithParticipant);
          } catch (error) {
            console.error(`🔍 [DEBUG] Error fetching summary for ${participant.name} in ${group.group_url_slug}:`, error);
          }
        }
      }
      
      console.log('🔍 [DEBUG] Setting summaries:', allSummaries);
      console.log('🔍 [DEBUG] Setting participants:', participantsResponse.groups);
      console.log('🔍 [DEBUG] Setting group names:', groupNamesMap);
      setGroupSummaries(allSummaries);
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
    if (userGroups.length > 0 && groupSummaries.length === 0) {
      // Only load data on initial load, not when participants change
      loadGroupData();
    } else if (userGroups.length === 0) {
      // If no groups, stop loading immediately
      setLoading(false);
    }
  }, [userGroups, loadGroupData, groupSummaries.length]);

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

  const handleCopyGroupLink = async (groupUrlSlug: string) => {
    try {
      const groupLink = `${window.location.origin}/group/${groupUrlSlug}`;
      await navigator.clipboard.writeText(groupLink);
      toast.success('Group link copied');
    } catch (error) {
      console.error('Error copying group link:', error);
      toast.error('Failed to copy group link');
    }
  };

  const handleParticipantSelect = async (groupUrlSlug: string, participantId: number, participantName: string) => {
    try {
      // Check if this participant is already selected
      const currentGroup = userGroups.find(g => g.groupUrlSlug === groupUrlSlug);
      if (currentGroup && currentGroup.userParticipantId === participantId) {
        // Deselect the participant
        await localStorageService.updateGroupParticipant(groupUrlSlug, 0, '');
        setUserGroups(prev => prev.map(g => 
          g.groupUrlSlug === groupUrlSlug 
            ? { ...g, userParticipantId: 0, userParticipantName: '' }
            : g
        ));
        toast.success(`Deselected ${participantName} for this group`);
      } else {
        // Select the participant (data is already preloaded)
        await localStorageService.updateGroupParticipant(groupUrlSlug, participantId, participantName);
        setUserGroups(prev => prev.map(g => 
          g.groupUrlSlug === groupUrlSlug 
            ? { ...g, userParticipantId: participantId, userParticipantName: participantName }
            : g
        ));
        toast.success(`Selected ${participantName} for this group`);
      }
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
    const group = userGroups.find(g => g.groupUrlSlug === groupUrlSlug);
    if (!group || group.userParticipantId === 0) {
      return undefined;
    }
    
    // Find summary for the currently selected participant
    return groupSummaries.find(s => 
      s.group_url_slug === groupUrlSlug && 
      s.participant_id === group.userParticipantId
    );
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
        <div className="logo-header">
          <img src={FreesplitLogo} alt="Freesplit Logo" />
        </div>
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
                          <h3 
                            className="text-lg font-semibold mb-1 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleCopyGroupLink(group.groupUrlSlug)}
                            title="Click to copy group link"
                          >
                            {groupNames[group.groupUrlSlug] || 'Loading...'}
                          </h3>
                          <p 
                            className="text-xs text-gray-500 mb-1 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleCopyGroupLink(group.groupUrlSlug)}
                            title="Click to copy group link"
                          >
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
                            {group.userParticipantId > 0 && (
                              <div className="mr-4">
                                {summary ? (
                                  <span className={`font-medium ${getBalanceColor(summary.net_balance)}`}>
                                    {summary.net_balance >= 0 ? 'Owed' : 'Owing'} {summary.currency}{Math.abs(summary.net_balance).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs">
                                    No balance data
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={() => toggleGroupExpansion(group.groupUrlSlug)}
                              className="btn btn-sm dropdown-button"
                              title="Select your user"
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
        <footer>
          <p className="p2">Created by <a href="https://thomasforsyth.design">Thomas</a> & <a href="https://www.linkedin.com/in/kmfsousa/">Kris</a></p>
        </footer>
      </div>
    </div>
  );
};

export default Groups;
