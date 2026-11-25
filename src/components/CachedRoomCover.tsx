import React, { useEffect, useState } from 'react';
import {
  getMemoryCachedCoverUrl,
  getOrFetchCachedCoverUrl,
  normalizeSafeCoverUrl,
} from '../utils/roomCoverCache';

interface CachedRoomCoverProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

/**
 * Renders a room cover image backed by L1 memory + L2 IndexedDB caching.
 * - Instant 0ms render on L1 cache hit.
 * - Soft shimmer placeholder while loading uncached covers.
 * - Automatic fallback to room owner avatar if primary cover fails.
 */
export const CachedRoomCover: React.FC<CachedRoomCoverProps> = ({
  src,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
}) => {
  const primaryUrl = normalizeSafeCoverUrl(src) || normalizeSafeCoverUrl(fallbackSrc);
  const secondaryUrl = normalizeSafeCoverUrl(fallbackSrc);

  const [activeSource, setActiveSource] = useState<string>(primaryUrl);
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    () => getMemoryCachedCoverUrl(primaryUrl) || ''
  );
  const [loaded, setLoaded] = useState<boolean>(() => Boolean(getMemoryCachedCoverUrl(primaryUrl)));

  useEffect(() => {
    setActiveSource(primaryUrl);
    const instant = getMemoryCachedCoverUrl(primaryUrl);
    if (instant) {
      setResolvedUrl(instant);
      setLoaded(true);
    } else {
      setResolvedUrl('');
      setLoaded(false);
    }
  }, [primaryUrl]);

  useEffect(() => {
    if (!activeSource) return;
    const instant = getMemoryCachedCoverUrl(activeSource);
    if (instant) {
      setResolvedUrl(instant);
      return;
    }

    let cancelled = false;
    void getOrFetchCachedCoverUrl(activeSource).then((cachedUrl) => {
      if (cancelled || !cachedUrl) return;
      setResolvedUrl(cachedUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [activeSource]);

  const handleError = () => {
    if (secondaryUrl && activeSource !== secondaryUrl) {
      setActiveSource(secondaryUrl);
      setLoaded(false);
      return;
    }
    // If an ObjectURL failed unexpectedly, fall back directly to the raw network URL
    if (resolvedUrl.startsWith('blob:') && activeSource && resolvedUrl !== activeSource) {
      setResolvedUrl(activeSource);
    }
  };

  return (
    <>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 animate-pulse"
        />
      )}
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`${className} transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}
    </>
  );
};
