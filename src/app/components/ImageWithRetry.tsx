const { useState, useRef, useEffect } = Spicetify.React;

interface ImageWithRetryProps {
  src: string;
  className?: string;
  alt?: string;
  maxRetries?: number;
}

/**
 * Image component with exponential backoff retry on load failure.
 * Retries up to maxRetries times (default 3) with delays of 1s, 2s, 4s.
 * Falls back to a placeholder div on exhaustion or missing src.
 */
export function ImageWithRetry({
  src,
  className = "",
  alt = "",
  maxRetries = 3,
}: ImageWithRetryProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const prevSrcRef = useRef(src);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when src changes
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      setAttempt(0);
      setFailed(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [src]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleError = () => {
    if (attempt < maxRetries) {
      const delay = 1000 * Math.pow(2, attempt);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setAttempt((prev) => prev + 1);
      }, delay);
    } else {
      setFailed(true);
    }
  };

  if (failed || !src) {
    return <div className={`${className} placeholder`} />;
  }

  // Cache-bust URL to avoid browser serving cached 429 response
  const retrySrc =
    attempt > 0
      ? src + (src.includes("?") ? "&" : "?") + `retry=${attempt}`
      : src;

  return (
    <img
      key={retrySrc}
      src={retrySrc}
      className={className}
      alt={alt}
      onError={handleError}
    />
  );
}
