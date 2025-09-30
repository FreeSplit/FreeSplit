// Local storage service using IndexedDB for user group memory
interface UserGroup {
  groupUrlSlug: string;
  userParticipantId: number;
  userParticipantName: string;
  lastVisited: string;
}

class LocalStorageService {
  private dbName = 'FreeSplitUserGroups';
  private dbVersion = 1;
  private storeName = 'userGroups';
  private db: IDBDatabase | null = null;

  // Initialize IndexedDB
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'groupUrlSlug' });
        }
      };
    });
  }

  // Get all stored user groups
  async getUserGroups(): Promise<UserGroup[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        request.onerror = () => {
          reject(new Error('Failed to get user groups'));
        };
      });
    } catch (error) {
      console.error('Error getting user groups:', error);
      return [];
    }
  }

  // Add or update a user group
  async saveUserGroup(userGroup: UserGroup): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(userGroup);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to save user group'));
      });
    } catch (error) {
      console.error('Error saving user group:', error);
    }
  }

  // Remove a user group
  async removeUserGroup(groupUrlSlug: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(groupUrlSlug);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to remove user group'));
      });
    } catch (error) {
      console.error('Error removing user group:', error);
    }
  }

  // Track a group visit (adds if not exists, updates lastVisited if exists)
  async trackGroupVisit(groupUrlSlug: string): Promise<void> {
    try {
      const existingGroups = await this.getUserGroups();
      const existingGroup = existingGroups.find(g => g.groupUrlSlug === groupUrlSlug);
      
      if (existingGroup) {
        // Update last visited
        existingGroup.lastVisited = new Date().toISOString();
        await this.saveUserGroup(existingGroup);
      } else {
        // Add new group (without participant info for now)
        const newGroup: UserGroup = {
          groupUrlSlug,
          userParticipantId: 0, // Will be set when user selects their name
          userParticipantName: '', // Will be set when user selects their name
          lastVisited: new Date().toISOString()
        };
        await this.saveUserGroup(newGroup);
      }
    } catch (error) {
      console.error('Error tracking group visit:', error);
    }
  }

  // Update participant info for a group
  async updateGroupParticipant(groupUrlSlug: string, participantId: number, participantName: string): Promise<void> {
    try {
      const existingGroups = await this.getUserGroups();
      const group = existingGroups.find(g => g.groupUrlSlug === groupUrlSlug);
      
      if (group) {
        group.userParticipantId = participantId;
        group.userParticipantName = participantName;
        group.lastVisited = new Date().toISOString();
        await this.saveUserGroup(group);
      }
    } catch (error) {
      console.error('Error updating group participant:', error);
    }
  }
}

// Export singleton instance
export const localStorageService = new LocalStorageService();
export type { UserGroup };
