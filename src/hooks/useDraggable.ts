import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const { initialPosition = { x: 0, y: 0 } } = options;
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const handleRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    });
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, [onMouseDown]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [isDragging, onMouseMove, onMouseUp]);

  return { position, isDragging, handleRef, containerRef };
}
