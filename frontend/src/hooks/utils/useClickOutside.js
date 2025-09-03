import { useEffect, useRef } from 'react';

/**
 * Hook to detect clicks outside of a component
 * @param {Function} callback - Function to call when clicked outside
 * @returns {Object} Ref to attach to the component
 */
export const useClickOutside = (callback) => {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [callback]);

  return ref;
};

export default useClickOutside;
