import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Hook to handle web+freesplit:// protocol links
 * When the PWA is opened via a protocol handler, the URL will contain
 * a query parameter like: /?protocol=group/abc123
 * 
 * This hook parses that parameter and navigates to the appropriate route
 */
export const useProtocolHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only run on the root path
    if (location.pathname !== '/') {
      return;
    }

    // Check for protocol query parameter
    const searchParams = new URLSearchParams(location.search);
    const protocolData = searchParams.get('protocol');

    if (!protocolData) {
      return;
    }

    // Parse the protocol data
    // Expected format: "group/abc123" or just "abc123"
    let targetPath = '';

    if (protocolData.startsWith('group/')) {
      // Format: web+freesplit://group/abc123 -> /?protocol=group/abc123
      const slug = protocolData.replace('group/', '');
      targetPath = `/groups/${slug}`;
    } else if (protocolData.startsWith('/')) {
      // Format: web+freesplit:///groups/abc123 -> /?protocol=/groups/abc123
      targetPath = protocolData;
    } else {
      // Assume it's just a slug: web+freesplit://abc123 -> /?protocol=abc123
      targetPath = `/groups/${protocolData}`;
    }

    // Navigate to the target path and remove the protocol param from URL
    if (targetPath) {
      console.log('[ProtocolHandler] Navigating to:', targetPath);
      navigate(targetPath, { replace: true });
    }
  }, [location, navigate]);
};
