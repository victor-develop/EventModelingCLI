import type { EdgeTypes } from '@xyflow/react';
import { OrthogonalDisplayEdge } from '../components/OrthogonalDisplayEdge';

export const edgeTypes = {
  'em.orthogonal': OrthogonalDisplayEdge,
} satisfies EdgeTypes;
