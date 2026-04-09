/*
Copyright (C) 2025 QuantumNous
*/

const Skeleton = ({ className }) => (
  <div
    className={`animate-pulse rounded-md bg-muted ${className || ''}`}
    aria-hidden={true}
  />
);

export { Skeleton };
