import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { localStorageService, UserGroup } from '../services/localStorage';
import { getUserGroupsSummary, getGroupParticipants, getGroup, UserGroupSummary, GroupParticipantsResponse } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faChevronDown, faUser, faEllipsisV } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import LogoHeader from '../nav/logo-header'
import SigFooter from '../nav/sig-footer'

// Remove the local interfaces since we're using the API types now

const Groups: React.FC = () => {
  const navigate = useNavigate();
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<UserGroupSummary[]>([]);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantsResponse['groups']>([]);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<string>>(new Set());
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  
  // Format time to be relative
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return `${Math.floor(diffInHours / 168)}w ago`;
  };

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
      
      // Get participants for all groups first
      const groupSlugs = userGroups.map(group => group.groupUrlSlug);
      let participantsResponse: GroupParticipantsResponse = { groups: [] };
      if (groupSlugs.length > 0) {
        participantsResponse = await getGroupParticipants(groupSlugs);
      }

      // Get group names for all groups
      const groupNamesMap: Record<string, string> = {};
      for (const groupSlug of groupSlugs) {
        try {
          const groupData = await getGroup(groupSlug);
          groupNamesMap[groupSlug] = groupData.group.name;
        } catch (error) {
          console.error(`Error fetching group name for ${groupSlug}:`, error);
          groupNamesMap[groupSlug] = 'Unknown Group';
        }
      }

      // Preload summaries for ALL participants in ALL groups
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
            console.error(`Error fetching summary for ${participant.name} in ${group.group_url_slug}:`, error);
          }
        }
      }
      
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


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside any dropdown or dropdown button
      if (!target.closest('.dropdown-container') && !target.closest('.dropdown-button')) {
        setExpandedParticipants(new Set());
        setExpandedOptions(new Set());
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
      const groupLink = `${window.location.origin}/groups/${groupUrlSlug}`;
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
    if (expandedParticipants.has(groupUrlSlug)) {
      // If this group is already open, close it
      setExpandedParticipants(new Set());
    } else {
      // If this group is closed, close all others and open this one
      setExpandedParticipants(new Set([groupUrlSlug]));
    }
  };

  const toggleOptionsDropdown = (groupUrlSlug: string) => {
    if (expandedOptions.has(groupUrlSlug)) {
      setExpandedOptions(new Set());
    } else {
      setExpandedOptions(new Set([groupUrlSlug]));
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
      <div className="page">
        <div className="body">
          <div className="content-section align-center">
            <div className="content-container">
              <l-ring size="44" color="var(--color-primary)" />
              <h2>Loading your groups...</h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="body">
        < LogoHeader />

        <div className="content-section">

          {/* Groups List */}
          {userGroups.length > 0 ? (
            <>
              <div className="v-flex align-start gap-8px">
                <h1>Your Groups</h1>
                <p>Visit an existing group or create a new one to add them to your groups.</p>
              </div>
              <div className="list">
                {userGroups.map((group) => {
                  const summary = getGroupSummary(group.groupUrlSlug);
                  const participants = findGroupParticipants(group.groupUrlSlug);
                  const isExpanded = expandedParticipants.has(group.groupUrlSlug);
                  const isOptionsExpanded = expandedOptions.has(group.groupUrlSlug);

                  return (
                    <div key={group.groupUrlSlug} className="expenses-container">
                      <div className="expense">
                        <div className="expense-details">
                          <div className="flex items-center justify-between w-full">
                            <div className="v-flex gap-8px">
                              <div className="h-flex align-center gap-8px">
                                <Link
                                  to={`/groups/${group.groupUrlSlug}`}
                                  title="View group"
                                  style={{ color: 'var(--color-text)'}}
                                >
                                  <h2>{groupNames[group.groupUrlSlug] || 'Loading...'}</h2>
                                </Link>
                                <div className="relative">
                                  <button
                                    onClick={() => toggleGroupExpansion(group.groupUrlSlug)}
                                    className="pill bg-primary dropdown-button"
                                    title="Select your name"
                                  >
                                    <FontAwesomeIcon icon={faUser} />
                                    <span>{group.userParticipantName || 'Select your name'}</span>
                                    <FontAwesomeIcon icon={faChevronDown} />
                                  </button>

                                  {/* Dropdown - Name Selection */}
                                  {isExpanded && participants && (
                                    <div
                                      className="absolute top-full left-0 mt-1 rounded-lg p-2 shadow-lg dropdown-container z-50"
                                      style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                      <div className="flex flex-col gap-1">
                                        {participants.participants.map((participant) => (
                                          <button
                                            key={participant.id}
                                            onClick={async () => {
                                              await handleParticipantSelect(
                                                group.groupUrlSlug,
                                                participant.id,
                                                participant.name
                                              );
                                              setExpandedParticipants(new Set());
                                            }}
                                            className={`px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap ${
                                              group.userParticipantId === participant.id
                                                ? 'text-white'
                                                : 'text-white hover:opacity-80'
                                            }`}
                                            style={{
                                              backgroundColor:
                                                group.userParticipantId === participant.id
                                                  ? 'var(--color-primary-dark)'
                                                  : 'transparent'
                                            }}
                                          >
                                            {participant.name}
                                         </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {isExpanded && !participants && (
                                    <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                                      <p className="text-red-600 text-sm">No participants data found for this group</p>
                                      <p className="text-red-500 text-xs">Group slug: {group.groupUrlSlug}</p>
                                    </div>
                                  )}

                                </div>
                              </div>
                              <div className="h-flex align-start gap-8px">
                                <div className="h-flex align-center gap-4px">
                                  <p className="p2">Last visited:</p>
                                  <p>{formatTimeAgo(group.lastVisited)}</p>
                                </div>
                                {group.userParticipantId > 0 && (
                                  <>
                                    <p>|</p>
                                    <div className="h-flex align-center gap-4px">
                                      {summary ? (
                                        <>
                                          <span className="p2">
                                            {summary.net_balance >= 0 ? 'You owe:' : 'Owed:'}
                                          </span>
                                          <p className={`${getBalanceColor(summary.net_balance)}`}>
                                            {summary.currency}
                                            {Math.abs(summary.net_balance).toFixed(2)}
                                          </p>
                                        </>
                                      ) : (
                                        <span className="text-gray-400 text-xs">No balance data</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="h-flex align-center gap-16px">
                              <div className="relative">
                                <button
                                  onClick={() => toggleOptionsDropdown(group.groupUrlSlug)}
                                  className="dropdown-button icon-link-container"
                                  title="Group options"
                                  aria-haspopup="menu"
                                  aria-expanded={isOptionsExpanded}
                                >
                                  <FontAwesomeIcon icon={faEllipsisV} style={{ color: 'var(--color-text)', fontSize: 20 }} />
                                </button>

                                {/* Dropdown - Options */}
                                {isOptionsExpanded && (
                                  <div
                                    className="absolute right-0 top-full mt-1 rounded-lg p-2 shadow-lg dropdown-container z-50"
                                    style={{ backgroundColor: 'var(--color-primary)' }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <Link
                                        to={`/groups/${group.groupUrlSlug}`}
                                        title="View group"
                                        className="px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap text-white hover:opacity-80 no-decoration"
                                      >
                                        View group
                                      </Link>
                                      <button
                                       onClick={async () => {
                                          try {
                                            await handleCopyGroupLink(group.groupUrlSlug);
                                          } finally {
                                            setExpandedOptions(new Set());
                                          }
                                        }}
                                        className="px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap text-white hover:opacity-80"
                                      >
                                        Copy group URL
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await handleDeleteGroup(group.groupUrlSlug);
                                          } finally {
                                            setExpandedOptions(new Set());
                                          }
                                        }}
                                        className="px-3 py-2 rounded-md text-base font-medium transition-colors text-left whitespace-nowrap text-white hover:opacity-80"
                                      >
                                        Delete group
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* No Groups */
            <div className="content-container">
              <FontAwesomeIcon icon={faUsers} className="icon" style={{ fontSize: 44 }} aria-hidden="true" />
              <div className="v-flex align-center gap-8px">
                <h2>No groups found</h2>
                <p>Visit an existing group or create a new one to add it to your list.</p>
              </div>
            </div>
          )}
        </div>

        <div className="floating-cta-footer">
          <div className="floating-cta-container">
            <Link
              to="/create-a-group/" 
              className="btn fab-shadow"
            >
              <span>Create a group</span>
              <FontAwesomeIcon icon={faUsers} className="icon has-primary-color" style={{ fontSize: 16 }} aria-hidden="true" />
            </Link>
          </div>
          < SigFooter />
        </div>
      </div>
    </div>
  );
};

export default Groups;
