import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { localStorageService } from '../services/localStorage';

// Hook to automatically track group visits
export const useGroupTracking = () => {
  const { urlSlug } = useParams<{ urlSlug: string }>();

  useEffect(() => {
    if (urlSlug) {
      // Track the group visit in local storage
      localStorageService.trackGroupVisit(urlSlug);
    }
  }, [urlSlug]);
};
